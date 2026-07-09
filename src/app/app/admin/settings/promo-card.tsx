'use client'

import { useState, useEffect, useCallback } from 'react'

interface PromoConfig {
  enabled: boolean
  spend_cap_usd: number | null
  report_cap: number | null
  per_user_limit: number | null
  started_at: string | null
  ended_at: string | null
  ended_reason: 'spend_cap' | 'report_cap' | 'manual' | null
}

interface PromoUsage {
  reportsUsed: number
  spendUsedUsd: number
  perUserUsed: number
}

interface PromoState {
  config: PromoConfig
  usage: PromoUsage
  distinctUsers: number
  suspiciousClusters: number
  migrationMissing: boolean
}

const inputCls =
  'w-full rounded-lg border border-white/10 bg-slate-950/60 light:bg-white light:border-gray-300 px-3 py-2 text-sm text-white light:text-gray-900 placeholder:text-slate-600 light:placeholder:text-gray-400 focus:outline-none focus:border-indigo-500'
const labelCls = 'block text-xs font-medium text-slate-400 light:text-gray-500 mb-1'

function MigrationMissingNotice() {
  return (
    <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 light:bg-amber-50 light:border-amber-200 px-4 py-4">
      <p className="text-sm font-semibold text-amber-200 light:text-amber-900 mb-1">Promo mode table not found</p>
      <p className="text-sm text-amber-100/90 light:text-amber-800">
        Run <code className="rounded bg-black/20 light:bg-amber-100 px-1.5 py-0.5">supabase/migrations/013_promo_mode.sql</code> in
        the Supabase SQL editor, then reload this page.
      </p>
    </div>
  )
}

const ENDED_REASON_LABELS: Record<string, string> = {
  spend_cap: 'spend cap reached',
  report_cap: 'report cap reached',
  manual: 'ended manually',
}

export function PromoCard() {
  const [state, setState] = useState<PromoState | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [spendCap, setSpendCap] = useState('')
  const [reportCap, setReportCap] = useState('')
  const [perUserLimit, setPerUserLimit] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)
  const [confirming, setConfirming] = useState<'start' | 'end' | null>(null)
  const [toggling, setToggling] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetch('/api/admin/promo')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setLoadError(data.error ?? 'Failed to load promo settings.')
        return
      }
      setState(data)
      if (!data.migrationMissing) {
        setSpendCap(data.config.spend_cap_usd ?? '')
        setReportCap(data.config.report_cap ?? '')
        setPerUserLimit(data.config.per_user_limit ?? '')
      }
    } catch {
      setLoadError('Failed to load promo settings.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function saveCaps() {
    setSaving(true)
    setSaveError('')
    setSaved(false)
    try {
      const res = await fetch('/api/admin/promo', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spend_cap_usd: spendCap === '' ? null : Number(spendCap),
          report_cap: reportCap === '' ? null : Number(reportCap),
          per_user_limit: perUserLimit === '' ? null : Number(perUserLimit),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSaveError(data.error ?? 'Failed to save.')
        return
      }
      setSaved(true)
      await load()
    } catch {
      setSaveError('Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  async function toggle(action: 'start' | 'end') {
    setToggling(true)
    try {
      const res = await fetch('/api/admin/promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        setConfirming(null)
        await load()
      }
    } finally {
      setToggling(false)
    }
  }

  if (loading && !state) {
    return (
      <div className="rounded-lg border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm px-5 py-5">
        <p className="text-sm text-slate-400 light:text-gray-500">Loading promo settings…</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm px-5 py-5">
        <p className="text-sm text-red-300 light:text-red-600">{loadError}</p>
      </div>
    )
  }

  if (!state) return null

  if (state.migrationMissing) {
    return (
      <div className="rounded-lg border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm px-5 py-5">
        <h2 className="font-semibold text-white light:text-gray-900 mb-3">Promo mode</h2>
        <MigrationMissingNotice />
      </div>
    )
  }

  const { config, usage, distinctUsers, suspiciousClusters } = state

  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm px-5 py-5">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h2 className="font-semibold text-white light:text-gray-900">Promo mode</h2>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          config.enabled
            ? 'bg-emerald-500/10 text-emerald-300 light:bg-emerald-50 light:text-emerald-700'
            : 'bg-white/10 text-slate-400 light:bg-gray-100 light:text-gray-500'
        }`}>
          {config.enabled ? 'Active' : 'Off'}
        </span>
      </div>
      <p className="text-xs text-slate-500 light:text-gray-400 mb-4 leading-relaxed">
        Lets every signed-in user generate full reports for free until a cap below is reached, then
        auto-reverts to live mode (the &ldquo;coming soon&rdquo; unlock button). The spend cap is
        approximate — spend is only known after each run completes, so it&rsquo;s checked before each
        new run rather than enforced mid-run.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div>
          <label className={labelCls}>Spend cap (USD)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="No cap"
            className={inputCls}
            value={spendCap}
            onChange={e => setSpendCap(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Report cap</label>
          <input
            type="number"
            min="0"
            step="1"
            placeholder="No cap"
            className={inputCls}
            value={reportCap}
            onChange={e => setReportCap(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Per-user limit</label>
          <input
            type="number"
            min="0"
            step="1"
            placeholder="Unlimited"
            className={inputCls}
            value={perUserLimit}
            onChange={e => setPerUserLimit(e.target.value)}
          />
        </div>
      </div>

      {saveError && <p className="text-xs text-red-300 light:text-red-600 mb-3">{saveError}</p>}

      <div className="flex items-center gap-3 flex-wrap mb-5">
        <button
          onClick={saveCaps}
          disabled={saving}
          className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-400 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save caps'}
        </button>
        {saved && <span className="text-xs text-emerald-300 light:text-emerald-600">Saved.</span>}

        <span className="mx-1 h-5 w-px bg-white/10 light:bg-gray-200" aria-hidden="true" />

        {config.enabled ? (
          confirming === 'end' ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <span className="text-xs text-red-300 light:text-red-600">This changes what users see immediately.</span>
              <button
                onClick={() => toggle('end')}
                disabled={toggling}
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500/80 hover:bg-red-500 text-white disabled:opacity-50"
              >
                {toggling ? 'Ending…' : 'Yes, end now'}
              </button>
              <button onClick={() => setConfirming(null)} className="text-xs text-slate-400 hover:text-white light:text-gray-500 light:hover:text-gray-900">
                Cancel
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirming('end')}
              className="text-sm font-medium px-4 py-2 rounded-lg border border-red-500/30 text-red-300 hover:border-red-500/50 light:border-red-200 light:text-red-600 light:hover:border-red-300"
            >
              End now
            </button>
          )
        ) : confirming === 'start' ? (
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="text-xs text-amber-300 light:text-amber-700">This lets every signed-in user generate full reports for free until a cap is reached.</span>
            <button
              onClick={() => toggle('start')}
              disabled={toggling}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-500/80 hover:bg-emerald-500 text-white disabled:opacity-50"
            >
              {toggling ? 'Starting…' : 'Yes, start'}
            </button>
            <button onClick={() => setConfirming(null)} className="text-xs text-slate-400 hover:text-white light:text-gray-500 light:hover:text-gray-900">
              Cancel
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirming('start')}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white"
          >
            Start promo
          </button>
        )}
      </div>

      {config.enabled && (
        <div className="rounded-lg bg-white/5 light:bg-gray-50 border border-white/10 light:border-gray-200 px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <p className="text-xs text-slate-500 light:text-gray-400">Reports used</p>
            <p className="text-sm font-semibold text-white light:text-gray-900">
              {usage.reportsUsed}{config.report_cap !== null && <span className="text-slate-500 light:text-gray-400 font-normal"> / {config.report_cap}</span>}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 light:text-gray-400">Spend used</p>
            <p className="text-sm font-semibold text-white light:text-gray-900">
              ${usage.spendUsedUsd.toFixed(4)}{config.spend_cap_usd !== null && <span className="text-slate-500 light:text-gray-400 font-normal"> / ${config.spend_cap_usd.toFixed(2)}</span>}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 light:text-gray-400">Distinct users served</p>
            <p className="text-sm font-semibold text-white light:text-gray-900">{distinctUsers}</p>
          </div>
        </div>
      )}

      {suspiciousClusters > 0 && (
        <p className="mt-3 text-xs text-amber-300 light:text-amber-700">
          {suspiciousClusters} possible duplicate-account clusters — see promo_identity table.
        </p>
      )}

      {!config.enabled && config.ended_at && (
        <p className="text-xs text-slate-500 light:text-gray-400">
          Last ended {new Date(config.ended_at).toLocaleString()}
          {config.ended_reason && <> — {ENDED_REASON_LABELS[config.ended_reason] ?? config.ended_reason}</>}.
        </p>
      )}
    </div>
  )
}
