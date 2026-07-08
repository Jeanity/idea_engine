'use client'

import { useState } from 'react'
import { WidgetCard } from '@/components/admin'

// Report-costs quick-view widget (Block R2). Owns its OWN period control,
// independent of the global PeriodPicker. Reads reports.cost_usd aggregates
// from the shared /api/admin/dashboard route: the preset buckets arrive with
// the parent's initial fetch; the custom range triggers a small targeted
// refetch of that same route with costFrom/costTo.

export interface CostBucket {
  totalUsd: number
  count: number
}

export interface ModelCostEntry {
  model: string
  totalUsd: number
}

export interface CostsData {
  lastHour: CostBucket
  today: CostBucket
  last7d: CostBucket
  last30d: CostBucket
  average: { avgPerReportUsd: number; count: number }
  custom: (CostBucket & { from: string; to: string }) | null
  costsByModel?: ModelCostEntry[]
}

type Mode = 'average' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom'

const MODES: { key: Mode; label: string }[] = [
  { key: 'average', label: 'Average' },
  { key: 'hourly', label: 'Hourly' },
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'custom', label: 'Custom' },
]

function fmtUsd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: n < 1 ? 4 : 2,
  }).format(n)
}

function todayLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function ReportCostsWidget({ presets }: { presets: CostsData | null }) {
  const [mode, setMode] = useState<Mode>('daily')
  const [customFrom, setCustomFrom] = useState(todayLocal())
  const [customTo, setCustomTo] = useState(todayLocal())
  const [custom, setCustom] = useState<(CostBucket & { from: string; to: string }) | null>(null)
  const [loadingCustom, setLoadingCustom] = useState(false)

  function fetchCustom(from: string, to: string) {
    if (!from || !to) return
    setLoadingCustom(true)
    fetch(`/api/admin/dashboard?costFrom=${from}&costTo=${to}`, { cache: 'no-store' })
      .then(res => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`)
        return res.json() as Promise<{ costs: CostsData }>
      })
      .then(payload => setCustom(payload.costs.custom))
      .catch(err => console.error('Failed to load custom report costs:', err))
      .finally(() => setLoadingCustom(false))
  }

  const selector = (
    <select
      value={mode}
      onChange={e => {
        const next = e.target.value as Mode
        setMode(next)
        if (next === 'custom' && !custom) fetchCustom(customFrom, customTo)
      }}
      aria-label="Cost metric"
      className="rounded-lg border border-white/10 bg-slate-900/80 px-2 py-1.5 text-xs text-slate-200 light:border-gray-200 light:bg-white light:text-gray-800"
    >
      {MODES.map(m => (
        <option key={m.key} value={m.key}>
          {m.label}
        </option>
      ))}
    </select>
  )

  let value = '—'
  let sublabel = ''
  if (presets) {
    if (mode === 'average') {
      value = fmtUsd(presets.average.avgPerReportUsd)
      sublabel = `Avg per report · ${presets.average.count} report${presets.average.count === 1 ? '' : 's'} all-time`
    } else if (mode === 'hourly') {
      value = fmtUsd(presets.lastHour.totalUsd)
      sublabel = `Last hour · ${presets.lastHour.count} report${presets.lastHour.count === 1 ? '' : 's'}`
    } else if (mode === 'daily') {
      value = fmtUsd(presets.today.totalUsd)
      sublabel = `Today · ${presets.today.count} report${presets.today.count === 1 ? '' : 's'}`
    } else if (mode === 'weekly') {
      value = fmtUsd(presets.last7d.totalUsd)
      sublabel = `Last 7 days · ${presets.last7d.count} report${presets.last7d.count === 1 ? '' : 's'}`
    } else if (mode === 'monthly') {
      value = fmtUsd(presets.last30d.totalUsd)
      sublabel = `Last 30 days · ${presets.last30d.count} report${presets.last30d.count === 1 ? '' : 's'}`
    } else if (mode === 'custom') {
      if (loadingCustom) {
        value = '…'
        sublabel = 'Loading…'
      } else if (custom) {
        value = fmtUsd(custom.totalUsd)
        sublabel = `${custom.count} report${custom.count === 1 ? '' : 's'} in range`
      } else {
        sublabel = 'Pick a date range'
      }
    }
  }

  return (
    <WidgetCard title="Report costs" subtitle="AI generation spend" action={selector}>
      <p className="text-3xl font-semibold tracking-tight text-white light:text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500 light:text-gray-400">{sublabel || ' '}</p>

      {mode === 'custom' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={customFrom}
            max={customTo}
            onChange={e => {
              setCustomFrom(e.target.value)
              if (e.target.value) fetchCustom(e.target.value, customTo)
            }}
            className="rounded-lg border border-white/10 bg-slate-900/80 px-2 py-1.5 text-xs text-slate-200 light:border-gray-200 light:bg-white light:text-gray-800"
          />
          <span className="text-xs text-slate-500 light:text-gray-400">to</span>
          <input
            type="date"
            value={customTo}
            min={customFrom}
            max={todayLocal()}
            onChange={e => {
              setCustomTo(e.target.value)
              if (e.target.value) fetchCustom(customFrom, e.target.value)
            }}
            className="rounded-lg border border-white/10 bg-slate-900/80 px-2 py-1.5 text-xs text-slate-200 light:border-gray-200 light:bg-white light:text-gray-800"
          />
        </div>
      )}
    </WidgetCard>
  )
}
