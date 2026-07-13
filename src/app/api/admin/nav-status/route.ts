import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { NextResponse } from 'next/server'

// Powers the live nav badges in src/app/app/admin/admin-shell.tsx: survey-active
// dot on Surveys, and "new since I last visited that page" counts on Contact,
// Feedback, Bugs, Errors, and Evergreen (migration 023, admin_seen). Evergreen
// (Workstream C1) was originally state-based ("entries awaiting review",
// shipped 56ab53f) — reframed to match "New"/"Approved" both being served
// identically: the badge now means "new evergreen entries since I last opened
// the page" (updated_at > seen.evergreen), same seen-based semantics as
// everything else here. A regenerated entry bumps updated_at, so it lights
// the badge again even though the row already existed. The /app/admin layout
// gates the PAGE, not this API route — every admin route re-checks
// isAdminEmail itself, per project ground rules. The service client is only
// ever created AFTER that check passes (matches src/api/admin/stats).
//
// Every individual query degrades its own field to 0 on error (including
// 42P01/PGRST205 for tables that predate a given migration) — this endpoint
// never 500s just because one queue's table is missing.

type Section = 'contact' | 'feedback' | 'bugs' | 'errors' | 'evergreen'
type SeenMap = Partial<Record<Section, string>>

// Postgres 42703 = undefined_column, PostgREST PGRST204 = "column not found
// in schema cache" — both mean migration 023 (admin_seen) hasn't been run in
// this environment yet.
function isMissingColumn(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42703' || error?.code === 'PGRST204'
}

// Postgres 42P01 = undefined_table, PostgREST PGRST205 = "table not found in
// schema cache" — a queue table that predates its own migration.
function isMissingTable(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

const EPOCH = new Date(0).toISOString()

export async function GET() {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Only used AFTER the isAdminEmail check above, per project ground rules.
  const service = createServiceClient()

  // The caller's own "last visited each admin page" timestamps. A missing
  // per-section key (including seen === null, i.e. never marked anything
  // seen) means "everything in that section counts as new" — we substitute
  // EPOCH so the `created_at > since` queries below count every row.
  //
  // If the admin_seen COLUMN itself doesn't exist yet (migration 023 not
  // run), seenColumnMissing stays true and Contact/Feedback fall back to
  // their PRE-023 semantics (open-count / 24h-window) rather than "since the
  // epoch" — badges keep working, sensibly, before Danny runs the migration.
  // Bugs/Errors are brand-new sections with no pre-023 behaviour to
  // preserve, so they simply read as 0 until the migration lands.
  const { data: profileRow, error: seenError } = await service
    .from('profiles')
    .select('admin_seen')
    .eq('id', user.id)
    .single()

  const seenColumnMissing = isMissingColumn(seenError)
  if (seenError && !seenColumnMissing) {
    console.error('Admin nav-status: admin_seen read failed:', seenError)
  }
  const seen: SeenMap = (!seenError && profileRow?.admin_seen && typeof profileRow.admin_seen === 'object')
    ? (profileRow.admin_seen as SeenMap)
    : {}

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const ZERO_RESULT = Promise.resolve({ count: 0, error: null } as { count: number | null; error: { code?: string } | null })

  const [surveysRes, contactRes, feedbackRes, bugsRes, errorsRes, evergreenRes] = await Promise.all([
    // Any active survey row lights the Surveys dot (migration 025 —
    // per-survey active replaced the old app_settings on/off flag).
    service.from('surveys').select('id', { count: 'exact', head: true }).eq('active', true),
    seenColumnMissing
      ? service.from('contact_submissions').select('id', { count: 'exact', head: true }).eq('status', 'open')
      : service.from('contact_submissions').select('id', { count: 'exact', head: true }).gt('created_at', seen.contact ?? EPOCH),
    seenColumnMissing
      ? service.from('report_feedback').select('id', { count: 'exact', head: true }).gte('created_at', dayAgo)
      : service.from('report_feedback').select('id', { count: 'exact', head: true }).gt('created_at', seen.feedback ?? EPOCH),
    seenColumnMissing
      ? ZERO_RESULT
      : service.from('bug_reports').select('id', { count: 'exact', head: true }).gt('created_at', seen.bugs ?? EPOCH),
    seenColumnMissing
      ? ZERO_RESULT
      : service.from('error_log').select('id', { count: 'exact', head: true }).gt('occurred_at', seen.errors ?? EPOCH),
    // Seen-based like Bugs/Errors (C1): no pre-023 fallback semantics to
    // preserve, so it simply reads as 0 until migration 023 lands.
    seenColumnMissing
      ? ZERO_RESULT
      : service.from('evergreen_baselines').select('id', { count: 'exact', head: true }).gt('updated_at', seen.evergreen ?? EPOCH),
  ])

  if (surveysRes.error && !isMissingTable(surveysRes.error)) {
    console.error('Admin nav-status: surveys query failed:', surveysRes.error)
  }
  if (contactRes.error && !isMissingTable(contactRes.error)) {
    console.error('Admin nav-status: contact query failed:', contactRes.error)
  }
  if (feedbackRes.error && !isMissingTable(feedbackRes.error)) {
    console.error('Admin nav-status: feedback query failed:', feedbackRes.error)
  }
  if (bugsRes.error && !isMissingTable(bugsRes.error)) {
    console.error('Admin nav-status: bugs query failed:', bugsRes.error)
  }
  if (errorsRes.error && !isMissingTable(errorsRes.error)) {
    console.error('Admin nav-status: errors query failed:', errorsRes.error)
  }
  if (evergreenRes.error && !isMissingTable(evergreenRes.error)) {
    console.error('Admin nav-status: evergreen query failed:', evergreenRes.error)
  }

  return NextResponse.json({
    surveyActive: !surveysRes.error && (surveysRes.count ?? 0) > 0,
    contactCount: contactRes.error ? 0 : contactRes.count ?? 0,
    feedbackCount: feedbackRes.error ? 0 : feedbackRes.count ?? 0,
    bugsCount: bugsRes.error ? 0 : bugsRes.count ?? 0,
    errorsCount: errorsRes.error ? 0 : errorsRes.count ?? 0,
    evergreenCount: evergreenRes.error ? 0 : evergreenRes.count ?? 0,
  })
}
