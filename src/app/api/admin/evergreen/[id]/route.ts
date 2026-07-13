import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { logError } from '@/lib/log-error'
import { NextResponse, type NextRequest } from 'next/server'

// Admin-only row actions for the evergreen baselines queue
// (/app/admin/evergreen). The /app/admin layout gates the PAGE, but that
// gate does NOT protect this route — every admin API route re-checks
// isAdminEmail itself, per project ground rules. The service client is only
// ever created AFTER that check passes (matches src/app/api/admin/bugs/[id]).

// Postgres 42P01 = undefined_table, PostgREST PGRST205 = "table not found in
// schema cache" — both mean migration 030 hasn't been run yet.
function isMissingTable(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

/** The acting admin's email on success, or a NextResponse to return as-is (401/403). */
async function requireAdmin(): Promise<{ email: string } | NextResponse> {
  const supabase = await createDbClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return { email: user.email! }
}

// PATCH: { action: 'approve' } → review_status 'approved', reviewed_at now.
// review_status is informational only (phase 1) — this never gates serving,
// it just lets Danny mark an entry as eyeballed.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const { id } = await params
  if (typeof id !== 'string' || !id) {
    return NextResponse.json({ error: 'Invalid evergreen baseline id' }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  if (body.action !== 'approve') {
    return NextResponse.json({ error: "Only { action: 'approve' } is supported." }, { status: 400 })
  }

  const service = createServiceClient()
  const { error } = await service
    .from('evergreen_baselines')
    .update({ review_status: 'approved', reviewed_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json(
        { error: 'Evergreen baselines table is not available right now — please try again later.' },
        { status: 503 }
      )
    }
    console.error('Error approving evergreen baseline:', error)
    await logError({
      source: 'api:admin/evergreen/[id]',
      message: `Approve evergreen baseline failed: ${error.message}`,
      detail: error,
      path: 'PATCH /api/admin/evergreen/[id]',
    })
    return NextResponse.json({ error: 'Failed to approve the baseline.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// DELETE: evicts the row — the next report from this country x archetype x
// section regenerates it. No confirm UI beyond the caller's window.confirm().
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const { id } = await params
  if (typeof id !== 'string' || !id) {
    return NextResponse.json({ error: 'Invalid evergreen baseline id' }, { status: 400 })
  }

  const service = createServiceClient()
  const { error } = await service.from('evergreen_baselines').delete().eq('id', id)

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json(
        { error: 'Evergreen baselines table is not available right now — please try again later.' },
        { status: 503 }
      )
    }
    console.error('Error deleting evergreen baseline:', error)
    await logError({
      source: 'api:admin/evergreen/[id]',
      message: `Delete evergreen baseline failed: ${error.message}`,
      detail: error,
      path: 'DELETE /api/admin/evergreen/[id]',
    })
    return NextResponse.json({ error: 'Failed to delete the baseline.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
