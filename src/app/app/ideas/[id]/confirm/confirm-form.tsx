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
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="archetype" className="block text-sm font-medium text-gray-700 mb-1">
          Not quite right? Change the type:
        </label>
        <select
          id="archetype"
          value={archetype}
          onChange={(e) => setArchetype(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm
                     focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {Object.entries(archetypeLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        {isOverride && (
          <p className="mt-1 text-xs text-indigo-600">
            You&apos;re overriding our classification — we&apos;ll use your choice.
          </p>
        )}
      </div>

      <button
        onClick={handleConfirm}
        disabled={isLoading}
        className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white
                   hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Saving…' : 'Yes, that\'s right — continue →'}
      </button>
    </div>
  )
}
