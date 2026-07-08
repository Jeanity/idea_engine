import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { logError } from '@/lib/log-error'
import { NextResponse, type NextRequest } from 'next/server'

// Admin-only maintenance for the error log (Block R4). The /app/admin layout
// gates the PAGE, but that gate does NOT protect this route — every admin API
// route re-checks isAdminEmail itself, per project ground rules. The service
// client is only ever created AFTER that check passes.

/** 401 if signed out, 403 if not an admin, else null. */
async function requireAdmin(): Promise<NextResponse | null> {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

// Typed confirmation phrase for the destructive clear-all, per the deletion
// ground rule (no one-click destructive actions).
const CLEAR_ALL_PHRASE = 'DELETE ALL'

// DELETE: remove one row ({ id }) or clear the whole log
// ({ scope: 'all', confirm: 'DELETE ALL' }).
export async function DELETE(request: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied

  const body = await request.json().catch(() => ({}))
  const service = createServiceClient()

  if (body.scope === 'all') {
    if (body.confirm !== CLEAR_ALL_PHRASE) {
      return NextResponse.json({ error: `Type "${CLEAR_ALL_PHRASE}" to confirm.` }, { status: 400 })
    }
    // Delete every row. `neq id, all-zero uuid` is an always-true predicate that
    // satisfies PostgREST's requirement for a filter on bulk delete.
    const { error } = await service
      .from('error_log')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) {
      await logError({ source: 'api:admin/errors', message: `Clear-all error log failed: ${error.message}`, detail: error, path: 'DELETE /api/admin/errors' })
      return NextResponse.json({ error: 'Failed to clear the error log.' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  const id = typeof body.id === 'string' ? body.id : ''
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })

  const { error } = await service.from('error_log').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: 'Failed to delete the entry.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
