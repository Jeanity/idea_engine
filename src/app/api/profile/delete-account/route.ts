import { createDbClient, createServiceClient } from '@/lib/db'
import { logError } from '@/lib/log-error'
import { isMissingEvergreenTable } from '@/lib/evergreen'
import { NextResponse, type NextRequest } from 'next/server'

// Self-service, irreversible account deletion. FK cascades (auth.users ->
// profiles -> ideas -> answers/reports -> report_feedback/purchases, all
// `on delete cascade` — verified against supabase/migrations/001_initial_schema.sql
// and 004_report_feedback.sql) mean a single admin.deleteUser call removes the
// user and every row they own. Same cascade the admin "remove account" route
// relies on (src/app/api/admin/users/[id]/route.ts) — no manual child-table
// cleanup needed here either.
//
// ONE exception (Workstream D2, migration 031_evergreen_lifecycle.sql):
// evergreen_report_usage rows carry a user_id column but have NO FK to
// auth.users (they FK to evergreen_baselines, on delete cascade — deleting a
// baseline cleans up its own usage history, not a user's), so they would
// otherwise outlive a deleted account. Deleted explicitly below, BEFORE the
// deleteUser call — missing-table tolerant (031 not run yet), and non-fatal:
// a failure here must never block the user's own account deletion.
export async function DELETE(request: NextRequest) {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  if (body?.confirm !== 'DELETE') {
    return NextResponse.json({ error: 'Type DELETE to confirm.' }, { status: 400 })
  }

  // Only used AFTER the auth check above, per project ground rules.
  const service = createServiceClient()

  const { error: usageDeleteError } = await service
    .from('evergreen_report_usage')
    .delete()
    .eq('user_id', user.id)
  if (usageDeleteError && !isMissingEvergreenTable(usageDeleteError)) {
    console.error(`[account] self-delete: failed to clean up evergreen_report_usage for ${user.id}:`, usageDeleteError.message)
  }

  const { error } = await service.auth.admin.deleteUser(user.id)
  if (error) {
    console.error(`[account] self-delete failed for ${user.email} (${user.id}):`, error.message)
    await logError({
      source: 'api:delete-account',
      message: `Self-service delete-account failed: ${error.message}`,
      detail: { userId: user.id, email: user.email, error: error.message },
      path: 'DELETE /api/profile/delete-account',
      userId: user.id,
    })
    return NextResponse.json({ error: 'Failed to delete account.' }, { status: 500 })
  }

  console.log(`[account] self-delete: ${user.email} (${user.id}) deleted their own account`)

  return NextResponse.json({ ok: true })
}
