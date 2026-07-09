import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, SurveyQuestionType } from '@/lib/database.types'
import { getSetting, setSetting } from '@/lib/app-settings'

export const SURVEY_SETTING_KEY = 'survey'
export const MAX_ANSWER_LENGTH = 2000
export const RATING_MIN = 1
export const RATING_MAX = 5

export interface SurveyConfig {
  enabled: boolean
}

export const DEFAULT_SURVEY_CONFIG: SurveyConfig = { enabled: false }

export async function readSurveyConfig(service: SupabaseClient<Database>): Promise<SurveyConfig> {
  const raw = await getSetting<Partial<SurveyConfig>>(service, SURVEY_SETTING_KEY)
  return { ...DEFAULT_SURVEY_CONFIG, ...(raw ?? {}) }
}

export async function writeSurveyConfig(service: SupabaseClient<Database>, config: SurveyConfig): Promise<{ error: string | null }> {
  return setSetting(service, SURVEY_SETTING_KEY, config)
}

// ── Pure submission validation (no I/O) ─────────────────────────────────

export interface SurveyQuestionForValidation {
  id: string
  qtype: SurveyQuestionType
  options: string[] | null
}

export interface SurveyAnswerInput {
  question_id: string
  answer: string
}

export type SurveyValidationResult =
  | { valid: true; answers: SurveyAnswerInput[] }
  | { valid: false; error: string }

/**
 * Validates a full survey submission (one answer per active question) with
 * no database access — the caller supplies the active question set it
 * already fetched. Rules, per the plan: every answer maps to a KNOWN, ACTIVE
 * question; exactly one answer per question in the set (no dupes, no
 * missing); each answer is non-empty and <= MAX_ANSWER_LENGTH; rating
 * answers parse as an integer within [RATING_MIN, RATING_MAX]; multiple_choice
 * answers must exactly match one of the question's options.
 */
export function validateSurveySubmission(
  questions: SurveyQuestionForValidation[],
  answers: SurveyAnswerInput[]
): SurveyValidationResult {
  if (!Array.isArray(answers) || answers.length === 0) {
    return { valid: false, error: 'No answers submitted.' }
  }
  if (questions.length === 0) {
    return { valid: false, error: 'No active survey questions.' }
  }

  const questionById = new Map(questions.map(q => [q.id, q]))

  const seen = new Set<string>()
  for (const a of answers) {
    if (typeof a?.question_id !== 'string' || typeof a?.answer !== 'string') {
      return { valid: false, error: 'Malformed answer.' }
    }
    if (seen.has(a.question_id)) {
      return { valid: false, error: 'Duplicate answer for the same question.' }
    }
    seen.add(a.question_id)
  }

  // Every active question must be answered — this is a single "help us
  // improve" form, not partial credit.
  for (const q of questions) {
    if (!seen.has(q.id)) {
      return { valid: false, error: 'Please answer every question.' }
    }
  }
  // Every answered question_id must be one of the known active questions —
  // guards against stale/inactive/foreign ids from the client.
  for (const id of seen) {
    if (!questionById.has(id)) {
      return { valid: false, error: 'Unknown or inactive question.' }
    }
  }

  const normalised: SurveyAnswerInput[] = []
  for (const a of answers) {
    const question = questionById.get(a.question_id)!
    const trimmed = a.answer.trim()
    if (!trimmed) {
      return { valid: false, error: 'Every answer is required.' }
    }
    if (trimmed.length > MAX_ANSWER_LENGTH) {
      return { valid: false, error: `Answers must be ${MAX_ANSWER_LENGTH} characters or fewer.` }
    }

    if (question.qtype === 'rating') {
      const n = Number(trimmed)
      if (!Number.isInteger(n) || n < RATING_MIN || n > RATING_MAX) {
        return { valid: false, error: `Rating must be an integer between ${RATING_MIN} and ${RATING_MAX}.` }
      }
    }

    if (question.qtype === 'multiple_choice') {
      const options = question.options ?? []
      if (!options.includes(trimmed)) {
        return { valid: false, error: 'Answer must be one of the offered choices.' }
      }
    }

    normalised.push({ question_id: a.question_id, answer: trimmed })
  }

  return { valid: true, answers: normalised }
}

// ── Question-form validation (admin create/update) ──────────────────────

export function validateQuestionFields(body: {
  prompt?: unknown
  qtype?: unknown
  options?: unknown
}): { prompt: string; qtype: SurveyQuestionType; options: string[] | null } | { error: string } {
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
  if (!prompt || prompt.length > 500) {
    return { error: 'Prompt is required (max 500 characters).' }
  }

  const qtype = body.qtype
  if (qtype !== 'text' && qtype !== 'rating' && qtype !== 'multiple_choice') {
    return { error: 'qtype must be one of text, rating, multiple_choice.' }
  }

  let options: string[] | null = null
  if (qtype === 'multiple_choice') {
    const raw = Array.isArray(body.options) ? body.options : []
    options = raw.filter((o): o is string => typeof o === 'string' && o.trim().length > 0).map(o => o.trim())
    if (options.length < 2) {
      return { error: 'Multiple choice questions need at least 2 options.' }
    }
  }

  return { prompt, qtype, options }
}

// ── Report-page data fetch ───────────────────────────────────────────────

export interface SurveyCardQuestion {
  id: string
  prompt: string
  qtype: SurveyQuestionType
  options: string[] | null
  sort_order: number
}

export interface SurveyCardData {
  /** Render the card at all — false when survey is off or there are no active questions. */
  show: boolean
  questions: SurveyCardQuestion[]
  /** User already answered at least one currently-active question — show the "thanks" line instead of the form. */
  alreadyAnswered: boolean
}

/**
 * Data for the report-end survey card. `service` reads the on/off flag
 * (app_settings has no RLS policies at all); `requestClient` is the
 * per-request client and does the rest — "survey_questions: public select
 * active" and "survey_responses: authenticated select own" (migration 014)
 * are what authorise those two reads, not app code.
 */
export async function getSurveyCardData(
  service: SupabaseClient<Database>,
  requestClient: SupabaseClient<Database>,
  userId: string
): Promise<SurveyCardData> {
  const config = await readSurveyConfig(service)
  if (!config.enabled) return { show: false, questions: [], alreadyAnswered: false }

  const { data: questions, error } = await requestClient
    .from('survey_questions')
    .select('id, prompt, qtype, options, sort_order')
    .eq('active', true)
    .order('sort_order', { ascending: true })

  if (error || !questions || questions.length === 0) {
    return { show: false, questions: [], alreadyAnswered: false }
  }

  const activeIds = new Set(questions.map(q => q.id))
  const { data: responses } = await requestClient
    .from('survey_responses')
    .select('question_id')
    .eq('user_id', userId)

  const alreadyAnswered = (responses ?? []).some(r => activeIds.has(r.question_id))

  return {
    show: true,
    questions: questions.map(q => ({
      id: q.id,
      prompt: q.prompt,
      qtype: q.qtype,
      options: (q.options as string[] | null) ?? null,
      sort_order: q.sort_order,
    })),
    alreadyAnswered,
  }
}
