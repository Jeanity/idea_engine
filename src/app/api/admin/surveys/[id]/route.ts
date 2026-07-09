import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { logError } from '@/lib/log-error'
import type { Database } from '@/lib/database.types'
import { NextResponse, type NextRequest } from 'next/server'

type QuestionUpdate = Database['public']['Tables']['survey_questions']['Update']

async function requireAdmin(): Promise<{ email: string } | NextResponse> {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return { email: user.email! }
}

// ── Update: active toggle, sort_order (reorder), or prompt/options edit ──
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const update: QuestionUpdate = {}

  if ('active' in body) {
    if (typeof body.active !== 'boolean') return NextResponse.json({ error: 'active must be a boolean.' }, { status: 400 })
    update.active = body.active
  }
  if ('sort_order' in body) {
    const n = Number(body.sort_order)
    if (!Number.isInteger(n)) return NextResponse.json({ error: 'sort_order must be an integer.' }, { status: 400 })
    update.sort_order = n
  }
  if ('prompt' in body) {
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
    if (!prompt || prompt.length > 500) return NextResponse.json({ error: 'Prompt is required (max 500 characters).' }, { status: 400 })
    update.prompt = prompt
  }
  if ('options' in body) {
    const raw = Array.isArray(body.options) ? body.options : []
    const options = raw.filter((o: unknown): o is string => typeof o === 'string' && o.trim().length > 0).map((o: string) => o.trim())
    update.options = options
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update.' }, { status: 400 })
  }

  const service = createServiceClient()
  const { error } = await service.from('survey_questions').update(update).eq('id', id)

  if (error) {
    console.error('Error updating survey question:', error)
    await logError({ source: 'api:admin/surveys', message: `Update question failed: ${error.message}`, detail: error, path: 'PATCH /api/admin/surveys/[id]' })
    return NextResponse.json({ error: 'Failed to update question.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// ── Hard delete — allowed ONLY when the question has zero responses ──────
// Questions with responses can only be deactivated (PATCH active:false):
// responses are never destroyed as a side effect of managing questions. The
// UI must send { confirm: true } after an explicit confirmation step.
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
    .eq('question_id', id)

  if (countError) {
    console.error('Error checking survey responses:', countError)
    return NextResponse.json({ error: 'Failed to check existing responses.' }, { status: 500 })
  }
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: 'This question has responses and cannot be deleted — deactivate it instead.' },
      { status: 409 }
    )
  }

  const { error } = await service.from('survey_questions').delete().eq('id', id)

  if (error) {
    console.error('Error deleting survey question:', error)
    await logError({ source: 'api:admin/surveys', message: `Delete question failed: ${error.message}`, detail: error, path: 'DELETE /api/admin/surveys/[id]' })
    return NextResponse.json({ error: 'Failed to delete question.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
