import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { NextResponse, type NextRequest } from 'next/server'

// Powers the admin Dashboard tab (src/app/app/admin/dashboard-client.tsx).
// The /app/admin layout gates the PAGE, not this API route — every admin
// route re-checks isAdminEmail itself, per project ground rules.

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Validates a yyyy-mm-dd param; falls back to today (UTC) if missing/invalid. */
function parseDateParam(value: string | null): string {
  if (value && ISO_DATE_RE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) {
    return value
  }
  return todayUTC()
}

// Full report = sections populated with a `competitors` key, same rule as
// reportDisplayState() in src/app/app/account/page.tsx. Anything else with
// generation_completed_at set is an initial (teaser) report.
function isFullReport(sections: unknown): boolean {
  return (
    !!sections &&
    typeof sections === 'object' &&
    Object.keys(sections as Record<string, unknown>).length > 0 &&
    (sections as Record<string, unknown>).competitors !== undefined
  )
}

export async function GET(request: NextRequest) {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  let from = parseDateParam(searchParams.get('from'))
  let to = parseDateParam(searchParams.get('to'))
  // Guard against an inverted range (e.g. a stale custom picker state).
  if (from > to) [from, to] = [to, from]

  const rangeStart = `${from}T00:00:00.000Z`
  const rangeEndExclusive = new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000).toISOString()
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

  // Only used AFTER the isAdminEmail check above, per project ground rules.
  const service = createServiceClient()

  const [usersOnlineRes, reportsLiveRes, completedReportsRes, ideasCreatedRes, signupsRes] = await Promise.all([
    service.from('profiles').select('id', { count: 'exact', head: true }).gt('last_seen_at', fiveMinAgo),
    service.from('reports').select('id', { count: 'exact', head: true }).in('status', ['queued', 'running']),
    service
      .from('reports')
      .select('sections, preview_sections')
      .gte('generation_completed_at', rangeStart)
      .lt('generation_completed_at', rangeEndExclusive),
    service
      .from('ideas')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', rangeStart)
      .lt('created_at', rangeEndExclusive),
    service
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', rangeStart)
      .lt('created_at', rangeEndExclusive),
  ])

  for (const [label, res] of [
    ['usersOnline', usersOnlineRes],
    ['reportsLive', reportsLiveRes],
    ['completedReports', completedReportsRes],
    ['ideasCreated', ideasCreatedRes],
    ['signups', signupsRes],
  ] as const) {
    if (res.error) console.error(`Admin stats: ${label} query failed:`, res.error)
  }

  // Empty/zero states render gracefully — every count below defaults to 0
  // rather than throwing if a query errors (e.g. analytics columns not yet
  // migrated in some environment).
  const completedRows = completedReportsRes.data ?? []
  const full = completedRows.filter(r => isFullReport(r.sections)).length
  const initial = completedRows.length - full

  return NextResponse.json({
    usersOnline: usersOnlineRes.count ?? 0,
    reportsLive: reportsLiveRes.count ?? 0,
    reportsCompleted: { initial, full },
    ideasCreated: ideasCreatedRes.count ?? 0,
    signups: signupsRes.count ?? 0,
    range: { from, to },
  })
}
