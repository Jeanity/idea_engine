import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { toPublicDisplayName } from '@/lib/public-name'
import { NextResponse, type NextRequest } from 'next/server'

async function requireAdmin() {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { denied: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) }
  if (!isAdminEmail(user.email)) return { denied: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { denied: null }
}

// Per-question aggregation for the admin analytics view, scoped to either
// one survey (?survey=<id>) or a whole group rollup (?group=<id>): rating ->
// average + 1-5 distribution; multiple_choice -> counts per option; text ->
// the raw list (with a display name + date). Each question carries its
// survey's name so a group rollup stays legible.
export async function GET(request: NextRequest) {
  const { denied } = await requireAdmin()
  if (denied) return denied

  const surveyId = request.nextUrl.searchParams.get('survey')
  const groupId = request.nextUrl.searchParams.get('group')
  if (!surveyId && !groupId) {
    return NextResponse.json({ error: 'Pass ?survey=<id> or ?group=<id>.' }, { status: 400 })
  }

  const service = createServiceClient()

  let surveysQuery = service.from('surveys').select('id, name, sort_order, created_at')
  surveysQuery = surveyId ? surveysQuery.eq('id', surveyId) : surveysQuery.eq('group_id', groupId!)
  const { data: surveys, error: sError } = await surveysQuery
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (sError) {
    return NextResponse.json({ error: 'Failed to load surveys.' }, { status: 500 })
  }
  const surveyIds = (surveys ?? []).map(s => s.id)
  if (surveyIds.length === 0) {
    return NextResponse.json({ questions: [], totalRespondents: 0 })
  }
  const nameBySurvey = new Map((surveys ?? []).map(s => [s.id, s.name]))

  const { data: questions, error: qError } = await service
    .from('survey_questions')
    .select('id, survey_id, prompt, qtype, options, sort_order, active')
    .in('survey_id', surveyIds)
    .order('sort_order', { ascending: true })

  if (qError) {
    return NextResponse.json({ error: 'Failed to load questions.' }, { status: 500 })
  }

  const { data: responses, error: rError } = await service
    .from('survey_responses')
    .select('id, question_id, user_id, answer, created_at')
    .in('survey_id', surveyIds)
    .order('created_at', { ascending: false })

  if (rError) {
    return NextResponse.json({ error: 'Failed to load responses.' }, { status: 500 })
  }

  const userIds = Array.from(new Set((responses ?? []).map(r => r.user_id)))
  const { data: profiles } = userIds.length > 0
    ? await service.from('profiles').select('id, username, display_name').in('id', userIds)
    : { data: [] }
  const nameById = new Map((profiles ?? []).map(p => [p.id, toPublicDisplayName(p.username, p.display_name, 'A user')]))

  const responsesByQuestion = new Map<string, typeof responses>()
  for (const r of responses ?? []) {
    const list = responsesByQuestion.get(r.question_id) ?? []
    list.push(r)
    responsesByQuestion.set(r.question_id, list)
  }

  // Group rollups list every member survey's questions in survey order —
  // sort questions by survey first so they don't interleave.
  const surveyOrder = new Map(surveyIds.map((id, i) => [id, i]))
  const ordered = [...(questions ?? [])].sort(
    (a, b) => (surveyOrder.get(a.survey_id)! - surveyOrder.get(b.survey_id)!) || a.sort_order - b.sort_order
  )

  const results = ordered.map(q => {
    const answers = responsesByQuestion.get(q.id) ?? []
    const surveyName = nameBySurvey.get(q.survey_id) ?? 'Unknown survey'

    if (q.qtype === 'rating') {
      const values = answers.map(a => Number(a.answer)).filter(n => Number.isFinite(n))
      const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      for (const v of values) {
        if (v >= 1 && v <= 5) distribution[v] = (distribution[v] ?? 0) + 1
      }
      const average = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : null
      return { ...q, surveyName, respondentCount: answers.length, average, distribution }
    }

    if (q.qtype === 'multiple_choice') {
      const counts: Record<string, number> = {}
      for (const opt of (q.options as string[] | null) ?? []) counts[opt] = 0
      for (const a of answers) counts[a.answer] = (counts[a.answer] ?? 0) + 1
      return { ...q, surveyName, respondentCount: answers.length, counts }
    }

    // text
    return {
      ...q,
      surveyName,
      respondentCount: answers.length,
      texts: answers.map(a => ({ answer: a.answer, name: nameById.get(a.user_id) ?? 'A user', createdAt: a.created_at })),
    }
  })

  return NextResponse.json({
    questions: results,
    totalRespondents: userIds.length,
  })
}
