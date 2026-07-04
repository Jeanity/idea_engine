'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function SignInForm() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') ?? '/app'
  const callbackError = searchParams.get('error')

  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    })

    if (error) {
      setStatus('error')
      setErrorMsg(error.message)
    } else {
      setStatus('sent')
    }
  }

  if (status === 'sent') {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 text-center">
        Check your inbox — we sent a magic link to <strong>{email}</strong>.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {(callbackError || errorMsg) && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMsg || 'Sign-in link expired or invalid. Please try again.'}
        </div>
      )}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email address
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm
                     focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      <button
        type="submit"
        disabled={status === 'loading'}
        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white
                   hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'loading' ? 'Sending…' : 'Send magic link'}
      </button>
    </form>
  )
}
