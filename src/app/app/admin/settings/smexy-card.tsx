'use client'

import { useState, useEffect } from 'react'

// Admin kill switch for the third theme (src/lib/smexy.ts): ON = the theme
// toggle cycles dark → light → smexy; OFF = the mode disappears from the
// toggle and visitors who had it saved are demoted back to dark on their
// next page load. Purely cosmetic either way — no report content changes.
export function SmexyCard() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [error, setError] = useState('')
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    fetch('/api/admin/smexy')
      .then(res => res.json())
      .then(data => {
        if (typeof data.enabled === 'boolean') setEnabled(data.enabled)
        else setError(data.error ?? 'Failed to load smexy mode.')
      })
      .catch(() => setError('Failed to load smexy mode.'))
  }, [])

  async function toggle() {
    if (enabled === null) return
    setToggling(true)
    setError('')
    try {
      const res = await fetch('/api/admin/smexy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Failed to update smexy mode.')
        return
      }
      setEnabled(!enabled)
    } catch {
      setError('Failed to update smexy mode.')
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm px-5 py-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-semibold text-white light:text-gray-900 mb-1">Smexy mode</h2>
          <p className="text-xs text-slate-500 light:text-gray-400 leading-relaxed max-w-md">
            The third theme in the light/dark toggle — an animated aurora, glass cards, and
            gradient accents layered over dark mode. When <span className="font-medium">off</span>,
            the option vanishes from the theme toggle and anyone who had it selected falls back
            to dark on their next visit. Cosmetic only; flip freely.
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
