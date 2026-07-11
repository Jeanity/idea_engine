import { describe, it, expect } from 'vitest'
import { parseCapitalRange, sumStartupCosts, deriveBudgetFit } from '@/lib/derived-metrics'

describe('parseCapitalRange', () => {
  it('returns null for null/undefined/blank input', () => {
    expect(parseCapitalRange(null)).toBeNull()
    expect(parseCapitalRange(undefined)).toBeNull()
    expect(parseCapitalRange('')).toBeNull()
    expect(parseCapitalRange('   ')).toBeNull()
  })

  it('parses "Under $500"', () => {
    expect(parseCapitalRange('Under $500')).toEqual({ low: 0, high: 500 })
  })

  it('parses "$500–$2,000" (en dash)', () => {
    expect(parseCapitalRange('$500–$2,000')).toEqual({ low: 500, high: 2000 })
  })

  it('parses "$2,000–$10,000" (en dash)', () => {
    expect(parseCapitalRange('$2,000–$10,000')).toEqual({ low: 2000, high: 10000 })
  })

  it('parses "$10,000+" as open-ended', () => {
    expect(parseCapitalRange('$10,000+')).toEqual({ low: 10000, high: null })
  })

  it('parses a plain number', () => {
    expect(parseCapitalRange('5000')).toEqual({ low: 5000, high: 5000 })
  })

  it('returns null for junk text', () => {
    expect(parseCapitalRange('somewhere between a bit and a lot')).toBeNull()
  })

  it('parses a hyphen-with-spaces range', () => {
    expect(parseCapitalRange('500 - 2000')).toEqual({ low: 500, high: 2000 })
  })

  it('swaps a reversed range so low <= high', () => {
    expect(parseCapitalRange('$2,000–$500')).toEqual({ low: 500, high: 2000 })
  })

  it('returns null when one side of a range is unparseable junk', () => {
    // "$1,0" is malformed (parseNumber rejects it) — the whole answer must
    // fail rather than silently dropping the bad half.
    expect(parseCapitalRange('$1,0–$2,000')).toBeNull()
  })
})

describe('sumStartupCosts', () => {
  it('returns null when costBreakdown is missing/null', () => {
    expect(sumStartupCosts(null)).toBeNull()
    expect(sumStartupCosts(undefined)).toBeNull()
  })

  it('returns null when startup_costs is absent', () => {
    expect(sumStartupCosts({ currency: 'USD' })).toBeNull()
  })

  it('returns null when startup_costs is an empty array', () => {
    expect(sumStartupCosts({ startup_costs: [] })).toBeNull()
  })

  it('returns null when startup_costs is not an array', () => {
    expect(sumStartupCosts({ startup_costs: 'oops' })).toBeNull()
  })

  it('sums valid rows', () => {
    expect(sumStartupCosts({
      startup_costs: [
        { item: 'Van', estimate_low: 8000, estimate_high: 45000 },
        { item: 'Machine', estimate_low: 4000, estimate_high: 9500 },
      ],
    })).toEqual({ low: 12000, high: 54500 })
  })

  it('skips malformed rows (missing/non-finite low or high) and keeps the rest', () => {
    expect(sumStartupCosts({
      startup_costs: [
        { item: 'Good', estimate_low: 100, estimate_high: 200 },
        { item: 'Missing high', estimate_low: 50 },
        { item: 'NaN low', estimate_low: NaN, estimate_high: 300 },
        null,
        { item: 'Also good', estimate_low: 10, estimate_high: 20 },
      ],
    })).toEqual({ low: 110, high: 220 })
  })

  it('returns null when every row is malformed', () => {
    expect(sumStartupCosts({ startup_costs: [{ item: 'Broken' }, null, 'nope'] })).toBeNull()
  })
})

describe('deriveBudgetFit', () => {
  const startup = { low: 4000, high: 9000 }

  it('covered — capital low fully covers the high estimate', () => {
    expect(deriveBudgetFit({ low: 10000, high: null }, startup)).toBe('covered')
    expect(deriveBudgetFit({ low: 9000, high: 9000 }, startup)).toBe('covered')
  })

  it('lean_covered — capital low covers the low estimate but not the high', () => {
    expect(deriveBudgetFit({ low: 6000, high: 6000 }, startup)).toBe('lean_covered')
  })

  it('lean_covered — a precise number between low and high', () => {
    expect(deriveBudgetFit({ low: 5000, high: 5000 }, startup)).toBe('lean_covered')
  })

  it('short — capital high end (bounded) is below the startup low estimate', () => {
    expect(deriveBudgetFit({ low: 500, high: 2000 }, startup)).toBe('short')
  })

  it('partial — band straddles the low estimate', () => {
    expect(deriveBudgetFit({ low: 2000, high: 10000 }, startup)).toBe('partial')
  })

  it('partial — an open-ended "+" band that starts below the startup low estimate', () => {
    // e.g. "$10,000+" vs a higher startup range: capital.high is null so the
    // "short" rule can't apply even though capital.low < startup.low.
    expect(deriveBudgetFit({ low: 10000, high: null }, { low: 12000, high: 20000 })).toBe('partial')
  })
})
