import { createDbClient } from '@/lib/db'
import { DashboardClient } from './dashboard-client'

export const metadata = { title: 'Admin — Idea Engine' }

export default async function AdminDashboardPage() {
  // The layout already gated on isAdminEmail; we just need the admin's id to
  // key their per-admin dashboard layout (order + span) in localStorage.
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()

  return <DashboardClient adminId={user?.id ?? 'admin'} />
}
