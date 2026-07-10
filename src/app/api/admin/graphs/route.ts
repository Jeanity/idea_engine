import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import {
  enumerateUtcDays,
  fillDailySeries,
  fillHourlySeries,
  localDayLabel,
  utcHourLabel,
  UTC_HOUR_LABELS,
  type DailyCount,
} from '@/lib/analytics'
import { NextResponse, type NextRequest } from 'next/server'

// Powers the Dashboard tab's growth graphs (Block 8). Same pattern as every
// other admin route: the /app/admin layout gates the PAGE, not this API
// route — every admin route re-checks isAdminEmail itself, then uses the
// service-role client, per project ground rules.
//
// Day/hour buckets are the ADMIN'S LOCAL calendar days/hours (tz param, see
// parseTzParam below) — NOT UTC. The `from`/`to` request params are already
// local calendar-day labels (period-picker.tsx builds them off the browser's
// local Date fields), so the range and every bucket key line up with what
// the admin actually picked. Reports/signups/sales bucket in JS here using
// `bucketOf`. Sessions/unique-visitors/returning-visitors use per-day Postgres
// RPCs (migration 026, `..._per_local_day`, taking a tz_offset_minutes arg)
// that group on the shifted calendar date; if migration 026 hasn't run yet,
// `perLocalDay` below falls back to the migration-005 UTC-day RPCs queried
// over the literal UTC day range instead of 500ing (see isMissingFunction).

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

/** Browser tz offset in minutes (Date.getTimezoneOffset() semantics: UTC − local,
 *  e.g. Sydney = -600). Clamped to real-world offsets; 0 when missing/invalid. */
function parseTzParam(value: string | null): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(-840, Math.min(840, Math.trunc(n)))
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

// Postgres 42703 = undefined_column, PostgREST PGRST204 = "column not found
// in schema cache" — both mean migration 015 (teaser_completed_at) hasn't
// been run in this environment yet.
function isMissingColumn(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42703' || error?.code === 'PGRST204'
}

// Postgres 42883 = undefined_function, PostgREST PGRST202 = "function not
// found in schema cache" — both mean migration 026 (the `..._per_local_day`
// RPCs) hasn't been run in this environment yet.
function isMissingFunction(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42883' || error?.code === 'PGRST202'
}

interface ReportRow {
  owner_id: string | null
  sections: unknown
  generation_completed_at: string | null
  teaser_completed_at: string | null
  cost_usd: number | null
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
  const tz = parseTzParam(searchParams.get('tz'))

  // Single-day ranges bucket by HOUR (24 buckets, 'HH:00') instead of one
  // lonely day point. The `day` field name is kept in the payload for both
  // granularities so chart components need no data-shape changes.
  //
  // Every bucket — hourly or daily — runs in the ADMIN'S LOCAL timezone (tz
  // param): a day starts at local midnight and buckets are local hours/days,
  // so "today"/"yesterday" etc. read local wall-clock instead of whatever UTC
  // midnight happens to be locally.
  const hourly = from === to
  const tzShiftMs = tz * 60000

  // Literal (UTC, tz-independent) day boundaries of the requested range. Day
  // LABELS are just the from/to calendar dates verbatim — tz only decides
  // which INSTANTS map into each label. Also doubles as the fallback query
  // range for the migration-005 UTC-day RPCs (see perLocalDay below): querying
  // this exact UTC-aligned range against a UTC-day-grouping RPC reproduces the
  // pre-026 behaviour exactly, so the fallback rows line up with bucketKeys
  // with no dropped/misattributed counts.
  const fromDayLiteral = new Date(Date.parse(`${from}T00:00:00.000Z`))
  const toDayLiteral = new Date(Date.parse(`${to}T00:00:00.000Z`))
  const utcRangeStart = fromDayLiteral.toISOString()
  const utcRangeEndExclusive = new Date(toDayLiteral.getTime() + 24 * 60 * 60 * 1000).toISOString()

  // Instant range actually queried: shifted by tz so the hour/day boundaries
  // align with the admin's local midnight.
  const fromDate = new Date(fromDayLiteral.getTime() + tzShiftMs)
  const toDate = new Date(toDayLiteral.getTime() + tzShiftMs)
  const rangeStart = fromDate.toISOString()
  const rangeEndExclusive = new Date(toDate.getTime() + 24 * 60 * 60 * 1000).toISOString()

  /** Local-hour label of a UTC instant (identity when tz=0). */
  const localHourLabel = (at: Date) => utcHourLabel(new Date(at.getTime() - tz * 60000))
  const bucketOf = (at: Date) => (hourly ? localHourLabel(at) : localDayLabel(at, tz))
  const bucketKeys = hourly ? UTC_HOUR_LABELS : enumerateUtcDays(fromDayLiteral, toDayLiteral)

  // Only used AFTER the isAdminEmail check above, per project ground rules.
  const service = createServiceClient()

  // The per-day RPCs can't bucket by hour, so hourly mode skips them and
  // aggregates page_events directly (below) — volumes for one day are small.
  const emptyDaily = () =>
    Promise.resolve({ data: [] as { day: string; count: number }[] | null, error: null })

  // Calls the migration-026 local-day RPC (buckets by the admin's local
  // calendar day via tz_offset_minutes). Falls back to the migration-005
  // UTC-day RPC — queried over the LITERAL UTC day range, see utcRangeStart
  // above — if 026 hasn't been run yet, so this route degrades to the
  // pre-026 (UTC-day) behaviour for these three metrics instead of 500ing.
  async function perLocalDay(
    localFn:
      | 'analytics_sessions_per_local_day'
      | 'analytics_unique_visitors_per_local_day'
      | 'analytics_returning_visitors_per_local_day',
    utcFn: 'analytics_sessions_per_day' | 'analytics_unique_visitors_per_day' | 'analytics_returning_visitors_per_day'
  ) {
    const res = await service.rpc(localFn, {
      from_ts: rangeStart,
      to_ts: rangeEndExclusive,
      tz_offset_minutes: tz,
    })
    if (isMissingFunction(res.error)) {
      return service.rpc(utcFn, { from_ts: utcRangeStart, to_ts: utcRangeEndExclusive })
    }
    // Any other error is logged by the generic loop over Promise.all results
    // below, same as every other query in this route.
    return res
  }

  // Broadened to EITHER timestamp landing in range: an upgraded row's
  // generation_completed_at moves to the full-report completion date, which
  // can fall outside the period being queried for its teaser event (see
  // migration 015). Falls back to the pre-migration query/shape when
  // teaser_completed_at doesn't exist yet so this route never breaks.
  async function fetchReportRows(): Promise<{ rows: ReportRow[]; hasTeaserColumn: boolean }> {
    const res = await service
      .from('reports')
      .select('owner_id, sections, teaser_completed_at, generation_completed_at, cost_usd')
      .or(
        `and(teaser_completed_at.gte.${rangeStart},teaser_completed_at.lt.${rangeEndExclusive}),` +
        `and(generation_completed_at.gte.${rangeStart},generation_completed_at.lt.${rangeEndExclusive})`
      )

    if (isMissingColumn(res.error)) {
      const fallback = await service
        .from('reports')
        .select('owner_id, sections, generation_completed_at, cost_usd')
        .gte('generation_completed_at', rangeStart)
        .lt('generation_completed_at', rangeEndExclusive)
      if (fallback.error) console.error('Admin graphs: reports fallback query failed:', fallback.error)
      return {
        rows: (fallback.data ?? []).map(r => ({ ...r, teaser_completed_at: null })),
        hasTeaserColumn: false,
      }
    }

    if (res.error) console.error('Admin graphs: reports query failed:', res.error)
    return { rows: res.data ?? [], hasTeaserColumn: true }
  }

  const [
    sessionsRes,
    uniqueVisitorsRes,
    returningVisitorsRes,
    topReferrersRes,
    topCampaignsRes,
    reportsFetch,
    signupsRes,
    purchasesRes,
  ] = await Promise.all([
    hourly ? emptyDaily() : perLocalDay('analytics_sessions_per_local_day', 'analytics_sessions_per_day'),
    hourly ? emptyDaily() : perLocalDay('analytics_unique_visitors_per_local_day', 'analytics_unique_visitors_per_day'),
    hourly ? emptyDaily() : perLocalDay('analytics_returning_visitors_per_local_day', 'analytics_returning_visitors_per_day'),
    service.rpc('analytics_top_referrers', { from_ts: rangeStart, to_ts: rangeEndExclusive, max_rows: MAX_TOP_ROWS }),
    service.rpc('analytics_top_utm_campaigns', { from_ts: rangeStart, to_ts: rangeEndExclusive, max_rows: MAX_TOP_ROWS }),
    fetchReportRows(),
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
    ['signups', signupsRes],
    ['purchases', purchasesRes],
  ] as const) {
    if (res.error) console.error(`Admin graphs: ${label} query failed:`, res.error)
  }

  // --- Traffic series (gap-filled to zero across the range) ---

  let sessionsSeries: DailyCount[]
  let uniqueVisitorsSeries: DailyCount[]
  let returningVisitorsSeries: DailyCount[]

  if (hourly) {
    // Aggregate the day's raw events per UTC hour. Sessions/visitors are
    // distinct-counted per hour (same semantics as the per-day RPCs, narrower
    // bucket). "Returning" = the visitor has any event before this day.
    const { data: events, error: eventsErr } = await service
      .from('page_events')
      .select('occurred_at, session_id, visitor_id')
      .gte('occurred_at', rangeStart)
      .lt('occurred_at', rangeEndExclusive)
      .limit(50000)
    if (eventsErr) console.error('Admin graphs: hourly page_events query failed:', eventsErr)

    const sessionsByHour = new Map<string, Set<string>>()
    const visitorsByHour = new Map<string, Set<string>>()
    const dayVisitors = new Set<string>()
    for (const ev of events ?? []) {
      const hour = localHourLabel(new Date(ev.occurred_at))
      if (!sessionsByHour.has(hour)) sessionsByHour.set(hour, new Set())
      sessionsByHour.get(hour)!.add(ev.session_id)
      if (ev.visitor_id) {
        if (!visitorsByHour.has(hour)) visitorsByHour.set(hour, new Set())
        visitorsByHour.get(hour)!.add(ev.visitor_id)
        dayVisitors.add(ev.visitor_id)
      }
    }

    const returningSet = new Set<string>()
    // .in() guard: cap the lookup list; ample at current volumes, and an
    // undercount here only under-reports "returning" for a single day.
    const visitorList = [...dayVisitors].slice(0, 1000)
    if (visitorList.length > 0) {
      const { data: prior, error: priorErr } = await service
        .from('page_events')
        .select('visitor_id')
        .in('visitor_id', visitorList)
        .lt('occurred_at', rangeStart)
        .limit(50000)
      if (priorErr) console.error('Admin graphs: hourly returning-visitor query failed:', priorErr)
      for (const row of prior ?? []) if (row.visitor_id) returningSet.add(row.visitor_id)
    }

    const distinctCounts = (m: Map<string, Set<string>>) =>
      new Map([...m].map(([hour, set]) => [hour, set.size]))
    sessionsSeries = fillHourlySeries(distinctCounts(sessionsByHour))
    uniqueVisitorsSeries = fillHourlySeries(distinctCounts(visitorsByHour))
    const returningByHour = new Map<string, number>()
    for (const [hour, set] of visitorsByHour) {
      returningByHour.set(hour, [...set].filter(v => returningSet.has(v)).length)
    }
    returningVisitorsSeries = fillHourlySeries(returningByHour)
  } else {
    // fromDayLiteral/toDayLiteral (not the tz-shifted fromDate/toDate) — the
    // RPC rows are already keyed by calendar-day label (local via migration
    // 026, or UTC-fallback-but-range-aligned via perLocalDay), matching
    // bucketKeys, which is also built off the literal dates.
    sessionsSeries = fillDailySeries(
      (sessionsRes.data ?? []).map(r => ({ day: r.day, count: Number(r.count) })),
      fromDayLiteral,
      toDayLiteral
    )
    uniqueVisitorsSeries = fillDailySeries(
      (uniqueVisitorsRes.data ?? []).map(r => ({ day: r.day, count: Number(r.count) })),
      fromDayLiteral,
      toDayLiteral
    )
    returningVisitorsSeries = fillDailySeries(
      (returningVisitorsRes.data ?? []).map(r => ({ day: r.day, count: Number(r.count) })),
      fromDayLiteral,
      toDayLiteral
    )
  }

  const traffic = sessionsSeries.map((row, i) => ({
    day: row.day,
    sessions: row.count,
    uniqueVisitors: uniqueVisitorsSeries[i]?.count ?? 0,
  }))

  const reportRows = reportsFetch.rows
  // A single row can contribute BOTH an initial and a full event, possibly to
  // different buckets: initial is keyed on teaser_completed_at (the initial
  // report's own completion), full is keyed on generation_completed_at (only
  // meaningful for rows that are actually full reports). See migration 015 —
  // before it exists, hasTeaserColumn is false and teaser_completed_at is
  // null on every row, so this collapses to the old row-state-based split.
  const inGenerationRange = (iso: string | null) => !!iso && iso >= rangeStart && iso < rangeEndExclusive
  const initialByDay = new Map<string, number>()
  const fullByDay = new Map<string, number>()
  for (const row of reportRows) {
    if (reportsFetch.hasTeaserColumn && row.teaser_completed_at && inGenerationRange(row.teaser_completed_at)) {
      const day = bucketOf(new Date(row.teaser_completed_at))
      initialByDay.set(day, (initialByDay.get(day) ?? 0) + 1)
    }
    if (!inGenerationRange(row.generation_completed_at)) continue
    if (isFullReport(row.sections)) {
      const day = bucketOf(new Date(row.generation_completed_at as string))
      fullByDay.set(day, (fullByDay.get(day) ?? 0) + 1)
    } else if (!reportsFetch.hasTeaserColumn) {
      // Pre-migration fallback only — post-migration, teaser-only rows are
      // already counted above via teaser_completed_at.
      const day = bucketOf(new Date(row.generation_completed_at as string))
      initialByDay.set(day, (initialByDay.get(day) ?? 0) + 1)
    }
  }
  const reports = bucketKeys.map(day => ({
    day,
    initial: initialByDay.get(day) ?? 0,
    full: fullByDay.get(day) ?? 0,
  }))

  const signupRows = signupsRes.data ?? []
  const signupCounts = new Map<string, number>()
  for (const row of signupRows) {
    const day = bucketOf(new Date(row.created_at))
    signupCounts.set(day, (signupCounts.get(day) ?? 0) + 1)
  }
  const signups: DailyCount[] = bucketKeys.map(day => ({ day, count: signupCounts.get(day) ?? 0 }))

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
    const day = bucketOf(new Date(row.completed_at))
    revenueByDay.set(day, (revenueByDay.get(day) ?? 0) + row.amount_cents)
  }
  // Cost stays keyed on generation_completed_at (semantically unchanged) —
  // the fetch above is broadened to also match on teaser_completed_at, so an
  // explicit in-range check is needed here to exclude rows that matched only
  // via their teaser event.
  const costByDay = new Map<string, number>()
  for (const row of reportRows) {
    if (!row.cost_usd || !inGenerationRange(row.generation_completed_at)) continue
    const day = bucketOf(new Date(row.generation_completed_at as string))
    costByDay.set(day, (costByDay.get(day) ?? 0) + row.cost_usd)
  }
  const sales = bucketKeys.map(day => {
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
    // Funnel attribution stays on generation_completed_at (semantically
    // unchanged) — exclude rows that only matched the broadened fetch via
    // their teaser event.
    if (!row.owner_id || !inGenerationRange(row.generation_completed_at)) continue
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
    granularity: hourly ? 'hour' : 'day',
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
