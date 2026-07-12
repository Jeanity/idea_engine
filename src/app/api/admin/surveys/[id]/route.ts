import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { logError } from '@/lib/log-error'
import { SURVEY_PLACEMENTS, SURVEY_AUDIENCES } from '@/lib/survey'
import type { Database, SurveyPlacement, SurveyAudience } from '@/lib/database.types'
import { NextResponse, type NextRequest } from 'next/server'

type SurveyUpdate = Database['public']['Tables']['surveys']['Update']

async function requireAdmin(): Promise<{ email: string } | NextResponse> {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return { email: user.email! }
}

// ── Update a survey: name, group, active, placement, audience, order ─────
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const update: SurveyUpdate = {}

  if ('name' in body) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name || name.length > 120) return NextResponse.json({ error: 'Name is required (max 120 characters).' }, { status: 400 })
    update.name = name
  }
  if ('group_id' in body) {
    if (body.group_id !== null && typeof body.group_id !== 'string') {
      return NextResponse.json({ error: 'group_id must be a group id or null.' }, { status: 400 })
    }
    update.group_id = body.group_id
  }
  if ('active' in body) {
    if (typeof body.active !== 'boolean') return NextResponse.json({ error: 'active must be a boolean.' }, { status: 400 })
    update.active = body.active
  }
  if ('placement' in body) {
    if (!SURVEY_PLACEMENTS.includes(body.placement)) {
      return NextResponse.json({ error: 'placement must be one of ' + SURVEY_PLACEMENTS.join(', ') + '.' }, { status: 400 })
    }
    update.placement = body.placement as SurveyPlacement
  }
  if ('audience' in body) {
    if (!SURVEY_AUDIENCES.includes(body.audience)) {
      return NextResponse.json({ error: 'audience must be one of ' + SURVEY_AUDIENCES.join(', ') + '.' }, { status: 400 })
    }
    update.audience = body.audience as SurveyAudience
  }
  if ('sort_order' in body) {
    const n = Number(body.sort_order)
    if (!Number.isInteger(n)) return NextResponse.json({ error: 'sort_order must be an integer.' }, { status: 400 })
    update.sort_order = n
  }
  if ('promo_gate' in body) {
    if (typeof body.promo_gate !== 'boolean') return NextResponse.json({ error: 'promo_gate must be a boolean.' }, { status: 400 })
    update.promo_gate = body.promo_gate
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update.' }, { status: 400 })
  }

  const service = createServiceClient()
  const { error } = await service.from('surveys').update(update).eq('id', id)

  if (error) {
    console.error('Error updating survey:', error)
    await logError({ source: 'api:admin/surveys', message: `Update survey failed: ${error.message}`, detail: error, path: 'PATCH /api/admin/surveys/[id]' })
    return NextResponse.json({ error: 'Failed to update survey.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// ── Hard delete — allowed ONLY when the survey has zero responses ─────────
// A survey with responses can only be deactivated: responses are never
// destroyed as a side effect of managing surveys (same rule as questions).
// Deleting cascades to its questions (fk on delete cascade), which is safe
// exactly because the zero-responses check passed.
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

  const { count, error: countError } = await service
    .from('survey_responses')
    .select('id', { count: 'exact', head: true })
    .eq('survey_id', id)

  if (countError) {
    console.error('Error checking survey responses:', countError)
    return NextResponse.json({ error: 'Failed to check existing responses.' }, { status: 500 })
  }
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: 'This survey has responses and cannot be deleted — deactivate it instead.' },
      { status: 409 }
    )
  }

  const { error } = await service.from('surveys').delete().eq('id', id)

  if (error) {
    console.error('Error deleting survey:', error)
    await logError({ source: 'api:admin/surveys', message: `Delete survey failed: ${error.message}`, detail: error, path: 'DELETE /api/admin/surveys/[id]' })
    return NextResponse.json({ error: 'Failed to delete survey.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
