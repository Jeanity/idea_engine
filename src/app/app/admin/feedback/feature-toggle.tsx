'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function FeatureToggle({ feedbackId, allowPublic, initialFeatured }: {
  feedbackId: string
  allowPublic: boolean
  initialFeatured: boolean
}) {
  const router = useRouter()
  const [featured, setFeatured] = useState(initialFeatured)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function toggle() {
    const next = !featured
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback_id: feedbackId, featured: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Failed to update')
        return
      }
      setFeatured(next)
      router.refresh()
    } catch {
      setError('Failed to update')
    } finally {
      setLoading(false)
    }
  }

  if (!allowPublic) {
    return (
      <span className="text-xs text-slate-500 light:text-gray-400" title="User did not consent to public quoting">
        No consent
      </span>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={toggle}
        disabled={loading}
        className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors disabled:opacity-50 ${
          featured
            ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30 light:bg-emerald-100 light:text-emerald-700 light:border-emerald-200'
            : 'bg-white/5 text-slate-300 border-white/10 hover:border-white/20 light:bg-gray-50 light:text-gray-600 light:border-gray-200 light:hover:border-gray-300'
        }`}
      >
        {loading ? 'Saving…' : featured ? 'Featured ✓' : 'Feature on homepage'}
      </button>
      {error && <p className="text-[11px] text-red-300 light:text-red-600">{error}</p>}
    </div>
  )
}
