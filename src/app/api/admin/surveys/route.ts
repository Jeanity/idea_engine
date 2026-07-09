import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { logError } from '@/lib/log-error'
import { isMissingTable } from '@/lib/app-settings'
import { readSurveyConfig, writeSurveyConfig, validateQuestionFields } from '@/lib/survey'
import { NextResponse, type NextRequest } from 'next/server'

async function requireAdmin() {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { denied: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) }
  if (!isAdminEmail(user.email)) return { denied: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { denied: null }
}

// ── Master toggle + full question list (incl. inactive) ────────────────
export async function GET() {
  const { denied } = await requireAdmin()
  if (denied) return denied

  const service = createServiceClient()

  const probe = await service.from('survey_questions').select('id').limit(1)
  if (isMissingTable(probe.error)) {
    return NextResponse.json({ migrationMissing: true })
  }

  const config = await readSurveyConfig(service)

  const { data: questions, error } = await service
    .from('survey_questions')
    .select('id, prompt, qtype, options, sort_order, active, created_at')
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Error loading survey questions:', error)
    return NextResponse.json({ error: 'Failed to load questions.' }, { status: 500 })
  }

  // Response counts per question (for the delete-vs-deactivate rule in the UI).
  const { data: counts } = await service.from('survey_responses').select('question_id')
  const countByQuestion = new Map<string, number>()
  for (const row of counts ?? []) {
    countByQuestion.set(row.question_id, (countByQuestion.get(row.question_id) ?? 0) + 1)
  }

  return NextResponse.json({
    migrationMissing: false,
    enabled: config.enabled,
    questions: (questions ?? []).map(q => ({ ...q, responseCount: countByQuestion.get(q.id) ?? 0 })),
  })
}

// ── Master on/off toggle ────────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  const { denied } = await requireAdmin()
  if (denied) return denied

  const body = await request.json().catch(() => ({}))
  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be a boolean.' }, { status: 400 })
  }

  const service = createServiceClient()
  const { error } = await writeSurveyConfig(service, { enabled: body.enabled })
  if (error) {
    console.error('Error updating survey config:', error)
    await logError({ source: 'api:admin/surveys', message: `Update survey config failed: ${error}`, path: 'PATCH /api/admin/surveys' })
    return NextResponse.json({ error: 'Failed to update survey settings.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// ── Create a question ───────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const { denied } = await requireAdmin()
  if (denied) return denied

  const body = await request.json().catch(() => ({}))
  const parsed = validateQuestionFields(body)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const service = createServiceClient()

  // New questions append to the end of the current sort order.
  const { data: last } = await service
    .from('survey_questions')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await service
    .from('survey_questions')
    .insert({ ...parsed, sort_order: (last?.sort_order ?? -1) + 1 })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating survey question:', error)
    await logError({ source: 'api:admin/surveys', message: `Create question failed: ${error.message}`, detail: error, path: 'POST /api/admin/surveys' })
    return NextResponse.json({ error: 'Failed to create question.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: data.id })
}
