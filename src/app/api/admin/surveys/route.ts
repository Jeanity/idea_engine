import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { logError } from '@/lib/log-error'
import { isMissingTable, isMissingColumn } from '@/lib/app-settings'
import { validateSurveyFields } from '@/lib/survey'
import { NextResponse, type NextRequest } from 'next/server'

async function requireAdmin() {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { denied: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) }
  if (!isAdminEmail(user.email)) return { denied: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { denied: null }
}

// ── Everything the management page needs in one read ────────────────────
// Groups + surveys, each survey carrying its full question list (with
// per-question response counts, for the delete-vs-deactivate rule) and its
// distinct-respondent count.
export async function GET() {
  const { denied } = await requireAdmin()
  if (denied) return denied

  const service = createServiceClient()

  const { data: surveys, error: sError } = await service
    .from('surveys')
    .select('id, name, group_id, active, placement, audience, sort_order, created_at, promo_gate')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  // isMissingColumn (42703) covers migration 028 (surveys.promo_gate) not
  // having run yet — same "run the migration" notice as a missing table,
  // since the admin surveys page can't render meaningfully without it.
  if (isMissingTable(sError) || isMissingColumn(sError)) {
    return NextResponse.json({ migrationMissing: true })
  }
  if (sError) {
    console.error('Error loading surveys:', sError)
    return NextResponse.json({ error: 'Failed to load surveys.' }, { status: 500 })
  }

  const [groupsRes, questionsRes, responsesRes] = await Promise.all([
    service.from('survey_groups').select('id, name, created_at').order('created_at', { ascending: true }),
    service
      .from('survey_questions')
      .select('id, survey_id, prompt, qtype, options, sort_order, active, created_at')
      .order('sort_order', { ascending: true }),
    service.from('survey_responses').select('survey_id, question_id, user_id'),
  ])

  if (groupsRes.error || questionsRes.error || responsesRes.error) {
    console.error('Error loading survey admin data:', groupsRes.error ?? questionsRes.error ?? responsesRes.error)
    return NextResponse.json({ error: 'Failed to load surveys.' }, { status: 500 })
  }

  const countByQuestion = new Map<string, number>()
  const usersBySurvey = new Map<string, Set<string>>()
  for (const r of responsesRes.data ?? []) {
    countByQuestion.set(r.question_id, (countByQuestion.get(r.question_id) ?? 0) + 1)
    const users = usersBySurvey.get(r.survey_id) ?? new Set<string>()
    users.add(r.user_id)
    usersBySurvey.set(r.survey_id, users)
  }

  const questionsBySurvey = new Map<string, unknown[]>()
  for (const q of questionsRes.data ?? []) {
    const list = questionsBySurvey.get(q.survey_id) ?? []
    list.push({ ...q, responseCount: countByQuestion.get(q.id) ?? 0 })
    questionsBySurvey.set(q.survey_id, list)
  }

  return NextResponse.json({
    migrationMissing: false,
    groups: groupsRes.data ?? [],
    surveys: (surveys ?? []).map(s => ({
      ...s,
      questions: questionsBySurvey.get(s.id) ?? [],
      respondentCount: usersBySurvey.get(s.id)?.size ?? 0,
    })),
  })
}

// ── Create a survey ──────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const { denied } = await requireAdmin()
  if (denied) return denied

  const body = await request.json().catch(() => ({}))
  const parsed = validateSurveyFields(body)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  // promo_gate: reserves this survey for the promo-overlay flow instead of
  // normal placement rotation (src/lib/survey.ts). Optional, defaults false.
  let promoGate = false
  if ('promo_gate' in body) {
    if (typeof body.promo_gate !== 'boolean') {
      return NextResponse.json({ error: 'promo_gate must be a boolean.' }, { status: 400 })
    }
    promoGate = body.promo_gate
  }

  const service = createServiceClient()

  // New surveys append to the end of the order and start INACTIVE — Danny
  // adds questions first, then flips them on.
  const { data: last } = await service
    .from('surveys')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await service
    .from('surveys')
    .insert({ ...parsed, active: false, promo_gate: promoGate, sort_order: (last?.sort_order ?? -1) + 1 })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating survey:', error)
    await logError({ source: 'api:admin/surveys', message: `Create survey failed: ${error.message}`, detail: error, path: 'POST /api/admin/surveys' })
    return NextResponse.json({ error: 'Failed to create survey.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: data.id })
}
