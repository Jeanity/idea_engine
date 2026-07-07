'use client'

import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { ResponsiveContainer, LineChart, Line } from 'recharts'
import { AdminCard } from './admin-card'

/**
 * KPI tile: label, big value, optional icon chip, optional %-change pill and
 * optional sparkline. R2's KPI row is a grid of these.
 *
 * Design-language rule: a positive/flat delta is emerald, a negative delta is
 * AMBER — never red. deltaPct is a number like 12.4 (=+12.4%) or -3 (=-3%).
 */
export function StatCard({
  label,
  value,
  icon,
  deltaPct,
  deltaLabel,
  sparkline,
  accent = '#818cf8',
}: {
  label: ReactNode
  value: ReactNode
  icon?: ReactNode
  deltaPct?: number
  /** Optional context after the pill, e.g. "vs last week". */
  deltaLabel?: ReactNode
  /** Bare numbers; rendered as a tiny axis-less line. */
  sparkline?: number[]
  /** Sparkline / icon accent colour. */
  accent?: string
}) {
  const hasDelta = typeof deltaPct === 'number' && Number.isFinite(deltaPct)
  const positive = hasDelta && (deltaPct as number) >= 0

  return (
    <AdminCard>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-slate-400 light:text-gray-500">{label}</p>
        {icon && (
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300 light:bg-indigo-50 light:text-indigo-600"
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
      </div>

      <p className="mt-2 text-2xl font-semibold tracking-tight text-white light:text-gray-900">
        {value}
      </p>

      <div className="mt-2 flex items-center gap-2">
        {hasDelta && (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium ${
              positive
                ? 'bg-emerald-500/15 text-emerald-300 light:bg-emerald-100 light:text-emerald-700'
                : 'bg-amber-500/15 text-amber-300 light:bg-amber-100 light:text-amber-700'
            }`}
          >
            {positive ? (
              <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            ) : (
              <ArrowDownRight className="h-3 w-3" aria-hidden="true" />
            )}
            {Math.abs(deltaPct as number).toFixed(1)}%
          </span>
        )}
        {deltaLabel && (
          <span className="text-xs text-slate-500 light:text-gray-400">{deltaLabel}</span>
        )}
      </div>

      {sparkline && sparkline.length > 1 && (
        <div className="mt-3 h-10 w-full" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkline.map((v, i) => ({ i, v }))} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
              <Line type="monotone" dataKey="v" stroke={accent} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </AdminCard>
  )
}
