import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { logError } from '@/lib/log-error'
import { validateQuestionFields } from '@/lib/survey'
import { NextResponse, type NextRequest } from 'next/server'

async function requireAdmin() {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { denied: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) }
  if (!isAdminEmail(user.email)) return { denied: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { denied: null }
}

// ── Create a question within a survey ────────────────────────────────────
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { denied } = await requireAdmin()
  if (denied) return denied

  const { id: surveyId } = await params
  if (!surveyId) return NextResponse.json({ error: 'Missing survey id.' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const parsed = validateQuestionFields(body)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const service = createServiceClient()

  const { data: survey } = await service.from('surveys').select('id').eq('id', surveyId).maybeSingle()
  if (!survey) return NextResponse.json({ error: 'Survey not found.' }, { status: 404 })

  // New questions append to the end of THIS survey's sort order.
  const { data: last } = await service
    .from('survey_questions')
    .select('sort_order')
    .eq('survey_id', surveyId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await service
    .from('survey_questions')
    .insert({ ...parsed, survey_id: surveyId, sort_order: (last?.sort_order ?? -1) + 1 })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating survey question:', error)
    await logError({ source: 'api:admin/surveys', message: `Create question failed: ${error.message}`, detail: error, path: 'POST /api/admin/surveys/[id]/questions' })
    return NextResponse.json({ error: 'Failed to create question.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: data.id })
}
