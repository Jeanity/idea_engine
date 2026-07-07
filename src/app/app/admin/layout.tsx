import { redirect } from 'next/navigation'
import { createDbClient } from '@/lib/db'
import { AppHeader } from '@/components/app-header'
import { isAdminEmail } from '@/lib/admin'
import { AdminNav } from './admin-nav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isAdminEmail(user.email)) {
    redirect('/app')
  }

  return (
    <main className="min-h-screen bg-slate-950 light:bg-gray-50">
      <AppHeader email={user.email!} />
      <AdminNav />
      <div className="max-w-5xl mx-auto px-6 py-12">{children}</div>
    </main>
  )
}
