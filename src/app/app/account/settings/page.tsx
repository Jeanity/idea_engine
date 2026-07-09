import { redirect } from 'next/navigation'
import { createDbClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import AccountForm from '../account-form'
import DemoModeToggle from '../demo-mode-toggle'
import { DangerZone } from './danger-zone'

export const metadata = { title: 'Settings — Idea Engine' }

export default async function AccountSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>
}) {
  const { welcome } = await searchParams
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, default_country, default_region, marketing_opt_in, demo_mode')
    .eq('id', user.id)
    .single()

  const isAdmin = isAdminEmail(user.email)

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-white light:text-gray-900 mb-1">Settings</h1>
      <p className="text-sm text-slate-400 light:text-gray-500 mb-8">Manage your profile and preferences.</p>

      {welcome === '1' && (
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.06] light:border-indigo-200 light:bg-indigo-50 px-5 py-4 mb-8">
          <p className="text-sm font-medium text-indigo-200 light:text-indigo-800">Welcome to Idea Engine!</p>
          <p className="text-sm text-indigo-300/80 light:text-indigo-700 mt-0.5">
            Set your username and details below to get started.
          </p>
        </div>
      )}

      <div className="space-y-8">
        {isAdmin && (
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 light:border-gray-200 light:bg-white light:shadow-sm px-6 py-6">
            <h2 className="text-lg font-semibold text-white light:text-gray-900 mb-1">AI usage — admin</h2>
            <p className="text-sm text-slate-400 light:text-gray-500 mb-4">
              Demo Mode answers report runs from canned fixtures — no API spend. Applies to your account only.
            </p>
            <DemoModeToggle demoMode={profile?.demo_mode ?? false} />
          </div>
        )}

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

        <DangerZone />
      </div>
    </div>
  )
}
