'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewIdeaForm({
  defaultCountry = '',
  defaultRegion = '',
}: {
  defaultCountry?: string
  defaultRegion?: string
}) {
  const router = useRouter()
  const [rawText, setRawText] = useState('')
  const [country, setCountry] = useState(defaultCountry)
  const [region, setRegion] = useState(defaultRegion)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')

    const res = await fetch('/api/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_text: rawText, location_country: country, location_region: region }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setErrorMsg(body.error ?? 'Something went wrong. Please try again.')
      setStatus('error')
      return
    }

    const { id } = await res.json()
    router.push(`/app/ideas/${id}/confirm`)
  }

  const isLoading = status === 'loading'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      <div>
        <label htmlFor="raw_text" className="block text-sm font-medium text-gray-700 mb-1">
          Your idea
        </label>
        <textarea
          id="raw_text"
          required
          rows={4}
          maxLength={4000}
          autoFocus
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="e.g. I want to make homemade dog treats and sell them at local markets…"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm
                     focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500
                     resize-none"
        />
        <p className="mt-1 text-xs text-gray-400 text-right">{rawText.length}/4000</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">
            Country <span className="text-red-500">*</span>
          </label>
          <input
            id="country"
            type="text"
            required
            maxLength={2}
            value={country}
            onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 2))}
            placeholder="AU"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm
                       focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500
                       uppercase"
          />
          <p className="mt-1 text-xs text-gray-400">ISO code, e.g. AU, US, GB</p>
        </div>
        <div>
          <label htmlFor="region" className="block text-sm font-medium text-gray-700 mb-1">
            City / region
          </label>
          <input
            id="region"
            type="text"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="Brisbane, QLD"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm
                       focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading || rawText.trim().length < 3}
          className="rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white
                     hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Starting…' : 'Start the engine'}
        </button>
      </div>
    </form>
  )
}
