import { createDbClient } from '@/lib/db'
import { DashboardClient } from './dashboard-client'

export const metadata = { title: 'Admin — HadIdea' }

// Postgres 42703 = undefined_column, PostgREST PGRST204 = "column not found
// in schema cache" — both mean migration 021 (admin_dashboard_layout) hasn't
// been run in this environment yet. Fall back to no server layout; the
// client then uses its localStorage cache / widget defaults, same as before
// this migration existed.
function isMissingColumn(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42703' || error?.code === 'PGRST204'
}

export default async function AdminDashboardPage() {
  // The layout already gated on isAdminEmail; we just need the admin's id to
  // key their per-admin dashboard layout in localStorage, and to load their
  // saved server-side layout (this is the source of truth — see
  // dashboard-grid.tsx's server → localStorage → defaults precedence).
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()

  let initialLayout: unknown = null
  if (user) {
    const { data, error } = await supabase
      .from('profiles')
      .select('admin_dashboard_layout')
      .eq('id', user.id)
      .single()
    if (error && !isMissingColumn(error)) {
      console.error('Error loading admin dashboard layout:', error)
    }
    initialLayout = data?.admin_dashboard_layout ?? null
  }

  return <DashboardClient adminId={user?.id ?? 'admin'} initialLayout={initialLayout} />
}
