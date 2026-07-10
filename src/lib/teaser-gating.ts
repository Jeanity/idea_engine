import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { getSetting, setSetting } from '@/lib/app-settings'
import { deriveHeadlineScore } from '@/lib/viability-score'

// ── Teaser gating (docs/plan reference: HANDOFF "Teaser gating / blur") ──
//
// When enabled, the initial (teaser) report is REDACTED AT DELIVERY TIME:
// the viability snapshot keeps its headline score + verdict but loses the
// per-dimension sub-scores and rationales, and next steps are cut to one.
// The stored preview_sections row is never modified — gating is applied in
// the delivery paths (report page SSR, the /api/reports poll, the teaser
// PDF), so the admin toggle applies retroactively and reversibly.
//
// Ground rule (Danny, 2026-07-10): the redaction is REAL — gated text never
// leaves the server. The client renders decorative skeletons for locked
// content; there is nothing underneath them to un-blur.

export const TEASER_GATING_KEY = 'teaser_gating'

export interface TeaserGatingConfig {
  enabled: boolean
}

export const DEFAULT_TEASER_GATING: TeaserGatingConfig = { enabled: false }

export async function readTeaserGatingConfig(service: SupabaseClient<Database>): Promise<TeaserGatingConfig> {
  const raw = await getSetting<Partial<TeaserGatingConfig>>(service, TEASER_GATING_KEY)
  return { ...DEFAULT_TEASER_GATING, ...(raw ?? {}) }
}

export async function writeTeaserGatingConfig(
  service: SupabaseClient<Database>,
  config: TeaserGatingConfig
): Promise<{ error: string | null }> {
  return setSetting(service, TEASER_GATING_KEY, config)
}

// ── Pure redaction (no I/O — unit-tested) ────────────────────────────────

/** Partial-failure marker used across report sections (REPORT_SPEC §1.9). */
function isUnavailable(v: unknown): boolean {
  return typeof v === 'object' && v !== null && (v as Record<string, unknown>).status === 'unavailable'
}

export interface GatedViabilitySnapshot {
  /** 0-100 headline score derived server-side — the sub-scores never ship. */
  headline_score: number
  overall_verdict: string
  /** Raw score keys (market_opportunity, …) so the client can label the locked rows. */
  locked_dimensions: string[]
}

/**
 * Redacts a teaser's preview_sections for delivery. Returns a NEW object —
 * never mutates (and never writes back to) the stored row:
 * - summary: untouched (trust builder — proves the AI understood the idea).
 * - viability_snapshot: headline score + verdict only; per-dimension scores
 *   and rationales are REMOVED (they answered "is my idea any good?" for
 *   free — the conversion leak this feature exists to close). The dimension
 *   KEYS ship so the UI can render labelled locked rows.
 * - next_steps: first step only, plus a count of hidden ones.
 * - Unavailable-markers and unknown sections pass through untouched.
 */
export function gatePreviewSections(preview: Record<string, unknown>): Record<string, unknown> {
  const gated: Record<string, unknown> = { ...preview }

  const vs = preview.viability_snapshot
  if (vs && !isUnavailable(vs) && typeof vs === 'object') {
    const snapshot = vs as { scores?: Record<string, { score: number; rationale: string }>; overall_verdict?: string }
    if (snapshot.scores) {
      const gatedSnapshot: GatedViabilitySnapshot = {
        headline_score: deriveHeadlineScore(snapshot.scores),
        overall_verdict: snapshot.overall_verdict ?? '',
        locked_dimensions: Object.keys(snapshot.scores),
      }
      gated.viability_snapshot = gatedSnapshot
    }
  }

  const steps = preview.next_steps
  if (Array.isArray(steps) && steps.length > 0) {
    gated.next_steps = steps.slice(0, 1)
    gated.locked_next_steps = steps.length - 1
  }

  return gated
}

// ── Delivery-path wrapper ────────────────────────────────────────────────

interface ReportLike {
  status: string
  sections: unknown
  preview_sections: unknown
}

/** Full sections present = paid/unlocked report — gating never applies. */
function hasFullSections(report: ReportLike): boolean {
  const sections = (report.sections as Record<string, unknown> | null) ?? {}
  return report.status === 'complete' && Object.keys(sections).length > 0
}

/**
 * Applies teaser gating to an outgoing report payload when (a) the report is
 * teaser-only and (b) the admin toggle is on. Reads the toggle with the
 * service client (app_settings is service-role only); any read failure —
 * including the table predating migration 013 — degrades to "gating off".
 * Adds `teaser_gated: true` so the client knows to render the locked UI.
 */
export async function maybeGateReport<T extends ReportLike>(
  service: SupabaseClient<Database>,
  report: T
): Promise<T & { teaser_gated?: boolean }> {
  if (hasFullSections(report)) return report

  const preview = (report.preview_sections as Record<string, unknown> | null) ?? {}
  if (Object.keys(preview).length === 0) return report

  const config = await readTeaserGatingConfig(service)
  if (!config.enabled) return report

  return { ...report, preview_sections: gatePreviewSections(preview), teaser_gated: true }
}
