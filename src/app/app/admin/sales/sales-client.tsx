'use client'

import { useCallback, useEffect, useState } from 'react'
import { PeriodPicker, rangeForPreset, type PeriodRange } from '../period-picker'

interface SalesPayload {
  revenueByCurrency: Record<string, number>
  refundsByCurrency: Record<string, number>
  netByCurrency: Record<string, number>
  primaryCurrency: string
  multiCurrency: boolean
  aiCostUsd: number
  reportsWithCostCount: number
  marginUsd: number
}

function StatTile({ label, value, sublabel, warn }: { label: string; value: string; sublabel?: string; warn?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm px-5 py-5">
      <p className="text-xs text-slate-500 light:text-gray-400 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${warn ? 'text-amber-400 light:text-amber-600' : 'text-white light:text-gray-900'}`}>
        {value}
      </p>
      {sublabel && <p className="text-xs text-slate-500 light:text-gray-400 mt-1">{sublabel}</p>}
    </div>
  )
}

/** Formats integer cents as a currency string, e.g. (1234, "usd") -> "$12.34". */
function formatCents(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`
  }
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export function SalesClient() {
  const [period, setPeriod] = useState<PeriodRange>(() => rangeForPreset('today'))
  const [sales, setSales] = useState<SalesPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchSales = useCallback((from: string, to: string) => {
    fetch(`/api/admin/sales?from=${from}&to=${to}`, { cache: 'no-store' })
      .then(res => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`)
        return res.json() as Promise<SalesPayload>
      })
      .then(data => {
        setSales(data)
        setError(null)
      })
      .catch(err => {
        console.error('Failed to load admin sales:', err)
        setError('Could not load sales data.')
      })
  }, [])

  useEffect(() => {
    fetchSales(period.from, period.to)
  }, [fetchSales, period])

  const periodLabel = period.from === period.to ? period.from : `${period.from} → ${period.to}`
  const currencies = sales ? [...new Set([...Object.keys(sales.revenueByCurrency), ...Object.keys(sales.refundsByCurrency)])] : []

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-4 mb-1">
        <h1 className="text-2xl font-semibold text-white light:text-gray-900">Sales</h1>
      </div>
      <p className="text-sm text-slate-400 light:text-gray-500 mb-8 max-w-2xl">
        Revenue, refunds, and AI generation cost for the selected period. Stripe isn&rsquo;t wired up yet, so
        revenue and refunds will show $0 until then — that&rsquo;s expected, not an error. AI cost already
        reflects real spend, including $0 demo-mode runs.
      </p>

      {error && <p className="text-sm text-red-300 light:text-red-600 mb-4">{error}</p>}

      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <p className="text-xs uppercase tracking-wide text-slate-500 light:text-gray-400">{periodLabel}</p>
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatTile
          label="Revenue"
          value={sales ? formatCents(sales.revenueByCurrency[sales.primaryCurrency] ?? 0, sales.primaryCurrency) : '—'}
          sublabel={sales?.multiCurrency ? 'Dominant currency shown — see breakdown below' : undefined}
        />
        <StatTile
          label="Refunds"
          value={sales ? formatCents(sales.refundsByCurrency[sales.primaryCurrency] ?? 0, sales.primaryCurrency) : '—'}
        />
        <StatTile
          label="AI cost"
          value={sales ? formatUsd(sales.aiCostUsd) : '—'}
          sublabel={sales ? `${sales.reportsWithCostCount} report${sales.reportsWithCostCount === 1 ? '' : 's'} generated` : undefined}
        />
        <StatTile
          label="Margin"
          value={sales ? formatUsd(sales.marginUsd) : '—'}
          warn={!!sales && sales.marginUsd < 0}
          sublabel="Net revenue (dominant currency, USD-equivalent) minus AI cost"
        />
      </div>

      {sales?.multiCurrency && (
        <p className="text-xs text-amber-400 light:text-amber-600 mb-6">
          Purchases in this period span more than one currency. Currencies are never summed together — the
          stat tiles above show only <span className="uppercase">{sales.primaryCurrency}</span> (the largest by
          revenue). See the per-currency breakdown below for the rest.
        </p>
      )}

      <div className="rounded-2xl border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm overflow-hidden">
        <p className="text-xs uppercase tracking-wide text-slate-500 light:text-gray-400 px-5 pt-4 pb-2">
          Per-currency breakdown
        </p>
        {!sales ? (
          <p className="text-sm text-slate-500 light:text-gray-400 px-5 pb-5">Loading…</p>
        ) : currencies.length === 0 ? (
          <p className="text-sm text-slate-500 light:text-gray-400 px-5 pb-5">No purchases in this period yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 light:text-gray-400 border-b border-white/10 light:border-gray-100">
                <th className="px-5 py-2 font-medium">Currency</th>
                <th className="px-5 py-2 font-medium">Revenue</th>
                <th className="px-5 py-2 font-medium">Refunds</th>
                <th className="px-5 py-2 font-medium">Net</th>
              </tr>
            </thead>
            <tbody>
              {currencies.map(currency => (
                <tr key={currency} className="border-b border-white/5 light:border-gray-50 last:border-0">
                  <td className="px-5 py-2.5 uppercase text-slate-300 light:text-gray-700">{currency}</td>
                  <td className="px-5 py-2.5 text-slate-200 light:text-gray-800">
                    {formatCents(sales.revenueByCurrency[currency] ?? 0, currency)}
                  </td>
                  <td className="px-5 py-2.5 text-slate-200 light:text-gray-800">
                    {formatCents(sales.refundsByCurrency[currency] ?? 0, currency)}
                  </td>
                  <td className="px-5 py-2.5 text-slate-200 light:text-gray-800">
                    {formatCents(sales.netByCurrency[currency] ?? 0, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
