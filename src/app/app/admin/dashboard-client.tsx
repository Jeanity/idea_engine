'use client'

import { useCallback, useEffect, useState } from 'react'
import { PeriodPicker, rangeForPreset, type PeriodRange } from './period-picker'
import { GrowthGraphs } from './growth-graphs'

interface StatsPayload {
  usersOnline: number
  reportsLive: number
  reportsCompleted: { initial: number; full: number }
  ideasCreated: number
  signups: number
}

const LIVE_POLL_MS = 30_000

function StatTile({ label, value, sublabel }: { label: string; value: number | string; sublabel?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm px-5 py-5">
      <p className="text-xs text-slate-500 light:text-gray-400 mb-1">{label}</p>
      <p className="text-3xl font-bold text-white light:text-gray-900">{value}</p>
      {sublabel && <p className="text-xs text-slate-500 light:text-gray-400 mt-1">{sublabel}</p>}
    </div>
  )
}

export function DashboardClient() {
  const [period, setPeriod] = useState<PeriodRange>(() => rangeForPreset('today'))
  const [stats, setStats] = useState<StatsPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Promise-chained (not async/await) so the setState calls live inside
  // nested .then callbacks rather than the function's own top-level body —
  // that keeps this safe to call directly from the effect below.
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

  // Refetch immediately whenever the selected period changes, and on a 30s
  // interval thereafter. The stats API returns "right now" numbers (users
  // online, reports live) alongside the period-scoped ones in a single
  // payload, so this one poll loop keeps both current.
  useEffect(() => {
    fetchStats(period.from, period.to)
    const id = setInterval(() => fetchStats(period.from, period.to), LIVE_POLL_MS)
    return () => clearInterval(id)
  }, [fetchStats, period])

  const periodLabel = period.from === period.to ? period.from : `${period.from} → ${period.to}`

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-4 mb-1">
        <h1 className="text-2xl font-semibold text-white light:text-gray-900">Dashboard</h1>
      </div>
      <p className="text-sm text-slate-400 light:text-gray-500 mb-8">
        Usage stats for the selected period. Live counts refresh automatically every 30s.
      </p>

      {error && <p className="text-sm text-red-300 light:text-red-600 mb-4">{error}</p>}

      <div className="mb-10">
        <p className="text-xs uppercase tracking-wide text-slate-500 light:text-gray-400 mb-3">Right now</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatTile
            label="Users online"
            value={stats ? stats.usersOnline : '—'}
            sublabel="Active in the last 5 min"
          />
          <StatTile
            label="Reports generating"
            value={stats ? stats.reportsLive : '—'}
            sublabel="Queued or running"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <p className="text-xs uppercase tracking-wide text-slate-500 light:text-gray-400">{periodLabel}</p>
          <PeriodPicker value={period} onChange={setPeriod} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile label="Initial reports" value={stats ? stats.reportsCompleted.initial : '—'} />
          <StatTile label="Full reports" value={stats ? stats.reportsCompleted.full : '—'} />
          <StatTile label="Ideas created" value={stats ? stats.ideasCreated : '—'} />
          <StatTile label="Signups" value={stats ? stats.signups : '—'} />
        </div>
      </div>

      <GrowthGraphs period={period} />
    </div>
  )
}
