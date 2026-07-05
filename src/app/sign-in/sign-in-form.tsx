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
  const [googleLoading, setGoogleLoading] = useState(false)

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

  async function handleGoogleSignIn() {
    setGoogleLoading(true)
    setErrorMsg('')

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    })

    if (error) {
      setGoogleLoading(false)
      setStatus('error')
      setErrorMsg(error.message)
    }
    // On success the browser is redirected to Google, so no need to reset loading state.
  }

  if (status === 'sent') {
    return (
      <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-300 text-center">
        Check your inbox — we sent a magic link to <strong>{email}</strong>.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {(callbackError || errorMsg) && (
        <div className="rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-300">
          {errorMsg || 'Sign-in link expired or invalid. Please try again.'}
        </div>
      )}

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={googleLoading}
        className="flex w-full items-center justify-center gap-3 rounded-md border border-gray-300 bg-white px-4 py-2
                   text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50
                   focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
          <path
            fill="#FFC107"
            d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
          />
          <path
            fill="#FF3D00"
            d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
          />
          <path
            fill="#4CAF50"
            d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
          />
          <path
            fill="#1976D2"
            d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
          />
        </svg>
        {googleLoading ? 'Redirecting…' : 'Continue with Google'}
      </button>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs text-slate-500">or</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">
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
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 shadow-sm
                       focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>
        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full rounded-md bg-indigo-500 px-4 py-2 text-sm font-semibold text-white
                     shadow-lg shadow-indigo-500/40 transition-all duration-200 hover:bg-indigo-400
                     focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'loading' ? 'Sending…' : 'Send magic link'}
        </button>
      </form>
    </div>
  )
}
