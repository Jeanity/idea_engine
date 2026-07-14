import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import type { ComplianceItem } from '@/lib/compliance-baseline'

// Lookup/store helpers for the evergreen country x archetype x section
// research cache (migration 030, extended by 031's disapprove state +
// exposure tagging). Phase 1 only ever calls these with section: 'compliance'
// (region is always '') — see src/lib/inngest/generate-report.ts for the
// pipeline wiring and
// docs/plan/2026-07-14-evergreen-baselines-and-bug-flagged-reports.md
// (Workstreams A and C) for the design.
//
// Both functions take an EXISTING service client — same convention as
// src/lib/app-settings.ts — so callers stay in control of when the
// RLS-bypassing client is minted.

const EVERGREEN_TTL_MS = 180 * 24 * 60 * 60 * 1000 // 180 days

export type EvergreenSection = 'compliance' | 'financing' | 'marketing'

export interface EvergreenBaseline {
  id: string
  countryCode: string
  region: string
  archetype: string
  section: EvergreenSection
  items: ComplianceItem[]
  // Never 'disapproved' here — a disapproved row is reported as its own
  // lookup status (below) and never wrapped in an EvergreenBaseline, and
  // storeEvergreenBaseline always resets review_status to 'unreviewed' on
  // write. Admin surfaces that need the full three-way status read the
  // review_status column directly rather than going through this type.
  reviewStatus: 'unreviewed' | 'approved'
  generatedByModel: string
  generationCostUsd: number
  sourceReportId: string | null
  expiresAt: string
  updatedAt: string
}

// Postgres 42P01 = undefined_table, PostgREST PGRST205 = "table not found in
// schema cache" — both mean the relevant migration (030 for
// evergreen_baselines, 031 for evergreen_report_usage) hasn't been run yet.
// Same pattern as src/lib/app-settings.ts / src/app/api/bug-report/route.ts:
// a missing migration must degrade to "cache miss", never a crash.
export function isMissingEvergreenTable(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

export interface EvergreenLookupKey {
  countryCode: string
  archetype: string
  section: EvergreenSection
}

/**
 * Pure predicate — has this baseline's expires_at passed `now`? Split out
 * from the DB round-trip below so the expiry rule itself is directly unit
 * testable without any Supabase mocking (src/__tests__).
 */
export function isEvergreenExpired(expiresAtIso: string, now: Date = new Date()): boolean {
  return new Date(expiresAtIso).getTime() < now.getTime()
}

export type EvergreenRowClassification = 'hit' | 'miss' | 'disapproved'

/**
 * Pure classifier over a fetched row (or null for "no row found") — the
 * quad-state lookup's core decision, split out for direct unit testing
 * (Workstream C1). A disapproved row is NEVER resurrected by expiry: Danny's
 * disapproval must hold even after expires_at passes, until he explicitly
 * regenerates the entry — so the disapproved check runs BEFORE the expiry
 * check below, not after.
 */
export function classifyEvergreenRow(
  row: { review_status: string; expires_at: string } | null,
  now: Date = new Date()
): EvergreenRowClassification {
  if (!row) return 'miss'
  if (row.review_status === 'disapproved') return 'disapproved'
  if (isEvergreenExpired(row.expires_at, now)) return 'miss'
  return 'hit'
}

function rowToBaseline(data: {
  id: string
  country_code: string
  region: string
  archetype: string
  section: string
  items: unknown
  review_status: string
  generated_by_model: string
  generation_cost_usd: number
  source_report_id: string | null
  expires_at: string
  updated_at: string
}): EvergreenBaseline {
  return {
    id: data.id,
    countryCode: data.country_code,
    region: data.region,
    archetype: data.archetype,
    section: data.section as EvergreenSection,
    items: (data.items as unknown as ComplianceItem[]) ?? [],
    reviewStatus: data.review_status as 'unreviewed' | 'approved',
    generatedByModel: data.generated_by_model,
    generationCostUsd: data.generation_cost_usd,
    sourceReportId: data.source_report_id,
    expiresAt: data.expires_at,
    updatedAt: data.updated_at,
  }
}

/**
 * Quad-state lookup result. The report pipeline needs to tell apart:
 * "genuinely no baseline yet" (worth paying for a fresh one), "the table
 * doesn't exist yet" (migration 030 not run — behave exactly as before
 * migration 030 existed, never spend an extra AI call over a missing table),
 * and "Danny disapproved this entry" (never served, never auto-regenerated —
 * the pipeline takes the legacy per-report compliance branch until an
 * explicit regenerate, Workstream C2). The simpler `getEvergreenBaseline`
 * below collapses everything except 'hit' into `null` for callers that only
 * care about hit-vs-not (matches A2 of the evergreen baselines spec).
 */
export type EvergreenLookupResult =
  | { status: 'hit'; baseline: EvergreenBaseline }
  | { status: 'miss' }
  | { status: 'disapproved' }
  | { status: 'table_missing' }

export async function lookupEvergreenBaseline(
  supabase: SupabaseClient<Database>,
  { countryCode, archetype, section }: EvergreenLookupKey
): Promise<EvergreenLookupResult> {
  const normalizedCountry = (countryCode ?? '').toUpperCase()

  const { data, error } = await supabase
    .from('evergreen_baselines')
    .select('id, country_code, region, archetype, section, items, review_status, generated_by_model, generation_cost_usd, source_report_id, expires_at, updated_at')
    .eq('country_code', normalizedCountry)
    .eq('region', '')
    .eq('archetype', archetype)
    .eq('section', section)
    .maybeSingle()

  if (error) {
    if (isMissingEvergreenTable(error)) return { status: 'table_missing' }
    console.error('lookupEvergreenBaseline: query failed', error)
    return { status: 'miss' }
  }

  if (!data) return { status: 'miss' }

  const classification = classifyEvergreenRow(data)
  if (classification === 'disapproved') return { status: 'disapproved' }
  if (classification === 'miss') return { status: 'miss' }

  return { status: 'hit', baseline: rowToBaseline(data) }
}

/**
 * Returns the cached baseline for this country x archetype x section, or
 * null when there is no row, the row has expired, the row is disapproved, or
 * the table doesn't exist yet. Region is fixed to '' in phase 1. Thin
 * wrapper over `lookupEvergreenBaseline` for callers that don't need to
 * distinguish the non-'hit' cases (see that function's doc comment).
 */
export async function getEvergreenBaseline(
  supabase: SupabaseClient<Database>,
  key: EvergreenLookupKey
): Promise<EvergreenBaseline | null> {
  const result = await lookupEvergreenBaseline(supabase, key)
  return result.status === 'hit' ? result.baseline : null
}

export interface EvergreenStoreInput {
  countryCode: string
  archetype: string
  section: EvergreenSection
  items: ComplianceItem[]
  model: string
  costUsd: number
  // Nullable: the report pipeline always passes the triggering report's id,
  // but scripts/warm-evergreen.ts pre-populates the cache outside any report
  // (no report to attribute the entry to) and passes null — the column and
  // the admin evergreen list already handle a null source report.
  sourceReportId: string | null
}

/**
 * Upserts a freshly generated baseline on the unique
 * (country_code, region, archetype, section) key. Two concurrent
 * first-reports for the same key is last-writer-wins by design — both
 * results are fresh, no locking needed. Regeneration always resets
 * review_status to 'unreviewed' (clearing any prior disapproved_at/
 * disapprove_note — a fresh write is never disapproved) and pushes
 * expires_at out 180 days from now. Never throws — the report that
 * triggered this call must never fail because the cache write did.
 *
 * Deliberately does NOT touch `last_disapproved_at` (migration 032) — unlike
 * disapproved_at/disapprove_note, that column is a PERMANENT "this key has a
 * disapproval in its history" marker and must survive regeneration; leaving
 * it out of the upsert payload below (rather than explicitly re-writing its
 * existing value) is what makes that true.
 *
 * Returns the stored row (or null on any swallowed failure, including a
 * missing table) rather than a boolean, so callers can record the
 * CANONICAL id/updated_at the database actually assigned — an in-memory
 * reconstruction of those fields would drift from what's really stored, and
 * evergreen_report_usage (031) needs a real id to reference via its FK.
 * scripts/warm-evergreen.ts reports generated-vs-failed per pair from this
 * same null-check; the report pipeline uses the row when present and falls
 * back to an in-memory reconstruction (not persisted, no usage row) when not.
 */
export async function storeEvergreenBaseline(
  supabase: SupabaseClient<Database>,
  { countryCode, archetype, section, items, model, costUsd, sourceReportId }: EvergreenStoreInput
): Promise<EvergreenBaseline | null> {
  const normalizedCountry = (countryCode ?? '').toUpperCase()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + EVERGREEN_TTL_MS)

  const { data, error } = await supabase
    .from('evergreen_baselines')
    .upsert(
      {
        country_code: normalizedCountry,
        region: '',
        archetype,
        section,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: items as any,
        review_status: 'unreviewed',
        reviewed_at: null,
        disapproved_at: null,
        disapprove_note: null,
        generated_by_model: model,
        generation_cost_usd: costUsd,
        source_report_id: sourceReportId,
        updated_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      },
      { onConflict: 'country_code,region,archetype,section' }
    )
    .select('id, country_code, region, archetype, section, items, review_status, generated_by_model, generation_cost_usd, source_report_id, expires_at, updated_at')
    .single()

  if (error) {
    if (isMissingEvergreenTable(error)) {
      console.warn('storeEvergreenBaseline: evergreen_baselines table not found (migration 030 not run) — skipping store')
      return null
    }
    console.error('storeEvergreenBaseline: upsert failed', error)
    return null
  }
  return rowToBaseline(data)
}

/**
 * Merges baseline items with per-report overlay items, deduped
 * case-insensitively by `item` name. The overlay wins on a collision — it's
 * fresher and idea-aware, the baseline entry is dropped in favour of it.
 * Order is preserved: baseline items first (minus any overlaid ones), then
 * every overlay item. Pure function — no I/O — so it's directly unit
 * testable without any Supabase mocking.
 */
export function mergeComplianceItems(
  baselineItems: ComplianceItem[],
  overlayItems: ComplianceItem[]
): ComplianceItem[] {
  // Overlay items come straight from parseJsonArray, which only guarantees
  // array-ness — not per-item shape. This runs on the report pipeline where
  // an uncaught throw fails the whole paid report, so a malformed element
  // (missing/non-string `item`) is dropped rather than allowed to throw.
  const itemKey = (i: ComplianceItem): string =>
    typeof i?.item === 'string' ? i.item.trim().toLowerCase() : ''
  const safeOverlay = overlayItems.filter(i => itemKey(i) !== '')
  const overlayKeys = new Set(safeOverlay.map(itemKey))
  const dedupedBaseline = baselineItems.filter(i => !overlayKeys.has(itemKey(i)) || itemKey(i) === '')
  return [...dedupedBaseline, ...safeOverlay]
}
