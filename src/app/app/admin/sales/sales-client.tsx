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
    <div className="rounded-lg border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm px-5 py-5">
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

      <div className="rounded-lg border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm overflow-hidden">
        <p className="text-xs uppercase tracking-wide text-slate-500 light:text-gray-400 px-5 pt-4 pb-2">
          Per-currency breakdown
        </p>
        {!sales ? (
          <p className="text-sm text-slate-500 light:text-gray-400 px-5 pb-5">Loading…</p>
        ) : currencies.length === 0 ? (
          <p className="text-sm text-slate-500 light:text-gray-400 px-5 pb-5">No purchases in this period yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
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
          </div>
        )}
      </div>

      <PurchasesSection />
    </div>
  )
}

// ── Purchases & refunds ──────────────────────────────────────────────────
// Customer-support workflow (HANDOFF "TODO — Customer support feature"):
// when a billing email arrives (/contact "Billing & refunds", rose chip on
// the Contact queue), the admin finds the purchase here, does the actual
// money movement in the Stripe dashboard (deep link per row), then records
// it — status='refunded' + refunded_at, which the revenue tiles above read.
// The Stripe refund API call itself lands with the payments build.

interface PurchaseRow {
  id: string
  user_id: string
  report_id: string
  stripe_payment_intent_id: string | null
  amount_cents: number
  currency: string
  status: 'pending' | 'complete' | 'refunded' | 'failed'
  completed_at: string | null
  refunded_at: string | null
  created_at: string
  email: string | null
}

const PURCHASE_STATUS_TONE: Record<PurchaseRow['status'], string> = {
  complete: 'bg-emerald-500/10 text-emerald-300 light:bg-emerald-50 light:text-emerald-700',
  pending: 'bg-white/10 text-slate-300 light:bg-gray-100 light:text-gray-600',
  refunded: 'bg-rose-500/20 text-rose-300 light:bg-rose-100 light:text-rose-700',
  failed: 'bg-red-500/15 text-red-300 light:bg-red-50 light:text-red-700',
}

function PurchasesSection() {
  const [rows, setRows] = useState<PurchaseRow[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [filter, setFilter] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)
  const [acting, setActing] = useState(false)
  const [actionError, setActionError] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/purchases', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setLoadError(data.error ?? 'Failed to load purchases.')
        return
      }
      setRows(data.purchases ?? [])
      setLoadError('')
    } catch {
      setLoadError('Failed to load purchases.')
    }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  async function refund(id: string, action: 'mark' | 'unmark') {
    setActing(true)
    setActionError('')
    try {
      const res = await fetch(`/api/admin/purchases/${id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setActionError(data.error ?? 'Failed to update purchase.')
        return
      }
      setConfirming(null)
      await load()
    } catch {
      setActionError('Failed to update purchase.')
    } finally {
      setActing(false)
    }
  }

  const needle = filter.trim().toLowerCase()
  const visible = (rows ?? []).filter(
    r => !needle || (r.email ?? '').toLowerCase().includes(needle) || r.report_id.startsWith(needle) || r.id.startsWith(needle)
  )

  return (
    <div className="mt-6 rounded-lg border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm overflow-hidden">
      <div className="flex items-center justify-between flex-wrap gap-3 px-5 pt-4 pb-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 light:text-gray-400">Purchases &amp; refunds</p>
          <p className="text-xs text-slate-500 light:text-gray-400 mt-1 max-w-xl">
            Refund flow: verify the request (billing mail lands on the Contact queue with a rose chip) →
            refund the money in Stripe (link per row) → record it here. Recording updates the revenue
            tiles; it doesn&rsquo;t move money.
          </p>
        </div>
        <input
          type="search"
          placeholder="Filter by email or id…"
          className="rounded-lg border border-white/10 bg-slate-950/60 light:bg-white light:border-gray-300 px-3 py-1.5 text-sm text-white light:text-gray-900 placeholder:text-slate-600 light:placeholder:text-gray-400 focus:outline-none focus:border-indigo-500"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </div>

      {actionError && <p className="text-xs text-red-300 light:text-red-600 px-5 pb-2">{actionError}</p>}

      {loadError ? (
        <p className="text-sm text-red-300 light:text-red-600 px-5 pb-5">{loadError}</p>
      ) : !rows ? (
        <p className="text-sm text-slate-500 light:text-gray-400 px-5 pb-5">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-slate-500 light:text-gray-400 px-5 pb-5">
          {rows.length === 0 ? 'No purchases yet — expected until payments launch.' : 'No purchases match that filter.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 light:text-gray-400 border-b border-white/10 light:border-gray-100">
                <th className="px-5 py-2 font-medium">Buyer</th>
                <th className="px-5 py-2 font-medium">Amount</th>
                <th className="px-5 py-2 font-medium">Status</th>
                <th className="px-5 py-2 font-medium">Date</th>
                <th className="px-5 py-2 font-medium">Stripe</th>
                <th className="px-5 py-2 font-medium text-right">Refund</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(p => (
                <tr key={p.id} className="border-b border-white/5 light:border-gray-50 last:border-0">
                  <td className="px-5 py-2.5 text-slate-200 light:text-gray-800">
                    {p.email ?? <span className="text-slate-500 light:text-gray-400">(deleted user)</span>}
                  </td>
                  <td className="px-5 py-2.5 text-slate-200 light:text-gray-800">{formatCents(p.amount_cents, p.currency)}</td>
                  <td className="px-5 py-2.5">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${PURCHASE_STATUS_TONE[p.status]}`}>
                      {p.status}
                    </span>
                    {p.refunded_at && (
                      <span className="block text-[11px] text-slate-500 light:text-gray-400 mt-0.5">
                        {new Date(p.refunded_at).toLocaleDateString()}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-slate-400 light:text-gray-500">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-2.5">
                    {p.stripe_payment_intent_id ? (
                      <a
                        href={`https://dashboard.stripe.com/payments/${p.stripe_payment_intent_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-400 hover:text-indigo-300 light:text-indigo-600 light:hover:text-indigo-700 underline underline-offset-2"
                      >
                        Open payment
                      </a>
                    ) : (
                      <span className="text-slate-600 light:text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-right whitespace-nowrap">
                    {p.status === 'complete' && (
                      confirming === p.id ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="text-[11px] text-rose-300 light:text-rose-600">Refunded in Stripe?</span>
                          <button
                            onClick={() => refund(p.id, 'mark')}
                            disabled={acting}
                            className="text-xs font-medium px-2.5 py-1 rounded-lg bg-rose-500/80 hover:bg-rose-500 text-white disabled:opacity-50"
                          >
                            {acting ? 'Saving…' : 'Yes, record it'}
                          </button>
                          <button onClick={() => setConfirming(null)} className="text-xs text-slate-400 hover:text-white light:text-gray-500 light:hover:text-gray-900">
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => { setConfirming(p.id); setActionError('') }}
                          className="text-xs font-medium px-2.5 py-1 rounded-lg border border-rose-500/30 text-rose-300 hover:border-rose-500/50 light:border-rose-200 light:text-rose-600 light:hover:border-rose-300"
                        >
                          Record refund
                        </button>
                      )
                    )}
                    {p.status === 'refunded' && (
                      confirming === p.id ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="text-[11px] text-slate-400 light:text-gray-500">Undo the record?</span>
                          <button
                            onClick={() => refund(p.id, 'unmark')}
                            disabled={acting}
                            className="text-xs font-medium px-2.5 py-1 rounded-lg bg-slate-600 hover:bg-slate-500 text-white disabled:opacity-50"
                          >
                            {acting ? 'Saving…' : 'Yes, undo'}
                          </button>
                          <button onClick={() => setConfirming(null)} className="text-xs text-slate-400 hover:text-white light:text-gray-500 light:hover:text-gray-900">
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => { setConfirming(p.id); setActionError('') }}
                          className="text-xs text-slate-500 hover:text-slate-300 light:text-gray-400 light:hover:text-gray-600 underline underline-offset-2"
                        >
                          Undo
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
