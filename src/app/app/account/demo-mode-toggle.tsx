'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DemoModeToggle({ demoMode }: { demoMode: boolean }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/profile/demo-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demo_mode: !demoMode }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error ?? 'Failed to update')
      } else {
        router.refresh()
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span
        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
          demoMode
            ? 'bg-amber-500/15 text-amber-300 light:bg-amber-100 light:text-amber-700'
            : 'bg-emerald-500/15 text-emerald-300 light:bg-emerald-100 light:text-emerald-700'
        }`}
      >
        {demoMode ? 'Demo Mode' : 'Live Mode'}
      </span>
      <button
        type="button"
        onClick={toggle}
        disabled={saving}
        className="rounded-lg bg-indigo-500 px-4 py-1.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-400 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving…' : demoMode ? 'Switch to Live Mode' : 'Switch to Demo Mode'}
      </button>
      {error && <span className="text-sm text-red-300 light:text-red-600">{error}</span>}
    </div>
  )
}
