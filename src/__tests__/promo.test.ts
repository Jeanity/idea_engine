import { describe, it, expect } from 'vitest'
import { evaluatePromoGate, DEFAULT_PROMO_CONFIG, mergePromoConfig, type PromoConfig } from '@/lib/promo'

function config(overrides: Partial<PromoConfig> = {}): PromoConfig {
  return { ...DEFAULT_PROMO_CONFIG, enabled: true, started_at: '2026-07-01T00:00:00.000Z', ...overrides }
}

describe('evaluatePromoGate', () => {
  it('denies when promo is disabled', () => {
    const r = evaluatePromoGate(config({ enabled: false }), { reportsUsed: 0, spendUsedUsd: 0, perUserUsed: 0 })
    expect(r).toEqual({ allowed: false, reason: 'disabled', endsPromo: false })
  })

  it('allows when no caps are set and usage is zero', () => {
    const r = evaluatePromoGate(config(), { reportsUsed: 0, spendUsedUsd: 0, perUserUsed: 0 })
    expect(r).toEqual({ allowed: true })
  })

  it('denies and ends the promo when spend cap is reached', () => {
    const r = evaluatePromoGate(config({ spend_cap_usd: 10 }), { reportsUsed: 3, spendUsedUsd: 10, perUserUsed: 0 })
    expect(r).toEqual({ allowed: false, reason: 'spend_cap', endsPromo: true })
  })

  it('allows when spend is just under the cap', () => {
    const r = evaluatePromoGate(config({ spend_cap_usd: 10 }), { reportsUsed: 3, spendUsedUsd: 9.99, perUserUsed: 0 })
    expect(r).toEqual({ allowed: true })
  })

  it('denies and ends the promo when report cap is reached', () => {
    const r = evaluatePromoGate(config({ report_cap: 100 }), { reportsUsed: 100, spendUsedUsd: 5, perUserUsed: 1 })
    expect(r).toEqual({ allowed: false, reason: 'report_cap', endsPromo: true })
  })

  it('checks spend cap before report cap when both are hit', () => {
    const r = evaluatePromoGate(config({ spend_cap_usd: 5, report_cap: 10 }), { reportsUsed: 10, spendUsedUsd: 5, perUserUsed: 0 })
    expect(r).toEqual({ allowed: false, reason: 'spend_cap', endsPromo: true })
  })

  it('denies on per-user limit WITHOUT ending the promo for everyone else', () => {
    const r = evaluatePromoGate(config({ per_user_limit: 1 }), { reportsUsed: 5, spendUsedUsd: 1, perUserUsed: 1 })
    expect(r).toEqual({ allowed: false, reason: 'per_user_limit', endsPromo: false })
  })

  it('allows a user under their per-user limit even with other caps unset', () => {
    const r = evaluatePromoGate(config({ per_user_limit: 3 }), { reportsUsed: 5, spendUsedUsd: 1, perUserUsed: 2 })
    expect(r).toEqual({ allowed: true })
  })

  it('all caps null and enabled means always allowed regardless of usage', () => {
    const r = evaluatePromoGate(config(), { reportsUsed: 100_000, spendUsedUsd: 100_000, perUserUsed: 100_000 })
    expect(r).toEqual({ allowed: true })
  })
})

describe('mergePromoConfig', () => {
  it('fills in defaults for a null/empty stored value', () => {
    expect(mergePromoConfig(null)).toEqual(DEFAULT_PROMO_CONFIG)
  })

  it('overlays partial stored values onto defaults', () => {
    const merged = mergePromoConfig({ enabled: true, report_cap: 50 })
    expect(merged.enabled).toBe(true)
    expect(merged.report_cap).toBe(50)
    expect(merged.spend_cap_usd).toBeNull()
  })
})
