'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'

/**
 * Landing-header auth link that stays static-render friendly: server HTML
 * always says "Sign in"; if a session exists client-side it swaps to the
 * dashboard link after hydration.
 */
export function HeaderAuthLink() {
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSignedIn(true)
    })
  }, [])

  return signedIn ? (
    <Link
      href="/app"
      className="rounded-lg bg-indigo-500/20 border border-indigo-400/30 px-3 py-1.5 text-sm text-indigo-200 hover:bg-indigo-500/30 hover:text-white font-medium transition-colors light:bg-indigo-100 light:border-indigo-200 light:text-indigo-700 light:hover:bg-indigo-200"
    >
      Open dashboard →
    </Link>
  ) : (
    <Link
      href="/sign-in"
      className="text-sm text-slate-200 hover:text-white font-medium transition-colors light:text-gray-600 light:hover:text-gray-900"
    >
      Sign in
    </Link>
  )
}
