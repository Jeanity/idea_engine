import { redirect } from 'next/navigation'
import { createDbClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { AdminShell } from './admin-shell'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isAdminEmail(user.email)) {
    redirect('/app')
  }

  // Server component keeps the auth gate; the sidebar/topbar chrome is a client
  // shell rendered inside it. Existing admin pages render as `children`.
  return <AdminShell email={user.email!}>{children}</AdminShell>
}
