import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { logError } from '@/lib/log-error'
import type { Database } from '@/lib/database.types'
import { NextResponse, type NextRequest } from 'next/server'

type SampleUpdate = Database['public']['Tables']['sample_reports']['Update']

async function requireAdmin(): Promise<{ email: string } | NextResponse> {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return { email: user.email! }
}

// ── Partial update: title / restatement / archetype / active / sort_order ──
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const update: SampleUpdate = {}

  if ('title' in body) {
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) return NextResponse.json({ error: 'Title cannot be empty.' }, { status: 400 })
    update.title = title
  }
  if ('restatement' in body) {
    const restatement = typeof body.restatement === 'string' ? body.restatement.trim() : ''
    if (!restatement) return NextResponse.json({ error: 'Restatement cannot be empty.' }, { status: 400 })
    update.restatement = restatement
  }
  if ('archetype' in body) {
    const archetype = typeof body.archetype === 'string' ? body.archetype.trim() : ''
    if (!archetype) return NextResponse.json({ error: 'Archetype cannot be empty.' }, { status: 400 })
    update.archetype = archetype
  }
  if ('active' in body) {
    if (typeof body.active !== 'boolean') return NextResponse.json({ error: 'active must be a boolean.' }, { status: 400 })
    update.active = body.active
  }
  if ('sort_order' in body) {
    const n = Number(body.sort_order)
    if (!Number.isInteger(n)) return NextResponse.json({ error: 'sort_order must be an integer.' }, { status: 400 })
    update.sort_order = n
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update.' }, { status: 400 })
  }
  update.updated_at = new Date().toISOString()

  const service = createServiceClient()
  const { error } = await service.from('sample_reports').update(update).eq('id', id)

  if (error) {
    console.error('Error updating sample:', error)
    await logError({ source: 'api:admin/samples', message: `Update sample failed: ${error.message}`, detail: error, path: `PATCH /api/admin/samples/${id}` })
    return NextResponse.json({ error: 'Failed to update sample.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// ── Hard delete (requires explicit confirmation) ────────────────────────
// Samples are copies — deleting one never touches the source report. The UI
// must send { confirm: true } after an explicit confirmation step (Danny's
// standing rule: destructive actions always need explicit confirm).
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  if (body.confirm !== true) {
    return NextResponse.json({ error: 'Deletion must be confirmed.' }, { status: 400 })
  }

  const service = createServiceClient()
  const { error } = await service.from('sample_reports').delete().eq('id', id)

  if (error) {
    console.error('Error deleting sample:', error)
    await logError({ source: 'api:admin/samples', message: `Delete sample failed: ${error.message}`, detail: error, path: `DELETE /api/admin/samples/${id}` })
    return NextResponse.json({ error: 'Failed to delete sample.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
