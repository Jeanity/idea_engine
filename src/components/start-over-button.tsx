'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Escape hatch shown along the idea flow (confirm / questions / summary /
// teaser report). Abandons the current idea entirely — inline two-step
// confirm, house pattern (see src/app/app/admin/surveys/surveys-client.tsx).
export function StartOverButton({ ideaId }: { ideaId: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm() {
    setDeleting(true)
    setError('')
    try {
      const res = await fetch(`/api/ideas/${ideaId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Something went wrong. Please try again.')
        return
      }
      router.push('/app')
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  if (confirming) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span className="text-xs text-red-300 light:text-red-600">
          Delete this idea and start fresh? This can&apos;t be undone.
        </span>
        <button
          onClick={handleConfirm}
          disabled={deleting}
          className="text-xs font-medium px-2.5 py-1 rounded-lg bg-red-500/80 hover:bg-red-500 text-white disabled:opacity-50"
        >
          {deleting ? 'Deleting…' : 'Yes, start over'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={deleting}
          className="text-xs text-slate-400 hover:text-white light:text-gray-500 light:hover:text-gray-900 disabled:opacity-50"
        >
          Cancel
        </button>
        {error && <span className="text-xs text-red-300 light:text-red-600 basis-full">{error}</span>}
      </span>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs text-slate-400 hover:text-white light:text-gray-500 light:hover:text-gray-900 underline underline-offset-2"
    >
      Start over with a new idea
    </button>
  )
}
