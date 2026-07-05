'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signOut()
    router.push('/sign-in')
  }

  return (
    <button
      onClick={handleSignOut}
      className="text-sm text-slate-300 light:text-gray-600 hover:text-white light:hover:text-gray-900 underline"
    >
      Sign out
    </button>
  )
}
