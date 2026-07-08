import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { NextResponse, type NextRequest } from 'next/server'

// ONE aggregate route for the snapshot dashboard's quick-view widgets (Block R2):
// report-cost metrics, latest affiliate links, latest feedback. The /app/admin
// layout gates the PAGE, not this API route — every admin route re-checks
// isAdminEmail itself and only creates the service client AFTER that passes,
// per project ground rules. Sales / stats / graphs keep their own routes; this
// exists so the quick-view widgets don't each need a tiny bespoke endpoint.

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

interface CostBucket {
  totalUsd: number
  count: number
}

function emptyBucket(): CostBucket {
  return { totalUsd: 0, count: 0 }
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

/** Validates a yyyy-mm-dd param; returns null when missing/invalid. */
function parseDateParam(value: string | null): string | null {
  if (value && ISO_DATE_RE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) {
    return value
  }
  return null
}

export async function GET(request: NextRequest) {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)

  // Optional custom cost window — only computed when both bounds are valid.
  let costFrom = parseDateParam(searchParams.get('costFrom'))
  let costTo = parseDateParam(searchParams.get('costTo'))
  if (costFrom && costTo && costFrom > costTo) [costFrom, costTo] = [costTo, costFrom]

  // Only used AFTER the isAdminEmail check above, per project ground rules.
  const service = createServiceClient()

  const now = Date.now()
  const todayStart = `${new Date(now).toISOString().slice(0, 10)}T00:00:00.000Z`
  const hourAgo = new Date(now - HOUR_MS).toISOString()
  const sevenDaysAgo = new Date(now - 7 * DAY_MS).toISOString()
  const thirtyDaysAgo = new Date(now - 30 * DAY_MS).toISOString()

  const customStart = costFrom ? `${costFrom}T00:00:00.000Z` : null
  const customEndExclusive = costTo
    ? new Date(new Date(`${costTo}T00:00:00.000Z`).getTime() + DAY_MS).toISOString()
    : null

  const [costRows, allTimeAvgRows, linksRes, feedbackRes, customRes] = await Promise.all([
    // Last 30 days of completed-report costs — covers the hour/today/7d/30d
    // buckets in one read (volume is low at this stage).
    service
      .from('reports')
      .select('cost_usd, generation_completed_at')
      .gte('generation_completed_at', thirtyDaysAgo)
      .not('cost_usd', 'is', null),
    // All-time cost rows for the "average per report" metric.
    service
      .from('reports')
      .select('cost_usd')
      .not('cost_usd', 'is', null)
      .not('generation_completed_at', 'is', null),
    service
      .from('affiliate_links')
      .select('id, slug, name, target_url, active, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
    service
      .from('report_feedback')
      .select('id, rating, comment, user_id, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
    customStart && customEndExclusive
      ? service
          .from('reports')
          .select('cost_usd, generation_completed_at')
          .gte('generation_completed_at', customStart)
          .lt('generation_completed_at', customEndExclusive)
          .not('cost_usd', 'is', null)
      : Promise.resolve({ data: [] as { cost_usd: number | null; generation_completed_at: string | null }[], error: null }),
  ])

  for (const [label, res] of [
    ['costRows', costRows],
    ['allTimeAvg', allTimeAvgRows],
    ['links', linksRes],
    ['feedback', feedbackRes],
    ['custom', customRes],
  ] as const) {
    if (res.error) console.error(`Admin dashboard: ${label} query failed:`, res.error)
  }

  // --- Cost buckets (empty/zero states render cleanly — everything defaults to 0). ---
  const lastHour = emptyBucket()
  const today = emptyBucket()
  const last7d = emptyBucket()
  const last30d = emptyBucket()

  for (const row of costRows.data ?? []) {
    const cost = row.cost_usd ?? 0
    const at = row.generation_completed_at
    if (!at) continue
    last30d.totalUsd += cost
    last30d.count += 1
    if (at >= sevenDaysAgo) {
      last7d.totalUsd += cost
      last7d.count += 1
    }
    if (at >= todayStart) {
      today.totalUsd += cost
      today.count += 1
    }
    if (at >= hourAgo) {
      lastHour.totalUsd += cost
      lastHour.count += 1
    }
  }

  const allTimeRows = allTimeAvgRows.data ?? []
  const allTimeTotal = allTimeRows.reduce((sum, r) => sum + (r.cost_usd ?? 0), 0)
  const allTimeCount = allTimeRows.length
  const avgPerReportUsd = allTimeCount > 0 ? allTimeTotal / allTimeCount : 0

  let custom: (CostBucket & { from: string; to: string }) | null = null
  if (costFrom && costTo) {
    const bucket = emptyBucket()
    for (const row of customRes.data ?? []) {
      bucket.totalUsd += row.cost_usd ?? 0
      bucket.count += 1
    }
    custom = { from: costFrom, to: costTo, totalUsd: round4(bucket.totalUsd), count: bucket.count }
  }

  // --- Latest affiliate links + their all-time click counts. ---
  const links = linksRes.data ?? []
  const linkIds = links.map(l => l.id)
  const clickCounts = new Map<string, number>()
  if (linkIds.length > 0) {
    const { data: clicks, error: clicksErr } = await service
      .from('affiliate_clicks')
      .select('link_id')
      .in('link_id', linkIds)
    if (clicksErr) console.error('Admin dashboard: clicks query failed:', clicksErr)
    for (const c of clicks ?? []) {
      clickCounts.set(c.link_id, (clickCounts.get(c.link_id) ?? 0) + 1)
    }
  }
  const affiliates = links.map(l => ({
    id: l.id,
    slug: l.slug,
    name: l.name,
    active: l.active,
    createdAt: l.created_at,
    clicks: clickCounts.get(l.id) ?? 0,
  }))

  // --- Latest feedback + display names. ---
  const feedbackRows = feedbackRes.data ?? []
  const userIds = [...new Set(feedbackRows.map(f => f.user_id))]
  const nameById = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: profiles, error: profilesErr } = await service
      .from('profiles')
      .select('id, display_name, username')
      .in('id', userIds)
    if (profilesErr) console.error('Admin dashboard: profiles query failed:', profilesErr)
    for (const p of profiles ?? []) {
      nameById.set(p.id, p.display_name ?? p.username ?? 'Unknown user')
    }
  }
  const feedback = feedbackRows.map(f => ({
    id: f.id,
    rating: f.rating,
    comment: f.comment,
    createdAt: f.created_at,
    displayName: nameById.get(f.user_id) ?? 'Unknown user',
  }))

  // --- Per-model cost breakdown (from _meta.steps in sections JSONB). ---
  const { data: metaRows, error: metaErr } = await service
    .from('reports')
    .select('sections')
    .not('cost_usd', 'is', null)
    .not('generation_completed_at', 'is', null)

  if (metaErr) console.error('Admin dashboard: meta query failed:', metaErr)

  const costByModel: Record<string, number> = {}
  for (const row of metaRows ?? []) {
    const meta = (row.sections as Record<string, unknown>)?._meta as
      | { steps?: Record<string, { model?: string; cost_usd?: number }> }
      | undefined
    if (!meta?.steps) continue
    for (const step of Object.values(meta.steps)) {
      const model = step.model ?? 'unknown'
      costByModel[model] = (costByModel[model] ?? 0) + (step.cost_usd ?? 0)
    }
  }

  const costsByModel = Object.entries(costByModel)
    .map(([model, totalUsd]) => ({ model, totalUsd: round4(totalUsd) }))
    .sort((a, b) => b.totalUsd - a.totalUsd)

  return NextResponse.json({
    costs: {
      lastHour: { totalUsd: round4(lastHour.totalUsd), count: lastHour.count },
      today: { totalUsd: round4(today.totalUsd), count: today.count },
      last7d: { totalUsd: round4(last7d.totalUsd), count: last7d.count },
      last30d: { totalUsd: round4(last30d.totalUsd), count: last30d.count },
      average: { avgPerReportUsd: round4(avgPerReportUsd), count: allTimeCount },
      custom,
      costsByModel,
    },
    affiliates,
    feedback,
  })
}
