import Link from 'next/link'
import SignOutButton from '@/app/app/sign-out-button'
import { ThemeToggle } from '@/components/theme-toggle'
import { createDbClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'

export async function AppHeader({ email }: { email: string }) {
  // A cheap count-only query — cheaper than threading an "hasIdeas" prop
  // through every one of the ~7 pages that render this header. "My ideas"
  // only makes sense to show once there's somewhere for it to take you.
  const supabase = await createDbClient()
  const { count } = await supabase
    .from('ideas')
    .select('id', { count: 'exact', head: true })
  const hasIdeas = (count ?? 0) > 0

  // Admin-only Demo/Live badge — scope the profile read by user id so the mode
  // shown is unambiguously the admin's own row.
  const isAdmin = isAdminEmail(email)
  let demoMode = false
  if (isAdmin) {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('demo_mode')
        .eq('id', user.id)
        .single()
      demoMode = profile?.demo_mode ?? false
    }
  }

  return (
    <header className="bg-slate-950/80 backdrop-blur border-b border-white/10 light:bg-white/80 light:border-gray-200 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/app" className="font-semibold text-white light:text-gray-900 hover:text-slate-200 light:hover:text-gray-700 transition-colors">
          Idea Engine
        </Link>
        <nav className="flex items-center gap-4">
          {hasIdeas && (
            <Link href="/app/account" className="text-sm text-slate-300 light:text-gray-600 hover:text-white light:hover:text-gray-900 font-medium transition-colors">
              My ideas
            </Link>
          )}
          <Link href="/app" className="text-sm text-slate-300 light:text-gray-600 hover:text-white light:hover:text-gray-900 font-medium transition-colors">
            New idea
          </Link>
          {isAdmin && (
            <Link href="/app/admin" className="text-sm text-slate-300 light:text-gray-600 hover:text-white light:hover:text-gray-900 font-medium transition-colors">
              Admin
            </Link>
          )}
          {isAdmin && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                demoMode
                  ? 'bg-amber-500/15 text-amber-300 light:bg-amber-100 light:text-amber-700'
                  : 'bg-emerald-500/15 text-emerald-300 light:bg-emerald-100 light:text-emerald-700'
              }`}
            >
              {demoMode ? 'Demo Mode' : 'Live Mode'}
            </span>
          )}
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <ThemeToggle />
        <Link
          href="/app/account"
          className="text-sm text-slate-300 light:text-gray-600 hover:text-white light:hover:text-gray-900 font-medium transition-colors"
        >
          My account
        </Link>
        <SignOutButton />
      </div>
    </header>
  )
}
