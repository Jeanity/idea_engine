'use client'

import { useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { WidgetCard } from '@/components/admin'

// Overview chart for the snapshot dashboard (Block R2). Tab toggles switch
// between the Reports / Signups / Sessions series; the range is driven by the
// shared PeriodPicker (DashboardClient owns it) so this stays in sync with the
// KPI row per the ground rule against duplicating the picker. Series data is
// the same Block 8 graph payload the growth graphs use.

export interface OverviewPoint {
  day: string
  reports: number
  signups: number
  sessions: number
  /** AI generation spend (USD) per bucket — rendered with currency formatting. */
  costs: number
}

type Metric = 'reports' | 'signups' | 'sessions' | 'costs'

const METRICS: { key: Metric; label: string; color: string; usd?: boolean }[] = [
  { key: 'reports', label: 'Reports', color: '#818cf8' },
  { key: 'signups', label: 'Signups', color: '#22d3ee' },
  { key: 'sessions', label: 'Sessions', color: '#a78bfa' },
  { key: 'costs', label: 'AI costs', color: '#fbbf24', usd: true },
]

function fmtUsd(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

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
  // No hover cursor — the default vertical line/wash reads as a glitch.
  cursor: false as const,
}

function shortDay(day: string): string {
  return day.slice(5)
}

export function OverviewChart({ data, granularity = 'day' }: { data: OverviewPoint[] | null; granularity?: 'hour' | 'day' }) {
  const [metric, setMetric] = useState<Metric>('reports')
  const active = METRICS.find(m => m.key === metric)!
  const hasData = !!data && data.some(d => d[metric] > 0)
  const hourly = granularity === 'hour'

  const tabs = (
    <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Overview metric">
      {METRICS.map(m => {
        const on = m.key === metric
        return (
          <button
            key={m.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => setMetric(m.key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              on
                ? 'border-indigo-500/30 bg-indigo-500/15 text-indigo-300 light:border-indigo-200 light:bg-indigo-100 light:text-indigo-700'
                : 'border-white/10 bg-white/5 text-slate-400 hover:text-white light:border-gray-200 light:bg-gray-50 light:text-gray-500 light:hover:text-gray-900'
            }`}
          >
            {m.label}
          </button>
        )
      })}
    </div>
  )

  return (
    <WidgetCard title="Overview" subtitle={hourly ? 'Hourly activity (UTC) for the selected day' : 'Daily activity for the selected period'} action={tabs}>
      <div className="relative" style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data ?? []} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id={`overview-${metric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={active.color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={active.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="day" tickFormatter={hourly ? undefined : shortDay} {...axisProps} />
            <YAxis allowDecimals={!!active.usd} {...axisProps} />
            <Tooltip {...tooltipStyle} formatter={active.usd ? v => fmtUsd(Number(v ?? 0)) : undefined} />
            <Area
              type="monotone"
              dataKey={metric}
              name={active.label}
              stroke={active.color}
              strokeWidth={2}
              fill={`url(#overview-${metric})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
        {!!data && !hasData && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-500 light:text-gray-400">
            {active.key === 'costs' ? 'No AI spend in this range yet.' : `No ${active.label.toLowerCase()} in this range yet.`}
          </p>
        )}
      </div>
    </WidgetCard>
  )
}
