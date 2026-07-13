'use client'

import { useState, useEffect, useCallback } from 'react'

interface ServiceModeState {
  paused: boolean
  pendingNotify: number
}

// Sitewide kill switch (src/lib/service-mode.ts) — pauses new report
// generation everywhere (idea intake, teasers, full reports) while keeping
// the admin's own test-mode runs working (see the three POST routes' admin
// bypass). Two-step confirm both directions, same pattern as PromoCard's
// start/end (both change what live users can do immediately).
export function EngineCard() {
  const [state, setState] = useState<ServiceModeState | null>(null)
  const [loadError, setLoadError] = useState('')
  const [confirming, setConfirming] = useState<'pause' | 'resume' | null>(null)
  const [toggling, setToggling] = useState(false)
  const [toggleError, setToggleError] = useState('')

  const load = useCallback(async () => {
    setLoadError('')
    try {
      const res = await fetch('/api/admin/service-mode')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setLoadError(data.error ?? 'Failed to load engine status.')
        return
      }
      setState(data)
    } catch {
      setLoadError('Failed to load engine status.')
    }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  async function toggle(paused: boolean) {
    setToggling(true)
    setToggleError('')
    try {
      const res = await fetch('/api/admin/service-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paused }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setToggleError(data.error ?? 'Failed to update.')
        return
      }
      setConfirming(null)
      await load()
    } catch {
      setToggleError('Failed to update.')
    } finally {
      setToggling(false)
    }
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm px-5 py-5">
        <p className="text-sm text-red-300 light:text-red-600">{loadError}</p>
      </div>
    )
  }

  if (!state) {
    return (
      <div className="rounded-lg border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm px-5 py-5">
        <p className="text-sm text-slate-400 light:text-gray-500">Loading engine status…</p>
      </div>
    )
  }

  const notifyLabel = `${state.pendingNotify} user${state.pendingNotify === 1 ? '' : 's'} waiting to be told it’s back`

  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm px-5 py-5">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h2 className="font-semibold text-white light:text-gray-900">Engine</h2>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            state.paused
              ? 'bg-amber-500/15 text-amber-300 light:bg-amber-100 light:text-amber-700'
              : 'bg-emerald-500/10 text-emerald-300 light:bg-emerald-50 light:text-emerald-700'
          }`}
        >
          {state.paused ? 'Being serviced' : 'Running'}
        </span>
      </div>
      <p className="text-xs text-slate-500 light:text-gray-400 mb-4 leading-relaxed">
        Pauses new report generation sitewide — new ideas, teasers, and full reports all show
        &ldquo;The Engine is in for a quick service&rdquo; instead. You can still generate on your
        own ideas while paused, to keep testing. Users can opt in to a &ldquo;tell me when it&rsquo;s
        back&rdquo; email, sent in batches of 5/minute the moment this switches back off.
      </p>

      {toggleError && <p className="text-xs text-red-300 light:text-red-600 mb-3">{toggleError}</p>}

      {state.paused ? (
        confirming === 'resume' ? (
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="text-xs text-emerald-300 light:text-emerald-700">
              This resumes report generation for everyone
              {state.pendingNotify > 0 ? ` and emails ${notifyLabel}.` : '.'}
            </span>
            <button
              onClick={() => toggle(false)}
              disabled={toggling}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-500/80 hover:bg-emerald-500 text-white disabled:opacity-50"
            >
              {toggling ? 'Resuming…' : 'Yes, resume'}
            </button>
            <button onClick={() => setConfirming(null)} className="text-xs text-slate-400 hover:text-white light:text-gray-500 light:hover:text-gray-900">
              Cancel
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirming('resume')}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white"
          >
            Resume the Engine
          </button>
        )
      ) : confirming === 'pause' ? (
        <span className="inline-flex flex-wrap items-center gap-2">
          <span className="text-xs text-red-300 light:text-red-600">This stops every user from starting a new idea or report immediately.</span>
          <button
            onClick={() => toggle(true)}
            disabled={toggling}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500/80 hover:bg-red-500 text-white disabled:opacity-50"
          >
            {toggling ? 'Pausing…' : 'Yes, pause'}
          </button>
          <button onClick={() => setConfirming(null)} className="text-xs text-slate-400 hover:text-white light:text-gray-500 light:hover:text-gray-900">
            Cancel
          </button>
        </span>
      ) : (
        <button
          onClick={() => setConfirming('pause')}
          className="text-sm font-medium px-4 py-2 rounded-lg border border-red-500/30 text-red-300 hover:border-red-500/50 light:border-red-200 light:text-red-600 light:hover:border-red-300"
        >
          Pause the Engine
        </button>
      )}

      {state.pendingNotify > 0 && (
        <p className="mt-3 text-xs text-slate-500 light:text-gray-400">
          {notifyLabel}.
        </p>
      )}
    </div>
  )
}
