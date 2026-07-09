'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Users, FileText, UserPlus, DollarSign, Cpu, ArrowUpRight, Handshake } from 'lucide-react'
import { StatCard, WidgetCard } from '@/components/admin'
import { PeriodPicker, rangeForPreset, type PeriodRange } from './period-picker'
import { GrowthGraphs } from './growth-graphs'
import { DashboardGrid, type WidgetDef } from './dashboard-grid'
import { OverviewChart, type OverviewPoint } from './overview-chart'
import { ReportCostsWidget, type CostsData, type ModelCostEntry } from './report-costs-widget'
import { TodaysSalesWidget } from './todays-sales-widget'

const LIVE_POLL_MS = 30_000

interface StatsPayload {
  usersOnline: number
  reportsLive: number
  reportsCompleted: { initial: number; full: number }
  ideasCreated: number
  signups: number
}

interface GraphsPayload {
  granularity?: 'hour' | 'day'
  traffic: { day: string; sessions: number }[]
  reports: { day: string; initial: number; full: number }[]
  signups: { day: string; count: number }[]
  sales: { day: string; revenueUsd: number; costUsd: number }[]
}

interface SalesPayload {
  revenueByCurrency: Record<string, number>
  primaryCurrency: string
}

interface DashboardPayload {
  costs: CostsData
  affiliates: { id: string; slug: string; name: string; active: boolean; clicks: number }[]
  feedback: { id: string; rating: number; comment: string | null; displayName: string; createdAt: string }[]
}

/** First-half vs second-half % change over a daily series (null when undefined). */
function seriesDelta(series: number[]): number | undefined {
  if (series.length < 4) return undefined
  const mid = Math.floor(series.length / 2)
  const first = series.slice(0, mid).reduce((a, b) => a + b, 0)
  const second = series.slice(mid).reduce((a, b) => a + b, 0)
  if (first === 0) return second > 0 ? 100 : undefined
  return ((second - first) / first) * 100
}

function fmtUsd(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

/** AI costs are fractions of a cent per report — always show 4 decimals. */
function fmtCostUsd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(n)
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} viewBox="0 0 20 20" className={`h-3 w-3 ${i <= rating ? 'fill-amber-400' : 'fill-white/10 light:fill-gray-200'}`}>
          <path d="M10 1.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L1.6 7.6l5.8-.8z" />
        </svg>
      ))}
    </span>
  )
}

const DONUT_COLORS = ['#818cf8', '#34d399']
const MODEL_DONUT_COLORS = ['#fbbf24', '#818cf8', '#34d399', '#f472b6', '#22d3ee', '#fb923c']

function ReportTypesDonut({ initial, full }: { initial: number; full: number }) {
  const total = initial + full
  const data = [
    { name: 'Initial', value: initial },
    { name: 'Full', value: full },
  ]
  return (
    <WidgetCard title="Report types" subtitle="Initial vs. full, selected period">
      {total === 0 ? (
        <div className="flex h-[180px] items-center justify-center text-xs text-slate-500 light:text-gray-400">
          No reports in this range yet.
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <div style={{ width: 128, height: 128 }} className="shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" innerRadius={40} outerRadius={60} paddingAngle={2} stroke="none" isAnimationActive={false}>
                  {data.map((_, i) => (
                    <Cell key={i} fill={DONUT_COLORS[i]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="min-w-0 space-y-2">
            {data.map((d, i) => (
              <div key={d.name} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: DONUT_COLORS[i] }} aria-hidden="true" />
                <span className="text-sm text-slate-300 light:text-gray-700">{d.name}</span>
                <span className="ml-auto text-sm font-semibold text-white light:text-gray-900">{d.value}</span>
                <span className="w-10 text-right text-xs text-slate-500 light:text-gray-400">
                  {Math.round((d.value / total) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </WidgetCard>
  )
}

function shortModelName(model: string): string {
  return model
    .replace('claude-', '')
    .replace(/-\d{8}$/, '')
}

function MiniDonut({ label, entries, colors }: { label: string; entries: ModelCostEntry[]; colors: string[] }) {
  const total = entries.reduce((sum, e) => sum + e.totalUsd, 0)
  if (total === 0) {
    return (
      <div className="flex-1">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-500 light:text-gray-400">{label}</p>
        <p className="text-xs text-slate-500 light:text-gray-400">No data yet.</p>
      </div>
    )
  }
  return (
    <div className="flex-1 min-w-0">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-500 light:text-gray-400">{label}</p>
      <div className="flex items-center gap-3">
        <div style={{ width: 80, height: 80 }} className="shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={entries} dataKey="totalUsd" innerRadius={26} outerRadius={38} paddingAngle={2} stroke="none" isAnimationActive={false}>
                {entries.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="min-w-0 space-y-1">
          {entries.map((d, i) => (
            <div key={d.model} className="flex items-center gap-1.5">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colors[i % colors.length] }} aria-hidden="true" />
              <span className="truncate text-[11px] text-slate-300 light:text-gray-700">{shortModelName(d.model)}</span>
              <span className="ml-auto text-[11px] font-semibold text-white light:text-gray-900">{fmtCostUsd(d.totalUsd)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const INITIAL_DONUT_COLORS = ['#818cf8', '#34d399', '#f472b6', '#22d3ee']
const FULL_DONUT_COLORS = ['#fbbf24', '#818cf8', '#34d399', '#f472b6', '#22d3ee', '#fb923c']

function AiCostByModelDonut({ data }: { data: { initial: ModelCostEntry[]; full: ModelCostEntry[] } | null }) {
  const hasAny = data && ([...data.initial, ...data.full].some(e => e.totalUsd > 0))
  return (
    <WidgetCard title="AI cost by model" subtitle="Initial vs. full spend, selected period">
      {!data || !hasAny ? (
        <div className="flex h-[180px] items-center justify-center text-xs text-slate-500 light:text-gray-400">
          No AI cost data yet.
        </div>
      ) : (
        <div className="flex gap-4">
          <MiniDonut label="Initial" entries={data.initial} colors={INITIAL_DONUT_COLORS} />
          <div className="w-px self-stretch bg-white/10 light:bg-gray-200" />
          <MiniDonut label="Full" entries={data.full} colors={FULL_DONUT_COLORS} />
        </div>
      )}
    </WidgetCard>
  )
}

function LatestAffiliates({ rows }: { rows: DashboardPayload['affiliates'] | null }) {
  const action = (
    <Link href="/app/admin/affiliates" className="inline-flex items-center gap-0.5 text-xs font-medium text-indigo-300 hover:text-indigo-200 light:text-indigo-600 light:hover:text-indigo-700">
      All <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
    </Link>
  )
  return (
    <WidgetCard title="Latest affiliate links" action={action} bodyClassName="px-5 pb-5 pt-1">
      {!rows ? (
        <p className="py-6 text-center text-xs text-slate-500 light:text-gray-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-xs text-slate-500 light:text-gray-400">No affiliate links yet.</p>
      ) : (
        <ul className="divide-y divide-white/5 light:divide-gray-100">
          {rows.map(r => (
            <li key={r.id} className="flex items-center gap-3 py-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-300 light:bg-indigo-50 light:text-indigo-600">
                <Handshake className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-200 light:text-gray-800">{r.name}</p>
                <p className="truncate text-xs text-slate-500 light:text-gray-400">/{r.slug}</p>
              </div>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-semibold text-white light:text-gray-900">{r.clicks}</span>
                <span className="block text-[11px] text-slate-500 light:text-gray-400">clicks</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  )
}

function LatestFeedback({ rows }: { rows: DashboardPayload['feedback'] | null }) {
  const action = (
    <Link href="/app/admin/feedback" className="inline-flex items-center gap-0.5 text-xs font-medium text-indigo-300 hover:text-indigo-200 light:text-indigo-600 light:hover:text-indigo-700">
      All <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
    </Link>
  )
  return (
    <WidgetCard title="Latest feedback" action={action} bodyClassName="px-5 pb-5 pt-1">
      {!rows ? (
        <p className="py-6 text-center text-xs text-slate-500 light:text-gray-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-xs text-slate-500 light:text-gray-400">No feedback yet.</p>
      ) : (
        <ul className="divide-y divide-white/5 light:divide-gray-100">
          {rows.map(f => (
            <li key={f.id} className="py-2.5">
              <div className="flex items-center gap-2">
                <Stars rating={f.rating} />
                <span className="truncate text-xs font-medium text-slate-300 light:text-gray-700">{f.displayName}</span>
                <span className="ml-auto shrink-0 text-[11px] text-slate-500 light:text-gray-400">
                  {new Date(f.createdAt).toLocaleDateString()}
                </span>
              </div>
              {f.comment && (
                <p className="mt-1 line-clamp-2 text-xs text-slate-400 light:text-gray-500">{f.comment}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  )
}

export function DashboardClient({ adminId, initialLayout }: { adminId: string; initialLayout?: unknown }) {
  const [period, setPeriod] = useState<PeriodRange>(() => rangeForPreset('today'))
  const [stats, setStats] = useState<StatsPayload | null>(null)
  const [graphs, setGraphs] = useState<GraphsPayload | null>(null)
  const [sales, setSales] = useState<SalesPayload | null>(null)
  const [dash, setDash] = useState<DashboardPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback((from: string, to: string) => {
    fetch(`/api/admin/stats?from=${from}&to=${to}`, { cache: 'no-store' })
      .then(res => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`)
        return res.json() as Promise<StatsPayload>
      })
      .then(data => {
        setStats(data)
        setError(null)
      })
      .catch(err => {
        console.error('Failed to load admin stats:', err)
        setError('Could not load stats — retrying shortly.')
      })
  }, [])

  const fetchGraphs = useCallback((from: string, to: string) => {
    fetch(`/api/admin/graphs?from=${from}&to=${to}&tz=${new Date().getTimezoneOffset()}`, { cache: 'no-store' })
      .then(res => (res.ok ? (res.json() as Promise<GraphsPayload>) : Promise.reject(new Error(`${res.status}`))))
      .then(setGraphs)
      .catch(err => console.error('Failed to load admin graphs:', err))
  }, [])

  const fetchSales = useCallback((from: string, to: string) => {
    fetch(`/api/admin/sales?from=${from}&to=${to}`, { cache: 'no-store' })
      .then(res => (res.ok ? (res.json() as Promise<SalesPayload>) : Promise.reject(new Error(`${res.status}`))))
      .then(setSales)
      .catch(err => console.error('Failed to load admin sales:', err))
  }, [])

  // KPI row + overview + donut share the global period.
  useEffect(() => {
    fetchStats(period.from, period.to)
    fetchGraphs(period.from, period.to)
    fetchSales(period.from, period.to)
    const id = setInterval(() => fetchStats(period.from, period.to), LIVE_POLL_MS)
    return () => clearInterval(id)
  }, [fetchStats, fetchGraphs, fetchSales, period])

  // Quick-view aggregate (costs presets + per-model donuts + latest
  // affiliates + feedback). Refetched on period change so the cost-by-model
  // donuts track the selected period (the preset buckets are fixed windows
  // and simply refresh).
  useEffect(() => {
    fetch(`/api/admin/dashboard?from=${period.from}&to=${period.to}&tz=${new Date().getTimezoneOffset()}`, { cache: 'no-store' })
      .then(res => (res.ok ? (res.json() as Promise<DashboardPayload>) : Promise.reject(new Error(`${res.status}`))))
      .then(setDash)
      .catch(err => console.error('Failed to load dashboard aggregate:', err))
  }, [period])

  // Derived series for sparklines + the overview chart.
  const reportsSeries = useMemo(() => (graphs?.reports ?? []).map(r => r.initial + r.full), [graphs])
  const signupsSeries = useMemo(() => (graphs?.signups ?? []).map(s => s.count), [graphs])
  const revenueSeries = useMemo(() => (graphs?.sales ?? []).map(s => s.revenueUsd), [graphs])
  const costSeries = useMemo(() => (graphs?.sales ?? []).map(s => s.costUsd), [graphs])

  const overviewData: OverviewPoint[] | null = useMemo(() => {
    if (!graphs) return null
    return graphs.reports.map((r, i) => ({
      day: r.day,
      reports: r.initial + r.full,
      signups: graphs.signups[i]?.count ?? 0,
      sessions: graphs.traffic[i]?.sessions ?? 0,
      costs: graphs.sales[i]?.costUsd ?? 0,
    }))
  }, [graphs])

  const reportsTotal = stats ? stats.reportsCompleted.initial + stats.reportsCompleted.full : null
  const costTotalUsd = useMemo(() => costSeries.reduce((a, b) => a + b, 0), [costSeries])
  const primaryCurrency = sales?.primaryCurrency ?? 'usd'
  const revenueUsd = primaryCurrency === 'usd' ? (sales?.revenueByCurrency?.usd ?? 0) / 100 : (revenueSeries.reduce((a, b) => a + b, 0))

  const widgets: WidgetDef[] = useMemo(
    () => [
      {
        id: 'kpi-users',
        defaultSpan: 1,
        defaultHeight: 'half',
        node: (
          <StatCard
            label="Users online"
            value={stats ? stats.usersOnline : '—'}
            icon={<Users className="h-4 w-4" />}
            deltaLabel="active now"
            accent="#818cf8"
          />
        ),
      },
      {
        id: 'kpi-reports',
        defaultSpan: 1,
        defaultHeight: 'half',
        node: (
          <StatCard
            label="Reports"
            value={reportsTotal ?? '—'}
            icon={<FileText className="h-4 w-4" />}
            deltaPct={seriesDelta(reportsSeries)}
            deltaLabel="this period"
            sparkline={reportsSeries}
            accent="#818cf8"
          />
        ),
      },
      {
        id: 'kpi-signups',
        defaultSpan: 1,
        defaultHeight: 'half',
        node: (
          <StatCard
            label="Signups"
            value={stats ? stats.signups : '—'}
            icon={<UserPlus className="h-4 w-4" />}
            deltaPct={seriesDelta(signupsSeries)}
            deltaLabel="this period"
            sparkline={signupsSeries}
            accent="#22d3ee"
          />
        ),
      },
      {
        id: 'kpi-revenue',
        defaultSpan: 1,
        defaultHeight: 'half',
        node: (
          <StatCard
            label="Revenue"
            value={sales ? fmtUsd(revenueUsd) : '—'}
            icon={<DollarSign className="h-4 w-4" />}
            deltaPct={seriesDelta(revenueSeries)}
            deltaLabel="this period"
            sparkline={revenueSeries}
            accent="#34d399"
          />
        ),
      },
      {
        id: 'kpi-ai-cost',
        defaultSpan: 1,
        defaultHeight: 'half',
        node: (
          <StatCard
            label="AI cost"
            value={graphs ? fmtCostUsd(costTotalUsd) : '—'}
            icon={<Cpu className="h-4 w-4" />}
            deltaPct={seriesDelta(costSeries)}
            deltaLabel="this period"
            sparkline={costSeries}
            accent="#fbbf24"
          />
        ),
      },
      { id: 'overview', defaultSpan: 3, defaultHeight: 'full', node: <OverviewChart data={overviewData} granularity={graphs?.granularity ?? 'day'} /> },
      {
        id: 'report-types',
        defaultSpan: 1,
        defaultHeight: 'half',
        node: (
          <ReportTypesDonut
            initial={stats?.reportsCompleted.initial ?? 0}
            full={stats?.reportsCompleted.full ?? 0}
          />
        ),
      },
      { id: 'report-costs', defaultSpan: 1, defaultHeight: 'half', node: <ReportCostsWidget presets={dash?.costs ?? null} /> },
      { id: 'ai-cost-by-model', defaultSpan: 1, defaultHeight: 'half', node: <AiCostByModelDonut data={dash?.costs?.costsByModel ?? null} /> },
      { id: 'todays-sales', defaultSpan: 1, defaultHeight: 'full', node: <TodaysSalesWidget /> },
      { id: 'latest-affiliates', defaultSpan: 1, defaultHeight: 'half', node: <LatestAffiliates rows={dash?.affiliates ?? null} /> },
      { id: 'latest-feedback', defaultSpan: 1, defaultHeight: 'half', node: <LatestFeedback rows={dash?.feedback ?? null} /> },
    ],
    [stats, sales, dash, graphs, reportsSeries, signupsSeries, revenueSeries, costSeries, overviewData, reportsTotal, revenueUsd, costTotalUsd]
  )

  const PRESET_LABELS: Record<string, string> = {
    today: 'today',
    yesterday: 'yesterday',
    '7d': 'the last 7 days',
    '30d': 'the last 30 days',
    wtd: 'week to date',
    mtd: 'month to date',
    ytd: 'year to date',
  }
  const periodLabel = PRESET_LABELS[period.preset] ?? (period.from === period.to ? period.from : `${period.from} → ${period.to}`)

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white light:text-gray-900">Dashboard</h1>
          <p className="mt-0.5 text-sm text-slate-400 light:text-gray-500">
            Snapshot for {periodLabel}. Live counts refresh every 30s.
          </p>
        </div>
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>

      {error && <p className="mb-4 text-sm text-amber-300 light:text-amber-600">{error}</p>}

      <DashboardGrid widgets={widgets} adminId={adminId} initialLayout={initialLayout} />

      <div id="growth" className="scroll-mt-20">
        <GrowthGraphs period={period} />
      </div>
    </div>
  )
}
