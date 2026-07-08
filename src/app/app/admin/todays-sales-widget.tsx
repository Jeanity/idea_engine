'use client'

import { useCallback, useEffect, useState } from 'react'
import { WidgetCard } from '@/components/admin'

// Today's-sales quick-view widget (Block R2). Owns its OWN 7d / Month / Custom
// control, independent of the global PeriodPicker. Reuses the existing
// /api/admin/sales route (from/to) rather than a bespoke endpoint.

interface SalesPayload {
  revenueByCurrency: Record<string, number>
  primaryCurrency: string
  multiCurrency: boolean
  aiCostUsd: number
  marginUsd: number
}

type Mode = '7d' | 'month' | 'custom'

const MODES: { key: Mode; label: string }[] = [
  { key: '7d', label: '7d' },
  { key: 'month', label: 'Month' },
  { key: 'custom', label: 'Custom' },
]

function toLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function rangeFor(mode: Exclude<Mode, 'custom'>): { from: string; to: string } {
  const now = new Date()
  const to = toLocalDate(now)
  const days = mode === '7d' ? 6 : 29
  const from = new Date(now)
  from.setDate(from.getDate() - days)
  return { from: toLocalDate(from), to }
}

function fmtCurrency(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`
  }
}

function fmtUsd(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

export function TodaysSalesWidget() {
  const [mode, setMode] = useState<Mode>('7d')
  const [customFrom, setCustomFrom] = useState(toLocalDate(new Date()))
  const [customTo, setCustomTo] = useState(toLocalDate(new Date()))
  const [data, setData] = useState<SalesPayload | null>(null)

  const fetchSales = useCallback((from: string, to: string) => {
    fetch(`/api/admin/sales?from=${from}&to=${to}`, { cache: 'no-store' })
      .then(res => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`)
        return res.json() as Promise<SalesPayload>
      })
      .then(setData)
      .catch(err => console.error('Failed to load sales widget:', err))
  }, [])

  useEffect(() => {
    if (mode === 'custom') {
      if (customFrom && customTo) fetchSales(customFrom, customTo)
    } else {
      const { from, to } = rangeFor(mode)
      fetchSales(from, to)
    }
  }, [fetchSales, mode, customFrom, customTo])

  const toggle = (
    <div className="flex flex-wrap items-center gap-1.5">
      {MODES.map(m => {
        const on = m.key === mode
        return (
          <button
            key={m.key}
            type="button"
            onClick={() => setMode(m.key)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
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

  const primary = data?.primaryCurrency ?? 'usd'
  const revenueCents = data?.revenueByCurrency?.[primary] ?? 0

  return (
    <WidgetCard title="Sales" subtitle="Revenue and margin" action={toggle}>
      <p className="text-3xl font-semibold tracking-tight text-white light:text-gray-900">
        {data ? fmtCurrency(revenueCents, primary) : '—'}
      </p>
      <p className="mt-1 text-xs text-slate-500 light:text-gray-400">
        {data?.multiCurrency ? 'Primary-currency revenue (see Sales tab for all currencies)' : 'Revenue'}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/5 bg-white/5 px-3 py-2 light:border-gray-100 light:bg-gray-50">
          <p className="text-[11px] text-slate-500 light:text-gray-400">AI cost</p>
          <p className="text-sm font-semibold text-slate-200 light:text-gray-800">
            {data ? fmtUsd(data.aiCostUsd) : '—'}
          </p>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/5 px-3 py-2 light:border-gray-100 light:bg-gray-50">
          <p className="text-[11px] text-slate-500 light:text-gray-400">Margin</p>
          <p
            className={`text-sm font-semibold ${
              data && data.marginUsd < 0
                ? 'text-amber-300 light:text-amber-600'
                : 'text-emerald-300 light:text-emerald-600'
            }`}
          >
            {data ? fmtUsd(data.marginUsd) : '—'}
          </p>
        </div>
      </div>

      {mode === 'custom' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={customFrom}
            max={customTo}
            onChange={e => setCustomFrom(e.target.value)}
            className="rounded-lg border border-white/10 bg-slate-900/80 px-2 py-1.5 text-xs text-slate-200 light:border-gray-200 light:bg-white light:text-gray-800"
          />
          <span className="text-xs text-slate-500 light:text-gray-400">to</span>
          <input
            type="date"
            value={customTo}
            min={customFrom}
            max={toLocalDate(new Date())}
            onChange={e => setCustomTo(e.target.value)}
            className="rounded-lg border border-white/10 bg-slate-900/80 px-2 py-1.5 text-xs text-slate-200 light:border-gray-200 light:bg-white light:text-gray-800"
          />
        </div>
      )}
    </WidgetCard>
  )
}
