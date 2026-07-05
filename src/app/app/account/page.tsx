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

  return (
    <main className="min-h-screen bg-gray-50">
      <AppHeader email={user.email!} />
      <div className="max-w-xl mx-auto px-6 py-12">
        <Link href="/app" className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium mb-6">
          ← Back to your ideas
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Account</h1>
        <p className="text-sm text-gray-500 mb-8">Manage your profile and preferences.</p>
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-6">
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
