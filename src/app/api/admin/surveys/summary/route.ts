import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { callAI, HAIKU_MODEL } from '@/lib/ai'
import { logError } from '@/lib/log-error'
import { NextResponse } from 'next/server'

const MAX_RESPONSES = 200

// On-demand AI overview of survey responses. Ephemeral — the summary is
// returned in the response body and rendered client-side, never stored.
export async function POST() {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = createServiceClient()

  const { data: questions } = await service
    .from('survey_questions')
    .select('id, prompt, qtype')
    .order('sort_order', { ascending: true })

  const { data: responses, error } = await service
    .from('survey_responses')
    .select('question_id, answer, created_at')
    .order('created_at', { ascending: false })
    .limit(MAX_RESPONSES)

  if (error) {
    return NextResponse.json({ error: 'Failed to load responses.' }, { status: 500 })
  }
  if (!responses || responses.length === 0) {
    return NextResponse.json({ error: 'No responses to summarise yet.' }, { status: 400 })
  }

  const promptByQuestion = new Map((questions ?? []).map(q => [q.id, q.prompt]))

  const lines = responses.map(r => `- [${promptByQuestion.get(r.question_id) ?? 'Unknown question'}] ${r.answer}`)
  const transcript = lines.join('\n')

  try {
    const result = await callAI({
      model: HAIKU_MODEL,
      maxTokens: 1024,
      tag: 'admin:survey-summary',
      system:
        'You summarise end-user survey feedback for a product team. Given a list of question/answer ' +
        'pairs, produce 3-6 concise bullet-point themes covering what respondents are saying, plus a ' +
        'short "Notable quotes" section with 2-4 short verbatim quotes. Be specific and neutral — no ' +
        'filler, no repeating the question text back verbatim.',
      messages: [
        { role: 'user', content: `Survey responses (most recent ${responses.length}):\n\n${transcript}\n\nSummarise the above.` },
      ],
    })

    return NextResponse.json({ summary: result.text, respondentCount: responses.length })
  } catch (err) {
    console.error('Error generating survey summary:', err)
    await logError({
      source: 'api:admin/surveys/summary',
      message: `Survey summary generation failed: ${err instanceof Error ? err.message : String(err)}`,
      path: 'POST /api/admin/surveys/summary',
      userId: user.id,
    })
    return NextResponse.json({ error: 'Failed to generate a summary — please try again.' }, { status: 500 })
  }
}
