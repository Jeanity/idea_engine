import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { enumerateUtcDays, fillDailySeries, utcDay, type DailyCount } from '@/lib/analytics'
import { NextResponse, type NextRequest } from 'next/server'

// Powers the Dashboard tab's growth graphs (Block 8). Same pattern as every
// other admin route: the /app/admin layout gates the PAGE, not this API
// route — every admin route re-checks isAdminEmail itself, then uses the
// service-role client, per project ground rules.
//
// All day buckets are UTC calendar days (see period-picker.tsx / analytics.ts
// notes) so this stays aligned with the dashboard stat tiles and the Block 2
// aggregation RPCs, which group on `(occurred_at at time zone 'UTC')::date`.

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_TOP_ROWS = 15

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
// reportDisplayState() in src/app/app/account/page.tsx and the Block 3 stats
// route. Anything else with generation_completed_at set is an initial report.
function isFullReport(sections: unknown): boolean {
  return (
    !!sections &&
    typeof sections === 'object' &&
    Object.keys(sections as Record<string, unknown>).length > 0 &&
    (sections as Record<string, unknown>).competitors !== undefined
  )
}

interface Acquisition {
  referrer?: string | null
  utm?: { source?: string; campaign?: string } | null
}

// Mirrors the Postgres regex in analytics_top_referrers (migration 005):
// `substring(referrer from '^[a-z]+://([^/]+)')`, falling back to the raw
// referrer string when the scheme doesn't match (lowercase scheme only, same
// as the RPC — kept identical so the two sides group referrers the same way).
const SCHEME_HOST_RE = /^[a-z]+:\/\/([^/]+)/
function referrerHost(referrer: string | null | undefined): string | null {
  if (!referrer) return null
  const match = referrer.match(SCHEME_HOST_RE)
  return match ? match[1] : referrer
}

function parseAcquisition(raw: unknown): Acquisition | null {
  if (!raw || typeof raw !== 'object') return null
  return raw as Acquisition
}

interface FunnelRow {
  sessions: number
  signups: number
  reports: number
  purchases: number
}

function emptyFunnelRow(): FunnelRow {
  return { sessions: 0, signups: 0, reports: 0, purchases: 0 }
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

  const fromDate = new Date(`${from}T00:00:00.000Z`)
  const toDate = new Date(`${to}T00:00:00.000Z`)
  const rangeStart = fromDate.toISOString()
  const rangeEndExclusive = new Date(toDate.getTime() + 24 * 60 * 60 * 1000).toISOString()

  // Only used AFTER the isAdminEmail check above, per project ground rules.
  const service = createServiceClient()

  const [
    sessionsRes,
    uniqueVisitorsRes,
    returningVisitorsRes,
    topReferrersRes,
    topCampaignsRes,
    reportsRes,
    signupsRes,
    purchasesRes,
  ] = await Promise.all([
    service.rpc('analytics_sessions_per_day', { from_ts: rangeStart, to_ts: rangeEndExclusive }),
    service.rpc('analytics_unique_visitors_per_day', { from_ts: rangeStart, to_ts: rangeEndExclusive }),
    service.rpc('analytics_returning_visitors_per_day', { from_ts: rangeStart, to_ts: rangeEndExclusive }),
    service.rpc('analytics_top_referrers', { from_ts: rangeStart, to_ts: rangeEndExclusive, max_rows: MAX_TOP_ROWS }),
    service.rpc('analytics_top_utm_campaigns', { from_ts: rangeStart, to_ts: rangeEndExclusive, max_rows: MAX_TOP_ROWS }),
    service
      .from('reports')
      .select('owner_id, sections, generation_completed_at, cost_usd')
      .gte('generation_completed_at', rangeStart)
      .lt('generation_completed_at', rangeEndExclusive),
    service
      .from('profiles')
      .select('id, created_at, acquisition')
      .gte('created_at', rangeStart)
      .lt('created_at', rangeEndExclusive),
    service
      .from('purchases')
      .select('user_id, amount_cents, currency, completed_at')
      .eq('status', 'complete')
      .gte('completed_at', rangeStart)
      .lt('completed_at', rangeEndExclusive),
  ])

  for (const [label, res] of [
    ['sessions', sessionsRes],
    ['uniqueVisitors', uniqueVisitorsRes],
    ['returningVisitors', returningVisitorsRes],
    ['topReferrers', topReferrersRes],
    ['topCampaigns', topCampaignsRes],
    ['reports', reportsRes],
    ['signups', signupsRes],
    ['purchases', purchasesRes],
  ] as const) {
    if (res.error) console.error(`Admin graphs: ${label} query failed:`, res.error)
  }

  // --- Daily series (all gap-filled to zero across the range) ---

  const sessionsSeries = fillDailySeries(
    (sessionsRes.data ?? []).map(r => ({ day: r.day, count: Number(r.count) })),
    fromDate,
    toDate
  )
  const uniqueVisitorsSeries = fillDailySeries(
    (uniqueVisitorsRes.data ?? []).map(r => ({ day: r.day, count: Number(r.count) })),
    fromDate,
    toDate
  )
  const returningVisitorsSeries = fillDailySeries(
    (returningVisitorsRes.data ?? []).map(r => ({ day: r.day, count: Number(r.count) })),
    fromDate,
    toDate
  )

  const traffic = sessionsSeries.map((row, i) => ({
    day: row.day,
    sessions: row.count,
    uniqueVisitors: uniqueVisitorsSeries[i]?.count ?? 0,
  }))

  const reportRows = reportsRes.data ?? []
  const initialByDay = new Map<string, number>()
  const fullByDay = new Map<string, number>()
  for (const row of reportRows) {
    if (!row.generation_completed_at) continue
    const day = utcDay(new Date(row.generation_completed_at))
    if (isFullReport(row.sections)) {
      fullByDay.set(day, (fullByDay.get(day) ?? 0) + 1)
    } else {
      initialByDay.set(day, (initialByDay.get(day) ?? 0) + 1)
    }
  }
  const reportDays = enumerateUtcDays(fromDate, toDate)
  const reports = reportDays.map(day => ({
    day,
    initial: initialByDay.get(day) ?? 0,
    full: fullByDay.get(day) ?? 0,
  }))

  const signupRows = signupsRes.data ?? []
  const signupsByDay: DailyCount[] = []
  {
    const counts = new Map<string, number>()
    for (const row of signupRows) {
      const day = utcDay(new Date(row.created_at))
      counts.set(day, (counts.get(day) ?? 0) + 1)
    }
    for (const [day, count] of counts) signupsByDay.push({ day, count })
  }
  const signups = fillDailySeries(signupsByDay, fromDate, toDate)

  // Sales & margin per day — USD-first (per Block 7 precedent): only 'usd'
  // purchases feed the daily revenue series; other currencies are excluded
  // here rather than incorrectly summed as if 1:1 with USD. The Sales tab
  // (Block 7) is the source of truth for full per-currency totals.
  const purchaseRows = purchasesRes.data ?? []
  const revenueByDay = new Map<string, number>()
  let hasNonUsd = false
  for (const row of purchaseRows) {
    if (!row.completed_at) continue
    if (row.currency.toLowerCase() !== 'usd') {
      hasNonUsd = true
      continue
    }
    const day = utcDay(new Date(row.completed_at))
    revenueByDay.set(day, (revenueByDay.get(day) ?? 0) + row.amount_cents)
  }
  const costByDay = new Map<string, number>()
  for (const row of reportRows) {
    if (!row.generation_completed_at || !row.cost_usd) continue
    const day = utcDay(new Date(row.generation_completed_at))
    costByDay.set(day, (costByDay.get(day) ?? 0) + row.cost_usd)
  }
  const salesDays = enumerateUtcDays(fromDate, toDate)
  const sales = salesDays.map(day => {
    const revenueUsd = Math.round((revenueByDay.get(day) ?? 0)) / 100
    const costUsd = Math.round((costByDay.get(day) ?? 0) * 10000) / 10000
    return { day, revenueUsd, costUsd, marginUsd: Math.round((revenueUsd - costUsd) * 100) / 100 }
  })

  // --- Referrers / campaigns conversion table ---
  //
  // Approximation note: "sessions" and "signups" are both scoped to the
  // selected period (sessions from page_events, signups from
  // profiles.created_at). "reports" and "purchases" are also period-scoped
  // by their own timestamp (generation_completed_at / completed_at), but are
  // attributed using the ACTING USER'S all-time first-touch acquisition —
  // e.g. a report generated today by someone who signed up via a campaign
  // last month counts under that campaign today, even though the signup
  // itself won't appear in this period's signups column. This is the
  // standard "attribution vs. activity window" tradeoff and is called out in
  // the UI rather than hidden.

  const ownerIds = [...new Set(reportRows.map(r => r.owner_id).filter((id): id is string => !!id))]
  const purchaserIds = [...new Set(purchaseRows.map(p => p.user_id).filter((id): id is string => !!id))]
  const acquisitionLookupIds = [...new Set([...ownerIds, ...purchaserIds])]

  const acquisitionById = new Map<string, Acquisition | null>()
  for (const row of signupRows) acquisitionById.set(row.id, parseAcquisition(row.acquisition))

  const missingIds = acquisitionLookupIds.filter(id => !acquisitionById.has(id))
  if (missingIds.length > 0) {
    const { data: extraProfiles, error: extraErr } = await service
      .from('profiles')
      .select('id, acquisition')
      .in('id', missingIds)
    if (extraErr) {
      console.error('Admin graphs: acquisition lookup failed:', extraErr)
    } else {
      for (const row of extraProfiles ?? []) acquisitionById.set(row.id, parseAcquisition(row.acquisition))
    }
  }

  const referrerTable = new Map<string, FunnelRow>()
  for (const row of topReferrersRes.data ?? []) {
    const key = row.referrer_host ?? '(unknown)'
    referrerTable.set(key, { ...emptyFunnelRow(), sessions: Number(row.count) })
  }
  const campaignTable = new Map<string, FunnelRow & { source: string | null; campaign: string | null }>()
  for (const row of topCampaignsRes.data ?? []) {
    const key = `${row.source ?? ''}::${row.campaign ?? ''}`
    campaignTable.set(key, {
      ...emptyFunnelRow(),
      sessions: Number(row.count),
      source: row.source ?? null,
      campaign: row.campaign ?? null,
    })
  }

  function addSignupOrDownstream(
    acquisition: Acquisition | null,
    field: 'signups' | 'reports' | 'purchases'
  ) {
    if (!acquisition) return
    const host = referrerHost(acquisition.referrer)
    if (host && referrerTable.has(host)) {
      referrerTable.get(host)![field] += 1
    }
    const campaign = acquisition.utm?.campaign
    if (campaign) {
      const key = `${acquisition.utm?.source ?? ''}::${campaign}`
      if (campaignTable.has(key)) {
        campaignTable.get(key)![field] += 1
      }
    }
  }

  for (const row of signupRows) addSignupOrDownstream(parseAcquisition(row.acquisition), 'signups')
  for (const row of reportRows) {
    if (!row.owner_id) continue
    addSignupOrDownstream(acquisitionById.get(row.owner_id) ?? null, 'reports')
  }
  for (const row of purchaseRows) {
    addSignupOrDownstream(acquisitionById.get(row.user_id) ?? null, 'purchases')
  }

  const topReferrers = [...referrerTable.entries()]
    .map(([referrerHost, funnel]) => ({ referrerHost, ...funnel }))
    .sort((a, b) => b.sessions - a.sessions)

  const topCampaigns = [...campaignTable.values()]
    .sort((a, b) => b.sessions - a.sessions)

  return NextResponse.json({
    range: { from, to },
    traffic,
    returningVisitors: returningVisitorsSeries,
    reports,
    signups,
    sales,
    salesCaveat: hasNonUsd
      ? 'Non-USD purchases exist in this period and are excluded from the chart above — see the Sales tab for full per-currency totals.'
      : null,
    topReferrers,
    topCampaigns,
  })
}
