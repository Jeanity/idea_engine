import { describe, it, expect } from 'vitest'
import { parseNumber, calculateCosts, needsAiCostFallback } from '@/lib/cost-calculator'

describe('parseNumber', () => {
  it('returns null for null/undefined/empty input', () => {
    expect(parseNumber(null)).toBeNull()
    expect(parseNumber(undefined)).toBeNull()
    expect(parseNumber('')).toBeNull()
    expect(parseNumber('   ')).toBeNull()
  })

  it('parses a plain integer', () => {
    expect(parseNumber('25')).toBe(25)
  })

  it('parses a plain decimal', () => {
    expect(parseNumber('25.5')).toBe(25.5)
  })

  it('parses a negative number', () => {
    expect(parseNumber('-5')).toBe(-5)
  })

  it('strips a leading currency symbol', () => {
    expect(parseNumber('$25.50')).toBe(25.5)
  })

  it('strips a trailing currency symbol', () => {
    expect(parseNumber('25.50$')).toBe(25.5)
  })

  it('strips thousands-separator commas', () => {
    expect(parseNumber('1,200')).toBe(1200)
  })

  it('strips a leading country-prefixed currency code', () => {
    expect(parseNumber('AUD 40')).toBe(40)
  })

  it('strips a leading letter+$ currency prefix', () => {
    expect(parseNumber('A$40')).toBe(40)
  })

  it('strips a trailing currency code', () => {
    expect(parseNumber('40 USD')).toBe(40)
  })

  it('handles thousands separator plus decimal', () => {
    expect(parseNumber('12,000.50')).toBe(12000.5)
  })

  // The bug this fix closes: a free-text ingredient list was being mangled
  // into a garbage number (5002400200) by the old strip-everything-but-
  // digits implementation, and fed straight into the deterministic cost
  // calculator.
  it('returns null for a free-text ingredient list (was producing 5002400200)', () => {
    expect(parseNumber('500g oat flour, 2 eggs, 400g pumpkin, 200g peanut butter')).toBeNull()
  })

  it('returns null for a vague range', () => {
    expect(parseNumber('about 20-30')).toBeNull()
  })

  it('returns null for a number with a non-currency unit suffix', () => {
    expect(parseNumber('2400W')).toBeNull()
  })

  it('returns null for pure prose with no number', () => {
    expect(parseNumber('not sure yet')).toBeNull()
  })
})

describe('calculateCosts — null inputs degrade honestly', () => {
  it('flags materials as estimated with an explanatory note when null (no garbage total)', () => {
    const result = calculateCosts({
      location_country: 'AU',
      materials_batch_cost: null,
      packaging_per_unit: null,
      equipment_wattage: null,
      active_minutes_per_batch: null,
      passive_minutes_per_batch: null,
      batch_yield: null,
      hourly_rate: null,
      unit_cost_estimate: null,
    })
    expect(result.per_unit.materials).toBeNull()
    expect(result.estimation_flags.materials).toBe('estimated')
    expect(result.per_unit.total_cogs).toBeNull()
    expect(result.suggested_price).toBeNull()
    expect(result.notes).toContain('Materials cost not provided')
  })

  it('produces a sane total when parseNumber successfully extracts real values', () => {
    const result = calculateCosts({
      location_country: 'AU',
      materials_batch_cost: parseNumber('$120') ?? undefined,
      packaging_per_unit: parseNumber('2.50') ?? undefined,
      equipment_wattage: null,
      active_minutes_per_batch: null,
      passive_minutes_per_batch: null,
      batch_yield: parseNumber('12') ?? undefined,
      hourly_rate: null,
      unit_cost_estimate: null,
    })
    // materials: 120 / 12 = 10, packaging: 2.50 → total_cogs = 12.50
    expect(result.per_unit.materials).toBe(10)
    expect(result.per_unit.packaging).toBe(2.5)
    expect(result.per_unit.total_cogs).toBe(12.5)
    expect(result.per_unit.total_cogs).toBeLessThan(1000) // sanity bound — no digit-mashing garbage
  })
})

describe('needsAiCostFallback', () => {
  // This is the exact trigger condition generate-report.ts uses to decide
  // whether a product-archetype report needs the AI cost-estimation
  // fallback (Step 2 in src/lib/inngest/generate-report.ts): a materials
  // figure of null means neither a batch materials cost nor a per-unit
  // manufacturer estimate was parseable from the founder's answers.
  it('is true when neither materials nor unit-cost estimate was provided', () => {
    const result = calculateCosts({
      location_country: 'AU',
      materials_batch_cost: null,
      packaging_per_unit: null,
      equipment_wattage: null,
      active_minutes_per_batch: null,
      passive_minutes_per_batch: null,
      batch_yield: null,
      hourly_rate: null,
      unit_cost_estimate: null,
    })
    expect(needsAiCostFallback(result)).toBe(true)
  })

  it('is false when a batch materials cost and yield were provided', () => {
    const result = calculateCosts({
      location_country: 'AU',
      materials_batch_cost: 120,
      packaging_per_unit: null,
      equipment_wattage: null,
      active_minutes_per_batch: null,
      passive_minutes_per_batch: null,
      batch_yield: 12,
      hourly_rate: null,
      unit_cost_estimate: null,
    })
    expect(needsAiCostFallback(result)).toBe(false)
  })

  it('is false when only a per-unit manufacturer estimate was provided (no batch materials)', () => {
    const result = calculateCosts({
      location_country: 'AU',
      materials_batch_cost: null,
      packaging_per_unit: null,
      equipment_wattage: null,
      active_minutes_per_batch: null,
      passive_minutes_per_batch: null,
      batch_yield: null,
      hourly_rate: null,
      unit_cost_estimate: 4.5,
    })
    expect(needsAiCostFallback(result)).toBe(false)
  })
})
