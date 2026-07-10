import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { logError } from '@/lib/log-error'
import { NextResponse, type NextRequest } from 'next/server'

async function requireAdmin() {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { denied: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) }
  if (!isAdminEmail(user.email)) return { denied: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { denied: null }
}

// ── Rename a group ───────────────────────────────────────────────────────
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ gid: string }> }) {
  const { denied } = await requireAdmin()
  if (denied) return denied

  const { gid } = await params
  if (!gid) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name || name.length > 120) {
    return NextResponse.json({ error: 'Name is required (max 120 characters).' }, { status: 400 })
  }

  const service = createServiceClient()
  const { error } = await service.from('survey_groups').update({ name }).eq('id', gid)

  if (error) {
    console.error('Error renaming survey group:', error)
    await logError({ source: 'api:admin/surveys', message: `Rename group failed: ${error.message}`, detail: error, path: 'PATCH /api/admin/surveys/groups/[gid]' })
    return NextResponse.json({ error: 'Failed to rename group.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// ── Delete a group ───────────────────────────────────────────────────────
// Reversible in effect — member surveys survive and become ungrouped
// (surveys.group_id is ON DELETE SET NULL), so a plain confirm is enough.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ gid: string }> }) {
  const { denied } = await requireAdmin()
  if (denied) return denied

  const { gid } = await params
  if (!gid) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  if (body.confirm !== true) {
    return NextResponse.json({ error: 'Deletion must be confirmed.' }, { status: 400 })
  }

  const service = createServiceClient()
  const { error } = await service.from('survey_groups').delete().eq('id', gid)

  if (error) {
    console.error('Error deleting survey group:', error)
    await logError({ source: 'api:admin/surveys', message: `Delete group failed: ${error.message}`, detail: error, path: 'DELETE /api/admin/surveys/groups/[gid]' })
    return NextResponse.json({ error: 'Failed to delete group.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
