import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createDbClient } from '@/lib/db'
import { AppHeader } from '@/components/app-header'
import AccountForm from './account-form'

export const metadata = { title: 'Account — Idea Engine' }

export default async function AccountPage() {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, default_country, default_region, marketing_opt_in')
    .eq('id', user.id)
    .single()

  const initialSource = profile?.display_name ?? profile?.username ?? user.email!
  const initial = initialSource.trim().charAt(0).toUpperCase()
  const identityName = profile?.display_name ?? profile?.username ?? user.email!

  return (
    <main className="min-h-screen bg-slate-950 light:bg-gray-50">
      <AppHeader email={user.email!} />
      <div className="max-w-xl mx-auto px-6 py-12">
        <Link href="/app" className="inline-flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 font-medium mb-6">
          ← Back to your ideas
        </Link>
        <h1 className="text-2xl font-semibold text-white light:text-gray-900 mb-1">Account</h1>
        <p className="text-sm text-slate-400 light:text-gray-500 mb-8">Manage your profile and preferences.</p>

        <div className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-6 mb-6 flex items-center gap-4">
          <div className="flex-shrink-0 h-14 w-14 rounded-full bg-white/15 border border-white/30 flex items-center justify-center text-xl font-semibold text-white">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold truncate">{identityName}</p>
            <p className="text-indigo-200 text-sm truncate">{user.email}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/80 light:border-gray-200 light:bg-white light:shadow-sm px-6 py-6">
          <AccountForm
            email={user.email!}
            profile={{
              username: profile?.username ?? null,
              display_name: profile?.display_name ?? null,
              default_country: profile?.default_country ?? null,
              default_region: profile?.default_region ?? null,
              marketing_opt_in: profile?.marketing_opt_in ?? false,
            }}
          />
        </div>
      </div>
    </main>
  )
}
