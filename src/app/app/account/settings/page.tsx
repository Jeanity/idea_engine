import { redirect } from 'next/navigation'
import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { readGlobalDemoMode } from '@/lib/demo-mode'
import AccountForm from '../account-form'
import DemoModeToggle from '../demo-mode-toggle'
import { DangerZone } from './danger-zone'

export const metadata = { title: 'Settings — HadIdea' }

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

  // app_settings is service-role only (no RLS policies, migration 013) —
  // minting the service client here is safe BECAUSE it's behind isAdmin,
  // same pattern as the admin pages.
  const globalDemoMode = isAdmin ? await readGlobalDemoMode(createServiceClient()) : false

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-white light:text-gray-900 mb-1">Settings</h1>
      <p className="text-sm text-slate-400 light:text-gray-500 mb-8">Manage your profile and preferences.</p>

      {welcome === '1' && (
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.06] light:border-indigo-200 light:bg-indigo-50 px-5 py-4 mb-8">
          <p className="text-sm font-medium text-indigo-200 light:text-indigo-800">Welcome to HadIdea!</p>
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
              Demo Mode answers report runs from canned fixtures — no API spend. This toggle applies to your account only.
            </p>
            <DemoModeToggle demoMode={profile?.demo_mode ?? false} />

            <div className="mt-6 pt-6 border-t border-white/10 light:border-gray-200">
              <h3 className="text-sm font-semibold text-white light:text-gray-900 mb-1">Sitewide demo mode</h3>
              <p className="text-sm text-slate-400 light:text-gray-500 mb-4">
                Every report for every user runs from fixtures — zero API spend anywhere.
                Real users get canned reports while this is on, so it&apos;s for testing windows only.
              </p>
              <DemoModeToggle demoMode={globalDemoMode} endpoint="/api/admin/demo-mode" />
            </div>
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
