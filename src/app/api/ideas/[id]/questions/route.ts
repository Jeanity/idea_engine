import { createDbClient } from '@/lib/db'
import { callAI } from '@/lib/ai'
import { DYNAMIC_QUESTIONS_SYSTEM_PROMPT, buildDynamicQuestionsMessage } from '@/lib/prompts/dynamic-questions'
import { NextResponse, type NextRequest } from 'next/server'
import { ALL_MAPS_TO_KEYS, validateQuestion, type Question } from '@/lib/validate-question'
import { isQuestionVisible } from '@/lib/question-visibility'

// Asked for every idea regardless of archetype — the report's "upside" framing
// is calibrated against the founder's own definition of success, not a generic
// startup bar (see why_this_can_work in the synthesis prompt).
const SUCCESS_QUESTION: Question = {
  key: 'success_definition',
  text: 'What would success look like for you?',
  subtext: 'There is no wrong answer — this shapes how we frame the opportunity for you.',
  input_type: 'select',
  options: [
    'A bit of extra income on the side',
    'A steady part-time income',
    'Replacing my current job',
    'Building something big that could scale beyond me',
  ],
  required: false,
  maps_to: 'founder.success_definition',
}

// Asked for every idea regardless of archetype. Location moved out of the
// initial idea submission (step 1) because it isn't needed to classify the
// idea — but it IS required before the report can run (currency, compliance,
// financing are all country-driven). The complete endpoint copies this answer
// into ideas.location_country and rejects completion if it's missing/invalid.
const COUNTRY_QUESTION: Question = {
  key: 'founder_location_country',
  text: 'What country are you in?',
  subtext: 'This drives the currency, compliance, and financing research in your report.',
  input_type: 'country',
  required: true,
  maps_to: 'founder.location_country',
}

// Only asked for archetypes where the answer materially changes the research
// (compliance jurisdiction, delivery/service radius, local competitor search).
const LOCATION_SENSITIVE_ARCHETYPES = ['local_service', 'physical_product', 'marketplace', 'ecommerce_brand']

const REGION_QUESTION: Question = {
  key: 'founder_location_region',
  text: 'Which city or region?',
  subtext: 'Optional — helps us find local competitors and pricing. e.g. Brisbane, QLD.',
  input_type: 'text',
  required: false,
  maps_to: 'founder.location_region',
}

function loadBank(archetype: string) {
  let bank: Question[]
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    bank = require(`@/lib/questions/${archetype}.json`) as Question[]
  } catch {
    bank = []
  }
  // Country comes FIRST so later money questions can render in the founder's
  // own currency symbol (the wizard reads the country answer live).
  const locationLead = LOCATION_SENSITIVE_ARCHETYPES.includes(archetype)
    ? [COUNTRY_QUESTION, REGION_QUESTION]
    : [COUNTRY_QUESTION]
  return [...locationLead, ...bank, SUCCESS_QUESTION]
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

  // The ideas row holds the 'ZZ' placeholder until the complete step back-fills
  // it — but by the time dynamic questions generate, the founder has usually
  // answered the injected country question, so prefer that answer.
  const answeredCountry = existingAnswers.find(a => a.question_key === COUNTRY_QUESTION.key)?.answer_text?.trim().toUpperCase()
  const answeredRegion = existingAnswers.find(a => a.question_key === REGION_QUESTION.key)?.answer_text?.trim()
  const effectiveCountry = idea.location_country !== 'ZZ' && idea.location_country !== ''
    ? idea.location_country
    : (answeredCountry && /^[A-Z]{2}$/.test(answeredCountry) ? answeredCountry : 'unknown')
  const effectiveRegion = idea.location_region ?? (answeredRegion || null)

  try {
    const { text } = await callAI({
      messages: [{ role: 'user', content: buildDynamicQuestionsMessage({
        idea_raw_text: idea.raw_text,
        archetype: idea.archetype,
        location_country: effectiveCountry,
        location_region: effectiveRegion,
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
  const allRequiredAnswered = staticBank
    .filter(q => q.required && isQuestionVisible(q, existingAnswers ?? []))
    .every(q => answeredKeys.has(q.key))

  let dynamicQuestions: Question[] = []
  if (allRequiredAnswered && staticBank.length > 0) {
    dynamicQuestions = await generateDynamicQuestions(idea, existingAnswers ?? [], staticBank)
  }

  return NextResponse.json({
    questions: [...staticBank, ...dynamicQuestions],
    existing_answers: existingAnswers ?? [],
  })
}
