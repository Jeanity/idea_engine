'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  ideaId: string
  currentArchetype: string
  archetypeLabels: Record<string, string>
}

export default function ConfirmForm({ ideaId, currentArchetype, archetypeLabels }: Props) {
  const router = useRouter()
  const [archetype, setArchetype] = useState(currentArchetype)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const isOverride = archetype !== currentArchetype

  async function handleConfirm() {
    setIsLoading(true)
    setError('')

    const res = await fetch(`/api/ideas/${ideaId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archetype, is_override: isOverride }),
    })

    if (!res.ok) {
      setError('Something went wrong. Please try again.')
      setIsLoading(false)
      return
    }

    router.push(`/app/ideas/${ideaId}/questions`)
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-400/20 bg-red-400/10 light:bg-red-50 light:border-red-100 p-3 text-sm text-red-300 light:text-red-600">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="archetype" className="block text-sm font-medium text-slate-300 light:text-gray-700 mb-1">
          Not quite right? Change the type:
        </label>
        <select
          id="archetype"
          value={archetype}
          onChange={(e) => setArchetype(e.target.value)}
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white
                     light:bg-white light:border-gray-300 light:text-gray-900
                     focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {Object.entries(archetypeLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        {isOverride && (
          <p className="mt-1 text-xs text-indigo-400 light:text-indigo-700">
            You&apos;re overriding our classification — we&apos;ll use your choice.
          </p>
        )}
      </div>

      <button
        onClick={handleConfirm}
        disabled={isLoading}
        className="w-full rounded-lg bg-indigo-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25
                   hover:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Saving…' : 'Yes, that\'s right — continue →'}
      </button>
    </div>
  )
}
