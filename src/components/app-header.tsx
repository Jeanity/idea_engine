import Link from 'next/link'
import { ThemeToggle } from '@/components/theme-toggle'
import { AccountMenu } from '@/components/account-menu'
import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { readPromoConfig } from '@/lib/promo'

export async function AppHeader({ email }: { email: string }) {
  // A cheap count-only query — cheaper than threading an "hasIdeas" prop
  // through every one of the ~7 pages that render this header. "My ideas"
  // only makes sense to show once there's somewhere for it to take you.
  const supabase = await createDbClient()
  const { count } = await supabase
    .from('ideas')
    .select('id', { count: 'exact', head: true })
  const hasIdeas = (count ?? 0) > 0

  // Admin-only mode badges. The app-wide pill shows Promo vs Live (promo is
  // global billing state — Danny needs to see it at a glance); the amber Demo
  // pill is the admin's own per-profile fixture mode and renders alongside,
  // since both can be on at once. Service client only after the admin check,
  // per project ground rules (app_settings has no RLS policies).
  const isAdmin = isAdminEmail(email)
  let demoMode = false
  let promoMode = false
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
    promoMode = (await readPromoConfig(createServiceClient())).enabled
  }

  return (
    <header className="bg-slate-950/80 backdrop-blur border-b border-white/10 light:bg-white/80 light:border-gray-200 px-6 py-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:gap-6">
        <Link href="/app" className="font-semibold text-white light:text-gray-900 hover:text-slate-200 light:hover:text-gray-700 transition-colors">
          Idea Engine
        </Link>
        {isAdmin && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              promoMode
                ? 'bg-violet-500/15 text-violet-300 light:bg-violet-100 light:text-violet-700'
                : 'bg-emerald-500/15 text-emerald-300 light:bg-emerald-100 light:text-emerald-700'
            }`}
          >
            {promoMode ? 'Promo Mode' : 'Live Mode'}
          </span>
        )}
        {isAdmin && demoMode && (
          <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-500/15 text-amber-300 light:bg-amber-100 light:text-amber-700">
            Demo Mode
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-4">
        <ThemeToggle />
        <AccountMenu hasIdeas={hasIdeas} isAdmin={isAdmin} />
      </div>
    </header>
  )
}
