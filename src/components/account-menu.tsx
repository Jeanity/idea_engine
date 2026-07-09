'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { CircleUserRound, LayoutDashboard, Plus, ShieldCheck, LogOut } from 'lucide-react'

/**
 * Top-right account icon + dropdown for the signed-in app header. Replaces
 * the old "My account" text link; sign-out moves in here from its own
 * standalone button. Small client component so `app-header.tsx` can stay an
 * async Server Component — hasIdeas/isAdmin are computed there and passed in.
 */
export function AccountMenu({ hasIdeas, isAdmin }: { hasIdeas: boolean; isAdmin: boolean }) {
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (!open) return

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  async function handleSignOut() {
    setSigningOut(true)
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      await supabase.auth.signOut()
      router.push('/sign-in')
    } finally {
      setSigningOut(false)
    }
  }

  const itemCls =
    'flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-200 hover:bg-white/5 hover:text-white transition-colors light:text-gray-700 light:hover:bg-gray-100 light:hover:text-gray-900'

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 hover:bg-white/10 hover:text-white transition-colors light:text-gray-600 light:hover:bg-gray-100 light:hover:text-gray-900"
      >
        <CircleUserRound className="h-6 w-6" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-52 overflow-hidden rounded-xl border border-white/10 bg-slate-900 py-1.5 shadow-xl shadow-black/30 light:border-gray-200 light:bg-white light:shadow-lg"
        >
          <Link href="/app/account" role="menuitem" className={itemCls} onClick={() => setOpen(false)}>
            <CircleUserRound className="h-4 w-4 shrink-0" aria-hidden="true" />
            My account
          </Link>

          {hasIdeas && (
            <Link href="/app/account" role="menuitem" className={itemCls} onClick={() => setOpen(false)}>
              <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden="true" />
              My ideas
            </Link>
          )}

          <Link href="/app" role="menuitem" className={itemCls} onClick={() => setOpen(false)}>
            <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
            New idea
          </Link>

          {isAdmin && (
            <Link href="/app/admin" role="menuitem" className={itemCls} onClick={() => setOpen(false)}>
              <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
              Admin panel
            </Link>
          )}

          <div className="my-1.5 border-t border-white/10 light:border-gray-200" />

          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            disabled={signingOut}
            className={`${itemCls} w-full text-left disabled:opacity-50`}
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  )
}
