'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import type { PeriodRange } from './period-picker'

// Block 8: growth graphs, driven by /api/admin/graphs. Shares the period
// range with the stat tiles above it (DashboardClient owns the PeriodPicker;
// this component just renders whatever range it's given) so both stay in
// sync off one control, per the ground rule against duplicating the picker.

interface DailyPoint { day: string; count: number }
interface TrafficPoint { day: string; sessions: number; uniqueVisitors: number }
interface ReportsPoint { day: string; initial: number; full: number }
interface SalesPoint { day: string; revenueUsd: number; costUsd: number; marginUsd: number }
interface FunnelRow { sessions: number; signups: number; reports: number; purchases: number }
interface ReferrerRow extends FunnelRow { referrerHost: string }
interface CampaignRow extends FunnelRow { source: string | null; campaign: string | null }

interface GraphsPayload {
  range: { from: string; to: string }
  /** 'hour' when the range is a single day (24 'HH:00' buckets), else 'day'. */
  granularity: 'hour' | 'day'
  traffic: TrafficPoint[]
  returningVisitors: DailyPoint[]
  reports: ReportsPoint[]
  signups: DailyPoint[]
  sales: SalesPoint[]
  salesCaveat: string | null
  topReferrers: ReferrerRow[]
  topCampaigns: CampaignRow[]
}

// Palette: indigo/violet/cyan/emerald accents, matching the rest of the app.
// No red anywhere (project design language) — a negative margin bar/line
// uses amber instead.
const COLOR_INDIGO = '#818cf8'
const COLOR_VIOLET = '#a78bfa'
const COLOR_CYAN = '#22d3ee'
const COLOR_EMERALD = '#34d399'
const COLOR_AMBER = '#fbbf24'

const axisProps = {
  stroke: 'var(--chart-axis)',
  tick: { fill: 'var(--chart-axis)', fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: 'var(--chart-grid)' },
}

const tooltipStyle = {
  contentStyle: {
    background: 'var(--chart-tooltip-bg)',
    border: '1px solid var(--chart-tooltip-border)',
    borderRadius: 10,
    fontSize: 12,
  },
  labelStyle: { color: 'var(--chart-tooltip-text)' },
  itemStyle: { color: 'var(--chart-tooltip-text)' },
  // No hover cursor — the default washes the plot background (grey rect on
  // bar charts, vertical line on line charts), which reads as a glitch.
  cursor: false as const,
}

const legendStyle = { fontSize: 12, color: 'var(--chart-axis)' }

/** 'YYYY-MM-DD' -> 'MM-DD' so axis labels stay compact. */
function shortDay(day: string): string {
  return day.slice(5)
}

// Hourly labels arrive from the API already in the browser's local timezone
// (the tz param shifts the day window and bucketing server-side), so they
// pass through the axis unchanged.

function ChartCard({
  title,
  sublabel,
  empty,
  children,
}: {
  title: string
  sublabel?: string
  empty?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm p-5">
      <p className="text-sm font-medium text-white light:text-gray-900">{title}</p>
      {sublabel && <p className="text-xs text-slate-500 light:text-gray-400 mt-0.5 mb-2">{sublabel}</p>}
      <div className="relative mt-2" style={{ width: '100%', height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
        {empty && (
          <p className="absolute inset-0 flex items-center justify-center text-xs text-slate-500 light:text-gray-400 pointer-events-none">
            No data in this range yet.
          </p>
        )}
      </div>
    </div>
  )
}

function formatUsd(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function funnelCell(v: number) {
  return <td className="px-4 py-2.5 text-slate-200 light:text-gray-800 text-right">{v}</td>
}

export function GrowthGraphs({ period }: { period: PeriodRange }) {
  const [data, setData] = useState<GraphsPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchGraphs = useCallback((from: string, to: string) => {
    fetch(`/api/admin/graphs?from=${from}&to=${to}&tz=${new Date().getTimezoneOffset()}`, { cache: 'no-store' })
      .then(res => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`)
        return res.json() as Promise<GraphsPayload>
      })
      .then(payload => {
        setData(payload)
        setError(null)
      })
      .catch(err => {
        console.error('Failed to load admin graphs:', err)
        setError('Could not load growth graphs.')
      })
  }, [])

  useEffect(() => {
    fetchGraphs(period.from, period.to)
  }, [fetchGraphs, period])

  const hourly = data?.granularity === 'hour'
  const fmtBucket = hourly ? (label: string) => label : shortDay
  const per = hourly ? 'per hour' : 'per day'

  const hasAnyTraffic = !!data && data.traffic.some(d => d.sessions > 0 || d.uniqueVisitors > 0)
  const hasReturning = !!data && data.returningVisitors.some(d => d.count > 0)
  const hasReports = !!data && data.reports.some(d => d.initial > 0 || d.full > 0)
  const hasSignups = !!data && data.signups.some(d => d.count > 0)
  const hasSales = !!data && data.sales.some(d => d.revenueUsd !== 0 || d.costUsd !== 0)

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <p className="text-xs uppercase tracking-wide text-slate-500 light:text-gray-400">Growth</p>
        <p className="text-xs text-slate-500 light:text-gray-400">{hourly ? 'Hourly buckets, local time.' : 'Daily buckets.'}</p>
      </div>

      {error && <p className="text-sm text-red-300 light:text-red-600 mb-4">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Traffic" sublabel={`Sessions and unique visitors ${per}`} empty={!!data && !hasAnyTraffic}>
          <LineChart data={data?.traffic ?? []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="day" tickFormatter={fmtBucket} {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={legendStyle} />
            <Line type="monotone" dataKey="sessions" name="Sessions" stroke={COLOR_INDIGO} strokeWidth={2} dot={false} />
            <Line
              type="monotone"
              dataKey="uniqueVisitors"
              name="Unique visitors"
              stroke={COLOR_CYAN}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartCard>

        <ChartCard title="Returning visitors" sublabel={`Visitors seen on a prior day, ${per}`} empty={!!data && !hasReturning}>
          <BarChart data={data?.returningVisitors ?? []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="day" tickFormatter={fmtBucket} {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="count" name="Returning visitors" fill={COLOR_VIOLET} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Reports generated" sublabel={`Initial vs. full, ${per}`} empty={!!data && !hasReports}>
          <BarChart data={data?.reports ?? []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="day" tickFormatter={fmtBucket} {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={legendStyle} />
            <Bar dataKey="initial" name="Initial" stackId="reports" fill={COLOR_INDIGO} radius={[0, 0, 0, 0]} />
            <Bar dataKey="full" name="Full" stackId="reports" fill={COLOR_EMERALD} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Signups" sublabel={`New accounts ${per}`} empty={!!data && !hasSignups}>
          <BarChart data={data?.signups ?? []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="day" tickFormatter={fmtBucket} {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="count" name="Signups" fill={COLOR_CYAN} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ChartCard>

        <div className="lg:col-span-2">
          <ChartCard
            title="Sales & margin"
            sublabel={`Revenue and AI cost ${per}, USD only — see the Sales tab for full per-currency totals`}
            empty={!!data && !hasSales}
          >
            <LineChart data={data?.sales ?? []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="day" tickFormatter={fmtBucket} {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip {...tooltipStyle} formatter={v => formatUsd(Number(v))} />
              <Legend wrapperStyle={legendStyle} />
              <Line type="monotone" dataKey="revenueUsd" name="Revenue" stroke={COLOR_EMERALD} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="costUsd" name="AI cost" stroke={COLOR_VIOLET} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="marginUsd" name="Margin" stroke={COLOR_AMBER} strokeWidth={2} dot={false} />
            </LineChart>
          </ChartCard>
          {data?.salesCaveat && (
            <p className="text-xs text-amber-400 light:text-amber-600 mt-2">{data.salesCaveat}</p>
          )}
        </div>
      </div>

      <div className="mt-8">
        <p className="text-sm font-medium text-white light:text-gray-900 mb-1">Referrers &amp; campaigns</p>
        <p className="text-xs text-slate-500 light:text-gray-400 mb-3 max-w-3xl">
          Sessions and signups are scoped to the selected period. Reports and purchases are also counted within
          the period, but attributed using the acting user&rsquo;s all-time first-touch acquisition — a report
          generated today by someone who signed up via a campaign last month still counts toward that campaign
          today, even though the signup itself won&rsquo;t appear in this period&rsquo;s signup count. Treat the
          reports/purchases columns as approximate conversion signal, not a strict period-bound funnel.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-lg border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm overflow-hidden">
            <p className="text-xs uppercase tracking-wide text-slate-500 light:text-gray-400 px-4 pt-4 pb-2">
              Top referrers
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[420px]">
                <thead>
                  <tr className="text-left text-xs text-slate-500 light:text-gray-400 border-b border-white/10 light:border-gray-100">
                    <th className="px-4 py-2 font-medium">Referrer</th>
                    <th className="px-4 py-2 font-medium text-right">Sessions</th>
                    <th className="px-4 py-2 font-medium text-right">Signups</th>
                    <th className="px-4 py-2 font-medium text-right">Reports</th>
                    <th className="px-4 py-2 font-medium text-right">Purchases</th>
                  </tr>
                </thead>
                <tbody>
                  {!data ? (
                    <tr><td className="px-4 py-3 text-slate-500 light:text-gray-400" colSpan={5}>Loading…</td></tr>
                  ) : data.topReferrers.length === 0 ? (
                    <tr><td className="px-4 py-3 text-slate-500 light:text-gray-400" colSpan={5}>No referrer traffic in this period.</td></tr>
                  ) : (
                    data.topReferrers.map(row => (
                      <tr key={row.referrerHost} className="border-b border-white/5 light:border-gray-50 last:border-0">
                        <td className="px-4 py-2.5 text-slate-300 light:text-gray-700 max-w-[180px] truncate" title={row.referrerHost}>
                          {row.referrerHost}
                        </td>
                        {funnelCell(row.sessions)}
                        {funnelCell(row.signups)}
                        {funnelCell(row.reports)}
                        {funnelCell(row.purchases)}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm overflow-hidden">
            <p className="text-xs uppercase tracking-wide text-slate-500 light:text-gray-400 px-4 pt-4 pb-2">
              Top campaigns
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <thead>
                  <tr className="text-left text-xs text-slate-500 light:text-gray-400 border-b border-white/10 light:border-gray-100">
                    <th className="px-4 py-2 font-medium">Source</th>
                    <th className="px-4 py-2 font-medium">Campaign</th>
                    <th className="px-4 py-2 font-medium text-right">Sessions</th>
                    <th className="px-4 py-2 font-medium text-right">Signups</th>
                    <th className="px-4 py-2 font-medium text-right">Reports</th>
                    <th className="px-4 py-2 font-medium text-right">Purchases</th>
                  </tr>
                </thead>
                <tbody>
                  {!data ? (
                    <tr><td className="px-4 py-3 text-slate-500 light:text-gray-400" colSpan={6}>Loading…</td></tr>
                  ) : data.topCampaigns.length === 0 ? (
                    <tr><td className="px-4 py-3 text-slate-500 light:text-gray-400" colSpan={6}>No campaign traffic in this period.</td></tr>
                  ) : (
                    data.topCampaigns.map(row => (
                      <tr key={`${row.source}::${row.campaign}`} className="border-b border-white/5 light:border-gray-50 last:border-0">
                        <td className="px-4 py-2.5 text-slate-300 light:text-gray-700">{row.source ?? '—'}</td>
                        <td className="px-4 py-2.5 text-slate-300 light:text-gray-700">{row.campaign ?? '—'}</td>
                        {funnelCell(row.sessions)}
                        {funnelCell(row.signups)}
                        {funnelCell(row.reports)}
                        {funnelCell(row.purchases)}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
