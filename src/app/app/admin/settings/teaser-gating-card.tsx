'use client'

import { useState, useEffect } from 'react'

// App-wide toggle for initial-report gating (src/lib/teaser-gating.ts):
// OFF = the teaser shows the full viability snapshot (launch-trial mode),
// ON  = sub-scores/rationales are redacted server-side and the report page
//       shows locked-section structure instead (paid-phase mode).
export function TeaserGatingCard() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [error, setError] = useState('')
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    fetch('/api/admin/teaser-gating')
      .then(res => res.json())
      .then(data => {
        if (typeof data.enabled === 'boolean') setEnabled(data.enabled)
        else setError(data.error ?? 'Failed to load teaser gating.')
      })
      .catch(() => setError('Failed to load teaser gating.'))
  }, [])

  async function toggle() {
    if (enabled === null) return
    setToggling(true)
    setError('')
    try {
      const res = await fetch('/api/admin/teaser-gating', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Failed to update teaser gating.')
        return
      }
      setEnabled(!enabled)
    } catch {
      setError('Failed to update teaser gating.')
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm px-5 py-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-semibold text-white light:text-gray-900 mb-1">Initial-report gating</h2>
          <p className="text-xs text-slate-500 light:text-gray-400 leading-relaxed max-w-md">
            When on, initial reports hide the per-dimension viability scores and rationales
            (headline score and verdict stay visible), trim next steps to one, and show the
            locked full-report sections as blurred structure. Applied at delivery time — flipping
            this affects every existing initial report immediately, and the hidden text never
            reaches the browser. Keep <span className="font-medium">off</span> during the free
            trial, turn <span className="font-medium">on</span> for the paid phase.
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={toggling || enabled === null}
          className={`text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50 ${
            enabled
              ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 light:bg-emerald-50 light:text-emerald-700'
              : 'bg-white/10 text-slate-300 hover:bg-white/15 light:bg-gray-100 light:text-gray-700'
          }`}
        >
          {enabled === null ? 'Loading…' : enabled ? 'On — click to turn off' : 'Off — click to turn on'}
        </button>
      </div>
      {error && <p className="text-xs text-red-300 light:text-red-600 mt-2">{error}</p>}
    </div>
  )
}
