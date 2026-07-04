import { createDbClient } from '@/lib/db'
import { redirect } from 'next/navigation'
import SignOutButton from './sign-out-button'

export const metadata = { title: 'Dashboard — Idea Engine' }

export default async function DashboardPage() {
  const supabase = await createDbClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in')

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <span className="font-semibold text-gray-900">Idea Engine</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{user.email}</span>
          <SignOutButton />
        </div>
      </header>
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Your ideas</h1>
        <p className="text-gray-500 text-sm">Nothing here yet — idea intake coming in Phase 2.</p>
      </div>
    </main>
  )
}
