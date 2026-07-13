import { describe, it, expect } from 'vitest'
import { mergeComplianceItems, isEvergreenExpired, classifyEvergreenRow } from '@/lib/evergreen'
import type { ComplianceItem } from '@/lib/compliance-baseline'

function item(overrides: Partial<ComplianceItem> = {}): ComplianceItem {
  return {
    item: 'Business registration',
    jurisdiction: 'Australia',
    severity: 'required',
    summary: 'Register the business.',
    ...overrides,
  }
}

describe('mergeComplianceItems', () => {
  it('concatenates baseline and overlay items when there is no collision', () => {
    const baseline = [item({ item: 'ABN registration' })]
    const overlay = [item({ item: 'Food handling licence' })]
    const merged = mergeComplianceItems(baseline, overlay)
    expect(merged).toHaveLength(2)
    expect(merged.map(i => i.item)).toEqual(['ABN registration', 'Food handling licence'])
  })

  it('drops the baseline item and keeps the overlay item on a case-insensitive collision', () => {
    const baseline = [item({ item: 'Privacy Policy', summary: 'baseline summary' })]
    const overlay = [item({ item: 'privacy policy', summary: 'overlay summary, fresher' })]
    const merged = mergeComplianceItems(baseline, overlay)
    expect(merged).toHaveLength(1)
    expect(merged[0].summary).toBe('overlay summary, fresher')
  })

  it('is a valid, expected result when the overlay is empty — baseline items pass through unchanged', () => {
    const baseline = [item({ item: 'ABN registration' }), item({ item: 'Privacy Policy' })]
    const merged = mergeComplianceItems(baseline, [])
    expect(merged).toEqual(baseline)
  })

  it('returns an empty array when both inputs are empty', () => {
    expect(mergeComplianceItems([], [])).toEqual([])
  })

  it('drops malformed overlay items (missing/non-string `item`) instead of throwing', () => {
    const baseline = [item({ item: 'ABN registration' })]
    // parseJsonArray only guarantees array-ness — a malformed element must
    // degrade, not throw: on the pipeline a throw fails the whole paid report.
    const overlay = [
      {} as ComplianceItem,
      { item: 42 } as unknown as ComplianceItem,
      item({ item: 'Food handling licence' }),
    ]
    const merged = mergeComplianceItems(baseline, overlay)
    expect(merged.map(i => i.item)).toEqual(['ABN registration', 'Food handling licence'])
  })

  it('handles whitespace/casing differences in item names as the same key', () => {
    const baseline = [item({ item: '  ABN Registration  ' })]
    const overlay = [item({ item: 'abn registration', summary: 'overlay wins' })]
    const merged = mergeComplianceItems(baseline, overlay)
    expect(merged).toHaveLength(1)
    expect(merged[0].summary).toBe('overlay wins')
  })
})

describe('isEvergreenExpired', () => {
  it('returns false for an expiry timestamp in the future', () => {
    const now = new Date('2026-07-13T00:00:00Z')
    const expiresAt = new Date('2026-07-14T00:00:00Z').toISOString()
    expect(isEvergreenExpired(expiresAt, now)).toBe(false)
  })

  it('returns true for an expiry timestamp in the past', () => {
    const now = new Date('2026-07-13T00:00:00Z')
    const expiresAt = new Date('2026-01-01T00:00:00Z').toISOString()
    expect(isEvergreenExpired(expiresAt, now)).toBe(true)
  })

  it('treats an expiry timestamp exactly equal to now as NOT yet expired (strict less-than)', () => {
    const now = new Date('2026-07-13T00:00:00Z')
    expect(isEvergreenExpired(now.toISOString(), now)).toBe(false)
  })

  it('defaults `now` to the current time when not provided', () => {
    const pastExpiry = new Date(Date.now() - 1000).toISOString()
    expect(isEvergreenExpired(pastExpiry)).toBe(true)
    const futureExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    expect(isEvergreenExpired(futureExpiry)).toBe(false)
  })
})

describe('classifyEvergreenRow', () => {
  const now = new Date('2026-07-13T00:00:00Z')
  const future = new Date('2026-08-01T00:00:00Z').toISOString()
  const past = new Date('2026-01-01T00:00:00Z').toISOString()

  it('returns "miss" when there is no row', () => {
    expect(classifyEvergreenRow(null, now)).toBe('miss')
  })

  it('returns "hit" for an unreviewed, unexpired row', () => {
    expect(classifyEvergreenRow({ review_status: 'unreviewed', expires_at: future }, now)).toBe('hit')
  })

  it('returns "hit" for an approved, unexpired row', () => {
    expect(classifyEvergreenRow({ review_status: 'approved', expires_at: future }, now)).toBe('hit')
  })

  it('returns "miss" for an expired, non-disapproved row (self-heals via regeneration)', () => {
    expect(classifyEvergreenRow({ review_status: 'unreviewed', expires_at: past }, now)).toBe('miss')
    expect(classifyEvergreenRow({ review_status: 'approved', expires_at: past }, now)).toBe('miss')
  })

  it('returns "disapproved" for a disapproved, unexpired row', () => {
    expect(classifyEvergreenRow({ review_status: 'disapproved', expires_at: future }, now)).toBe('disapproved')
  })

  it('returns "disapproved" — NOT "miss" — for a disapproved row that has also expired (C1 locked decision: expiry must never resurrect a disapproved entry into regeneration)', () => {
    expect(classifyEvergreenRow({ review_status: 'disapproved', expires_at: past }, now)).toBe('disapproved')
  })
})
