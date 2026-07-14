import type { ComplianceItem } from '@/lib/compliance-baseline'
import { mergeComplianceItems } from '@/lib/evergreen'

// Pure helpers for Workstream C2 (disapprove remediation — regenerate, patch
// reports, notify users). Split out from src/lib/evergreen.ts (which stays
// focused on the lookup/store cache contract) and from the two API routes
// that use these (src/app/api/admin/evergreen/[id]/regenerate,
// src/app/api/admin/evergreen/[id]/remediate) so the actual decision logic —
// cohort membership, the patch recompute, and per-user email dedup — is
// directly unit-testable without any Supabase or SMTP mocking. See
// docs/plan/2026-07-14-evergreen-baselines-and-bug-flagged-reports.md
// (Workstream C2) for the design this implements.

/**
 * Cohort membership predicate: is this usage row "on a superseded revision,
 * not yet remediated" for the given CURRENT evergreen row? Mirrors the SQL
 * shape verbatim (`evergreen_id = row.id AND evergreen_updated_at !=
 * row.updated_at AND remediated_at IS NULL`) so both the admin list's
 * per-row cohort count and the remediate route's DB query can be reasoned
 * about against the same rule, and so the rule itself is unit-testable in
 * isolation. Takes the full usage row (including evergreen_id) rather than
 * assuming the caller pre-filtered by evergreen_id, so a mixed array of
 * usage rows across many baselines can be tested/filtered directly.
 */
export function isSupersededUsageRow(
  usage: { evergreen_id: string; evergreen_updated_at: string; remediated_at: string | null },
  current: { id: string; updated_at: string }
): boolean {
  return (
    usage.evergreen_id === current.id &&
    usage.evergreen_updated_at !== current.updated_at &&
    usage.remediated_at === null
  )
}

/** Convenience wrapper — the cohort subset of `usageRows` for `current`. */
export function filterCohort<T extends { evergreen_id: string; evergreen_updated_at: string; remediated_at: string | null }>(
  usageRows: T[],
  current: { id: string; updated_at: string }
): T[] {
  return usageRows.filter(u => isSupersededUsageRow(u, current))
}

/**
 * Workstream D1 gating predicate — cohorts accrue on ANY revision bump (a
 * routine expiry refresh or warm-script re-run supersedes perfectly good
 * content, not just a disapprove-driven fix), so "cohort > 0" alone is not a
 * call to action. The "Remediate…" control only makes sense when this KEY
 * has a disapproval somewhere in its history — `last_disapproved_at` is the
 * permanent marker for that (migration 032, never cleared by approve or
 * storeEvergreenBaseline/regenerate — see 032_evergreen_followups.sql).
 * Split out as a pure predicate so the admin list's render decision and its
 * test are the exact same rule. `lastDisapprovedAt` is `null` both for
 * "never disapproved" and "migration 032 not run yet" — both cases correctly
 * fall back to the muted informational line rather than the action button.
 */
export function shouldOfferRemediation(cohort: number, lastDisapprovedAt: string | null): boolean {
  return cohort > 0 && lastDisapprovedAt !== null
}

/** The subset of a report's `sections` shape this module reads/writes. */
export interface PatchableSections {
  legal_compliance?: unknown
  _meta?: {
    evergreen?: { id: string; updated_at: string; review_status_at_use: string }
    compliance_overlay_items?: unknown
    [key: string]: unknown
  }
  [key: string]: unknown
}

/**
 * Recomputes a report's `legal_compliance` section against a NEW evergreen
 * revision, reusing the report's own stashed overlay items (C1's
 * `_meta.compliance_overlay_items`) rather than re-running the idea-specific
 * overlay AI call. Returns null when the report has no stash (pre-C1 report,
 * or the baseline generation itself was never served this report) — the
 * caller's job in that case is to notify, not patch. Pure — no I/O — so it's
 * directly unit testable.
 */
export function computePatchedSections(
  sections: PatchableSections,
  newBaselineItems: ComplianceItem[],
  newRevision: { id: string; updated_at: string; reviewStatus: string }
): PatchableSections | null {
  const stash = sections?._meta?.compliance_overlay_items
  if (!Array.isArray(stash)) return null

  const merged = mergeComplianceItems(newBaselineItems, stash as ComplianceItem[])

  return {
    ...sections,
    legal_compliance: merged,
    _meta: {
      ...sections._meta,
      evergreen: {
        id: newRevision.id,
        updated_at: newRevision.updated_at,
        review_status_at_use: newRevision.reviewStatus,
      },
    },
  }
}

export type ReportLoadOutcome = 'ok' | 'orphaned' | 'error'

/**
 * Workstream D2 classifier — the remediate route's per-cohort-row report
 * load must tell apart a genuine query ERROR (transient, stays
 * 'skipped'/retryable on a re-run) from a successful query that simply found
 * no row (`!report && !error`): the report was hard-deleted — e.g. the user
 * deleted the idea it belonged to, which cascades reports away, see
 * src/app/api/ideas/[id]/route.ts — and can NEVER be remediated. That usage
 * row should drain out of the cohort as 'orphaned' instead of accreting
 * forever as 'skipped'. Pure — no I/O — so it's directly unit testable
 * without any Supabase mocking.
 */
export function classifyReportLoad(report: unknown, error: unknown): ReportLoadOutcome {
  if (error) return 'error'
  if (!report) return 'orphaned'
  return 'ok'
}

export interface RemediatedReportRef {
  report_id: string
  idea_id: string
}

/**
 * Groups processed cohort rows by user_id — "a user with 3 affected reports
 * gets one email listing/linking their reports, not 3 emails" (locked
 * design decision). Pure — takes plain rows (already resolved report_id +
 * idea_id, e.g. from the usage/report join the remediate route performs) and
 * returns a Map so callers iterate `[userId, reports]` once per user.
 */
export function groupReportsByUser(
  rows: Array<{ user_id: string; report_id: string; idea_id: string }>
): Map<string, RemediatedReportRef[]> {
  const map = new Map<string, RemediatedReportRef[]>()
  for (const row of rows) {
    const list = map.get(row.user_id)
    if (list) {
      list.push({ report_id: row.report_id, idea_id: row.idea_id })
    } else {
      map.set(row.user_id, [{ report_id: row.report_id, idea_id: row.idea_id }])
    }
  }
  return map
}
