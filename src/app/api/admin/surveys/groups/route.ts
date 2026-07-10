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

// ── Create a survey group ────────────────────────────────────────────────
// (The group list rides along on GET /api/admin/surveys — no GET here.)
export async function POST(request: NextRequest) {
  const { denied } = await requireAdmin()
  if (denied) return denied

  const body = await request.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name || name.length > 120) {
    return NextResponse.json({ error: 'Name is required (max 120 characters).' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data, error } = await service.from('survey_groups').insert({ name }).select('id').single()

  if (error) {
    console.error('Error creating survey group:', error)
    await logError({ source: 'api:admin/surveys', message: `Create group failed: ${error.message}`, detail: error, path: 'POST /api/admin/surveys/groups' })
    return NextResponse.json({ error: 'Failed to create group.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: data.id })
}
