import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { toPublicDisplayName } from '@/lib/public-name'
import { NextResponse } from 'next/server'

async function requireAdmin() {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { denied: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) }
  if (!isAdminEmail(user.email)) return { denied: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { denied: null }
}

// Per-question aggregation for the admin responses view: rating -> average +
// 1-5 distribution; multiple_choice -> counts per option; text -> the raw
// list (with a display name + date) since there's nothing to aggregate.
export async function GET() {
  const { denied } = await requireAdmin()
  if (denied) return denied

  const service = createServiceClient()

  const { data: questions, error: qError } = await service
    .from('survey_questions')
    .select('id, prompt, qtype, options, sort_order, active')
    .order('sort_order', { ascending: true })

  if (qError) {
    return NextResponse.json({ error: 'Failed to load questions.' }, { status: 500 })
  }

  const { data: responses, error: rError } = await service
    .from('survey_responses')
    .select('id, question_id, user_id, answer, created_at')
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

  const results = (questions ?? []).map(q => {
    const answers = responsesByQuestion.get(q.id) ?? []

    if (q.qtype === 'rating') {
      const values = answers.map(a => Number(a.answer)).filter(n => Number.isFinite(n))
      const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      for (const v of values) {
        if (v >= 1 && v <= 5) distribution[v] = (distribution[v] ?? 0) + 1
      }
      const average = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : null
      return { ...q, respondentCount: answers.length, average, distribution }
    }

    if (q.qtype === 'multiple_choice') {
      const counts: Record<string, number> = {}
      for (const opt of (q.options as string[] | null) ?? []) counts[opt] = 0
      for (const a of answers) counts[a.answer] = (counts[a.answer] ?? 0) + 1
      return { ...q, respondentCount: answers.length, counts }
    }

    // text
    return {
      ...q,
      respondentCount: answers.length,
      texts: answers.map(a => ({ answer: a.answer, name: nameById.get(a.user_id) ?? 'A user', createdAt: a.created_at })),
    }
  })

  return NextResponse.json({
    questions: results,
    totalRespondents: userIds.length,
  })
}
