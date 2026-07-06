'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewIdeaForm() {
  const router = useRouter()
  const [rawText, setRawText] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')

    const res = await fetch('/api/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_text: rawText }),
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
        <div className="rounded-lg border border-red-400/20 bg-red-400/10 light:border-red-100 light:bg-red-50 p-3 text-sm text-red-300 light:text-red-600">
          {errorMsg}
        </div>
      )}

      <div>
        <label htmlFor="raw_text" className="block text-sm font-medium text-slate-300 light:text-gray-700 mb-1">
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
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-slate-500
                     light:bg-white light:border-gray-300 light:text-gray-900 light:placeholder-gray-400
                     focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-500
                     resize-none"
        />
        <p className="mt-1 text-xs text-slate-500 light:text-gray-400 text-right">{rawText.length}/4000</p>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading || rawText.trim().length < 3}
          className="rounded-lg bg-indigo-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25
                     hover:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Starting…' : 'Start the engine'}
        </button>
      </div>
    </form>
  )
}
