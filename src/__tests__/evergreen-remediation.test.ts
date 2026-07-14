import { describe, it, expect } from 'vitest'
import {
  isSupersededUsageRow,
  filterCohort,
  computePatchedSections,
  groupReportsByUser,
} from '@/lib/evergreen-remediation'
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

describe('isSupersededUsageRow', () => {
  const current = { id: 'evergreen-1', updated_at: '2026-07-14T00:00:00Z' }

  it('is true for a usage row on a different (superseded) revision of the same baseline, not yet remediated', () => {
    expect(
      isSupersededUsageRow(
        { evergreen_id: 'evergreen-1', evergreen_updated_at: '2026-07-01T00:00:00Z', remediated_at: null },
        current
      )
    ).toBe(true)
  })

  it('is false when the usage row is on the CURRENT revision (evergreen_updated_at matches)', () => {
    expect(
      isSupersededUsageRow(
        { evergreen_id: 'evergreen-1', evergreen_updated_at: current.updated_at, remediated_at: null },
        current
      )
    ).toBe(false)
  })

  it('is false when the usage row already has remediated_at set', () => {
    expect(
      isSupersededUsageRow(
        { evergreen_id: 'evergreen-1', evergreen_updated_at: '2026-07-01T00:00:00Z', remediated_at: '2026-07-10T00:00:00Z' },
        current
      )
    ).toBe(false)
  })

  it('is false for a usage row that belongs to a DIFFERENT evergreen baseline', () => {
    expect(
      isSupersededUsageRow(
        { evergreen_id: 'evergreen-2', evergreen_updated_at: '2026-07-01T00:00:00Z', remediated_at: null },
        current
      )
    ).toBe(false)
  })
})

describe('filterCohort', () => {
  const current = { id: 'evergreen-1', updated_at: '2026-07-14T00:00:00Z' }

  it('returns only the superseded, unremediated usage rows for the given baseline out of a mixed batch', () => {
    const rows = [
      { evergreen_id: 'evergreen-1', evergreen_updated_at: '2026-07-01T00:00:00Z', remediated_at: null }, // cohort
      { evergreen_id: 'evergreen-1', evergreen_updated_at: current.updated_at, remediated_at: null }, // current revision, not cohort
      { evergreen_id: 'evergreen-1', evergreen_updated_at: '2026-06-01T00:00:00Z', remediated_at: '2026-07-10T00:00:00Z' }, // already remediated
      { evergreen_id: 'evergreen-2', evergreen_updated_at: '2026-07-01T00:00:00Z', remediated_at: null }, // different baseline
      { evergreen_id: 'evergreen-1', evergreen_updated_at: '2026-05-01T00:00:00Z', remediated_at: null }, // cohort
    ]
    expect(filterCohort(rows, current)).toHaveLength(2)
  })

  it('returns an empty array when nothing matches', () => {
    expect(filterCohort([], current)).toEqual([])
  })
})

describe('computePatchedSections', () => {
  const newRevision = { id: 'evergreen-2', updated_at: '2026-08-01T00:00:00Z', reviewStatus: 'approved' }

  it('returns null when the report has no compliance_overlay_items stash (pre-C1 report)', () => {
    const sections = { legal_compliance: [item()], _meta: { cost_usd: 0.01 } }
    expect(computePatchedSections(sections, [item({ item: 'New baseline item' })], newRevision)).toBeNull()
  })

  it('returns null when _meta is entirely absent', () => {
    const sections = { legal_compliance: [item()] }
    expect(computePatchedSections(sections, [item()], newRevision)).toBeNull()
  })

  it('recomputes legal_compliance as merge(new baseline items, stashed overlay items) and updates _meta.evergreen', () => {
    const overlayStash = [item({ item: 'Food handling licence' })]
    const sections = {
      legal_compliance: [item({ item: 'Old baseline item' })], // stale — must be replaced, not merged into
      _meta: {
        cost_usd: 0.02,
        evergreen: { id: 'evergreen-1', updated_at: '2026-07-01T00:00:00Z', review_status_at_use: 'unreviewed' },
        compliance_overlay_items: overlayStash,
      },
    }
    const newBaselineItems = [item({ item: 'ABN registration' })]

    const patched = computePatchedSections(sections, newBaselineItems, newRevision)

    expect(patched).not.toBeNull()
    expect(patched!.legal_compliance).toEqual([
      item({ item: 'ABN registration' }),
      item({ item: 'Food handling licence' }),
    ])
    expect(patched!._meta!.evergreen).toEqual({
      id: 'evergreen-2',
      updated_at: '2026-08-01T00:00:00Z',
      review_status_at_use: 'approved',
    })
    // The stash and any other _meta fields survive the patch.
    expect(patched!._meta!.compliance_overlay_items).toEqual(overlayStash)
    expect(patched!._meta!.cost_usd).toBe(0.02)
  })

  it('preserves other top-level section keys untouched', () => {
    const sections = {
      legal_compliance: [item()],
      marketing_plan: { channels: ['seo'] },
      _meta: { compliance_overlay_items: [] },
    }
    const patched = computePatchedSections(sections, [item({ item: 'New item' })], newRevision)
    expect(patched!.marketing_plan).toEqual({ channels: ['seo'] })
  })
})

describe('groupReportsByUser', () => {
  it('groups rows by user_id, preserving report/idea pairs, in encounter order', () => {
    const rows = [
      { user_id: 'user-a', report_id: 'report-1', idea_id: 'idea-1' },
      { user_id: 'user-b', report_id: 'report-2', idea_id: 'idea-2' },
      { user_id: 'user-a', report_id: 'report-3', idea_id: 'idea-3' },
    ]
    const grouped = groupReportsByUser(rows)
    expect(grouped.size).toBe(2)
    expect(grouped.get('user-a')).toEqual([
      { report_id: 'report-1', idea_id: 'idea-1' },
      { report_id: 'report-3', idea_id: 'idea-3' },
    ])
    expect(grouped.get('user-b')).toEqual([{ report_id: 'report-2', idea_id: 'idea-2' }])
  })

  it('is exactly "a user with 3 affected reports gets one email listing/linking their reports, not 3 emails" — one map entry, three reports', () => {
    const rows = [
      { user_id: 'user-a', report_id: 'report-1', idea_id: 'idea-1' },
      { user_id: 'user-a', report_id: 'report-2', idea_id: 'idea-2' },
      { user_id: 'user-a', report_id: 'report-3', idea_id: 'idea-3' },
    ]
    const grouped = groupReportsByUser(rows)
    expect(grouped.size).toBe(1)
    expect(grouped.get('user-a')).toHaveLength(3)
  })

  it('returns an empty map for an empty input', () => {
    expect(groupReportsByUser([]).size).toBe(0)
  })
})
