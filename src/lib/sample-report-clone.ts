import type { Json } from '@/lib/database.types'

// Shared by the admin "create sample from report" flow
// (src/app/api/admin/samples/route.ts POST). Kept as a pure function so it's
// unit-testable without a database.

/**
 * Strips fields that must never leave the internal pipeline before a report's
 * `sections` are copied into a public-facing sample_reports row.
 *
 * `_meta` carries internal cost/model diagnostics (token counts, model
 * version, section fallback status) — useful for admin debugging on the real
 * report, never appropriate to ship on a public sample page.
 */
export function sanitizeSectionsForSample(sections: Record<string, unknown>): Json {
  const { _meta, ...rest } = sections
  void _meta
  // Round-trip through JSON: sections comes from a jsonb column via the
  // Supabase client, so it's already JSON-safe, but this guards against any
  // non-serialisable value slipping in (matches the normaliseDetail pattern
  // in log-error.ts) and gives us a plain, detached object to insert.
  return JSON.parse(JSON.stringify(rest)) as Json
}
