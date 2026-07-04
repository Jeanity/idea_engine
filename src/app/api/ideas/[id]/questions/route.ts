import { createDbClient } from '@/lib/db'
import { callAI } from '@/lib/ai'
import { DYNAMIC_QUESTIONS_SYSTEM_PROMPT, buildDynamicQuestionsMessage } from '@/lib/prompts/dynamic-questions'
import { NextResponse, type NextRequest } from 'next/server'
import { ALL_MAPS_TO_KEYS, validateQuestion, type Question } from '@/lib/validate-question'

function loadBank(archetype: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(`@/lib/questions/${archetype}.json`) as Question[]
  } catch {
    return []
  }
}

async function generateDynamicQuestions(
  idea: { raw_text: string; archetype: string; location_country: string; location_region: string | null; restatement: string | null },
  existingAnswers: Array<{ question_key: string; answer_text: string }>,
  staticBank: Question[]
): Promise<Question[]> {
  if (process.env.DYNAMIC_QUESTIONS_ENABLED === 'false') return []

  const usedKeys = staticBank.map(q => q.key)
  const usedMapsto = staticBank.map(q => q.maps_to)
  const allowedMapsto = (ALL_MAPS_TO_KEYS as readonly string[]).filter(k => !usedMapsto.includes(k))

  const staticAnswers = existingAnswers
    .filter(a => usedKeys.includes(a.question_key))
    .map(a => {
      const q = staticBank.find(q => q.key === a.question_key)
      return { key: a.question_key, maps_to: q?.maps_to ?? '', answer: a.answer_text }
    })

  try {
    const { text } = await callAI({
      messages: [{ role: 'user', content: buildDynamicQuestionsMessage({
        idea_raw_text: idea.raw_text,
        archetype: idea.archetype,
        location_country: idea.location_country,
        location_region: idea.location_region,
        restatement: idea.restatement,
        static_answers: staticAnswers,
        used_keys: usedKeys,
        used_maps_to: usedMapsto,
        allowed_maps_to: allowedMapsto,
      }) }],
      system: DYNAMIC_QUESTIONS_SYSTEM_PROMPT,
      maxTokens: 1024,
      tag: 'dynamic-questions',
    })

    const raw = JSON.parse(text)
    if (!Array.isArray(raw)) return []

    const validated: Question[] = []
    const seenKeys = [...usedKeys]
    const seenMapsto = [...usedMapsto]

    for (const item of raw.slice(0, 3)) {
      const q = validateQuestion(item, seenKeys, seenMapsto)
      if (q) {
        validated.push(q)
        seenKeys.push(q.key)
        seenMapsto.push(q.maps_to)
      }
    }
    return validated
  } catch (err) {
    console.error('dynamic-questions generation failed (degrading gracefully):', err)
    return []
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: idea } = await supabase
    .from('ideas')
    .select('id, raw_text, archetype, location_country, location_region, restatement, status')
    .eq('id', id)
    .single()

  if (!idea) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: existingAnswers } = await supabase
    .from('answers')
    .select('question_key, answer_text, position')
    .eq('idea_id', id)
    .order('position')

  const staticBank = loadBank(idea.archetype)

  const answeredKeys = new Set((existingAnswers ?? []).map(a => a.question_key))
  const allRequiredAnswered = staticBank.filter(q => q.required).every(q => answeredKeys.has(q.key))

  let dynamicQuestions: Question[] = []
  if (allRequiredAnswered && staticBank.length > 0) {
    dynamicQuestions = await generateDynamicQuestions(idea, existingAnswers ?? [], staticBank)
  }

  return NextResponse.json({
    questions: [...staticBank, ...dynamicQuestions],
    existing_answers: existingAnswers ?? [],
  })
}
