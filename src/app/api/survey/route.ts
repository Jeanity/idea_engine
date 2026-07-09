import { createDbClient, createServiceClient } from '@/lib/db'
import { logError } from '@/lib/log-error'
import { readSurveyConfig, validateSurveySubmission, type SurveyQuestionForValidation } from '@/lib/survey'
import { isMissingTable } from '@/lib/app-settings'
import { NextResponse, type NextRequest } from 'next/server'

// Public survey submission. Uses the per-request (RLS) client for BOTH the
// question lookup and the insert — "survey_responses: authenticated insert
// own" (migration 014) is what actually authorises the write, not app code.
// The service client is only used transiently to read the on/off flag
// (app_settings has no RLS policies at all).
export async function POST(request: NextRequest) {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const answers = Array.isArray(body.answers) ? body.answers : []
  const reportId = typeof body.report_id === 'string' ? body.report_id : null

  const service = createServiceClient()
  const config = await readSurveyConfig(service)
  if (!config.enabled) {
    return NextResponse.json({ error: 'The survey is not currently open.' }, { status: 403 })
  }

  const { data: questions, error: qError } = await supabase
    .from('survey_questions')
    .select('id, qtype, options')
    .eq('active', true)

  if (qError) {
    if (isMissingTable(qError)) {
      return NextResponse.json({ error: 'The survey is not currently open.' }, { status: 403 })
    }
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
