import { createDbClient } from '@/lib/db'
import { logError } from '@/lib/log-error'
import { validateSurveySubmission, type SurveyQuestionForValidation } from '@/lib/survey'
import { isMissingTable } from '@/lib/app-settings'
import { NextResponse, type NextRequest } from 'next/server'

// Public survey submission. Uses the per-request (RLS) client for EVERY read
// and the insert — "surveys: public select active" (migration 025),
// "survey_questions: public select active", and "survey_responses:
// authenticated insert own" (migration 014) are what actually authorise the
// operations, not app code. An inactive or nonexistent survey id is simply
// invisible through RLS, so both collapse into the same "not open" answer.
export async function POST(request: NextRequest) {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const answers = Array.isArray(body.answers) ? body.answers : []
  const reportId = typeof body.report_id === 'string' ? body.report_id : null
  const surveyId = typeof body.survey_id === 'string' ? body.survey_id : null
  if (!surveyId) {
    return NextResponse.json({ error: 'Missing survey.' }, { status: 400 })
  }

  const { data: survey, error: sError } = await supabase
    .from('surveys')
    .select('id')
    .eq('id', surveyId)
    .maybeSingle()

  if (sError && !isMissingTable(sError)) {
    console.error('Error loading survey:', sError)
    await logError({ source: 'api:survey', message: `Load survey failed: ${sError.message}`, detail: sError, path: 'POST /api/survey', userId: user.id })
    return NextResponse.json({ error: 'Something went wrong — please try again.' }, { status: 500 })
  }
  if (!survey) {
    return NextResponse.json({ error: 'This survey is not currently open.' }, { status: 403 })
  }

  // One submission per user per survey — the DB has no unique constraint on
  // (user_id, survey_id) because a survey has many questions per user, so
  // this pre-check is the guard. (A racing double-click could still slip
  // through; harmless — the admin aggregates count respondents by user.)
  const { data: existing } = await supabase
    .from('survey_responses')
    .select('id')
    .eq('user_id', user.id)
    .eq('survey_id', surveyId)
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'You have already answered this survey.' }, { status: 409 })
  }

  const { data: questions, error: qError } = await supabase
    .from('survey_questions')
    .select('id, qtype, options')
    .eq('survey_id', surveyId)
    .eq('active', true)

  if (qError) {
    console.error('Error loading survey questions:', qError)
    await logError({ source: 'api:survey', message: `Load questions failed: ${qError.message}`, detail: qError, path: 'POST /api/survey', userId: user.id })
    return NextResponse.json({ error: 'Something went wrong — please try again.' }, { status: 500 })
  }

  const questionsForValidation: SurveyQuestionForValidation[] = (questions ?? []).map(q => ({
    id: q.id,
    qtype: q.qtype,
    options: (q.options as string[] | null) ?? null,
  }))

  const result = validateSurveySubmission(questionsForValidation, answers)
  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  const { error: insertError } = await supabase.from('survey_responses').insert(
    result.answers.map(a => ({
      survey_id: surveyId,
      question_id: a.question_id,
      user_id: user.id,
      report_id: reportId,
      answer: a.answer,
    }))
  )

  if (insertError) {
    console.error('Error inserting survey responses:', insertError)
    await logError({ source: 'api:survey', message: `Insert responses failed: ${insertError.message}`, detail: insertError, path: 'POST /api/survey', userId: user.id })
    return NextResponse.json({ error: 'Could not save your answers — please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
