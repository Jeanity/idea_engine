import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, SurveyQuestionType, SurveyPlacement, SurveyAudience } from '@/lib/database.types'
import { isMissingTable, isMissingColumn } from '@/lib/app-settings'
import type { PromoConfig } from '@/lib/promo'

export const MAX_ANSWER_LENGTH = 2000
export const RATING_MIN = 1
export const RATING_MAX = 5

export const SURVEY_PLACEMENTS: readonly SurveyPlacement[] = ['full_report_end', 'initial_report_end', 'account', 'post_purchase']
export const SURVEY_AUDIENCES: readonly SurveyAudience[] = ['all', 'first_report', 'first_purchase', 'promo_users', 'repeat_users']

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

// ── Survey-form validation (admin create) ────────────────────────────────

export function validateSurveyFields(body: {
  name?: unknown
  group_id?: unknown
  placement?: unknown
  audience?: unknown
}): { name: string; group_id: string | null; placement: SurveyPlacement; audience: SurveyAudience } | { error: string } {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name || name.length > 120) return { error: 'Name is required (max 120 characters).' }

  const placement = body.placement
  if (!SURVEY_PLACEMENTS.includes(placement as SurveyPlacement)) {
    return { error: 'placement must be one of ' + SURVEY_PLACEMENTS.join(', ') + '.' }
  }
  const audience = body.audience
  if (!SURVEY_AUDIENCES.includes(audience as SurveyAudience)) {
    return { error: 'audience must be one of ' + SURVEY_AUDIENCES.join(', ') + '.' }
  }
  const group_id = typeof body.group_id === 'string' && body.group_id ? body.group_id : null

  return { name, group_id, placement: placement as SurveyPlacement, audience: audience as SurveyAudience }
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

// ── Audience targeting (pure — no I/O) ───────────────────────────────────

/**
 * Everything audience rules are allowed to see about a user, as plain
 * counts so the matching itself stays pure and unit-testable.
 */
export interface AudienceSignals {
  /** Reports (teaser or full) that finished generating — status 'complete'. */
  completedReports: number
  /** Reports generated free under promo mode (reports.is_promo). */
  promoReports: number
  /** Purchases with status 'complete'. Zero for everyone until payments ship. */
  completedPurchases: number
}

export function audienceMatches(audience: SurveyAudience, signals: AudienceSignals): boolean {
  switch (audience) {
    case 'all':
      return true
    case 'first_report':
      return signals.completedReports === 1
    case 'repeat_users':
      return signals.completedReports >= 2
    case 'promo_users':
      return signals.promoReports >= 1
    case 'first_purchase':
      return signals.completedPurchases === 1
  }
}

export interface EligibleSurveyRow {
  id: string
  audience: SurveyAudience
  sort_order: number
  created_at: string
}

/**
 * First survey (by sort_order, then created_at) the user hasn't answered
 * whose audience matches. A user answers a given survey ONCE — an answered
 * survey is never offered again (there is no "thanks" card on revisit; the
 * next eligible survey, if any, simply takes its place). Callers pass only
 * surveys that are active and actually have active questions.
 */
export function pickEligibleSurvey<T extends EligibleSurveyRow>(
  surveys: T[],
  answeredSurveyIds: ReadonlySet<string>,
  signals: AudienceSignals
): T | null {
  const ordered = [...surveys].sort(
    (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)
  )
  for (const s of ordered) {
    if (answeredSurveyIds.has(s.id)) continue
    if (audienceMatches(s.audience, signals)) return s
  }
  return null
}

// ── Survey-card data fetch (report + account pages) ──────────────────────

export interface SurveyCardQuestion {
  id: string
  prompt: string
  qtype: SurveyQuestionType
  options: string[] | null
  sort_order: number
}

export interface SurveyCardData {
  /** Render the card at all — false when no eligible survey exists for this user + placement. */
  show: boolean
  surveyId: string | null
  questions: SurveyCardQuestion[]
}

export const NO_SURVEY: SurveyCardData = { show: false, surveyId: null, questions: [] }

/**
 * Audience signals for one user. The service client is required — reports
 * RLS would let us count the caller's own rows, but purchases/promo checks
 * live here too and this keeps all three counts consistent in one place.
 */
export async function getAudienceSignals(
  service: SupabaseClient<Database>,
  userId: string
): Promise<AudienceSignals> {
  const [reports, promo, purchases] = await Promise.all([
    service.from('reports').select('id', { count: 'exact', head: true }).eq('owner_id', userId).eq('status', 'complete'),
    service.from('reports').select('id', { count: 'exact', head: true }).eq('owner_id', userId).eq('is_promo', true),
    service.from('purchases').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'complete'),
  ])
  return {
    completedReports: reports.count ?? 0,
    promoReports: promo.count ?? 0,
    completedPurchases: purchases.count ?? 0,
  }
}

/**
 * Resolve which survey (if any) to show this user at a placement, with its
 * active questions. `requestClient` (the per-request RLS client) does the
 * survey/question/response reads — "surveys: public select active",
 * "survey_questions: public select active", and "survey_responses:
 * authenticated select own" (migrations 014/025) are what authorise them,
 * not app code. `service` is only used for audience signals, and only when
 * some candidate actually targets a narrower audience than 'all'.
 *
 * Graceful degradation: until migration 025 runs, the surveys table doesn't
 * exist — any missing-table error means "no survey to show". Until migration
 * 028 runs, `promo_gate` doesn't exist either — that select is retried
 * without the column (isMissingColumn, Postgres 42703) and every survey is
 * treated as non-promo, matching pre-028 behaviour exactly.
 *
 * Promo-gated surveys (promo_gate = true) are excluded here — they are only
 * ever served through pickPromoGateSurveys below, via the promo config's
 * explicit initial/full selections, never through placement-based rotation.
 */
export async function pickSurveyFor(
  service: SupabaseClient<Database>,
  requestClient: SupabaseClient<Database>,
  userId: string,
  placement: SurveyPlacement
): Promise<SurveyCardData> {
  type SurveyRow = { id: string; audience: SurveyAudience; sort_order: number; created_at: string; promo_gate: boolean }

  const first = await requestClient
    .from('surveys')
    .select('id, audience, sort_order, created_at, promo_gate')
    .eq('placement', placement)

  let rows: SurveyRow[] | null = first.data as SurveyRow[] | null

  if (first.error) {
    if (isMissingColumn(first.error)) {
      // Migration 028 hasn't run yet — retry without promo_gate and treat
      // every survey as non-promo (the only behaviour possible pre-028).
      const retry = await requestClient
        .from('surveys')
        .select('id, audience, sort_order, created_at')
        .eq('placement', placement)
      if (retry.error) {
        if (!isMissingTable(retry.error)) console.error('Error loading surveys:', retry.error)
        return NO_SURVEY
      }
      rows = (retry.data ?? []).map(s => ({ ...s, promo_gate: false }))
    } else {
      if (!isMissingTable(first.error)) console.error('Error loading surveys:', first.error)
      return NO_SURVEY
    }
  }

  const surveys = (rows ?? []).filter(s => s.promo_gate !== true)
  if (surveys.length === 0) return NO_SURVEY

  const surveyIds = surveys.map(s => s.id)
  const [questionsRes, answeredRes] = await Promise.all([
    requestClient
      .from('survey_questions')
      .select('id, survey_id, prompt, qtype, options, sort_order')
      .in('survey_id', surveyIds)
      .eq('active', true)
      .order('sort_order', { ascending: true }),
    requestClient
      .from('survey_responses')
      .select('survey_id')
      .eq('user_id', userId),
  ])

  const questionsBySurvey = new Map<string, SurveyCardQuestion[]>()
  for (const q of questionsRes.data ?? []) {
    const list = questionsBySurvey.get(q.survey_id) ?? []
    list.push({
      id: q.id,
      prompt: q.prompt,
      qtype: q.qtype,
      options: (q.options as string[] | null) ?? null,
      sort_order: q.sort_order,
    })
    questionsBySurvey.set(q.survey_id, list)
  }

  const candidates = surveys.filter(s => (questionsBySurvey.get(s.id)?.length ?? 0) > 0)
  if (candidates.length === 0) return NO_SURVEY

  const answeredIds = new Set((answeredRes.data ?? []).map(r => r.survey_id))

  // Audience signals cost three count queries — skip them entirely when
  // every candidate targets everyone.
  const signals = candidates.every(s => s.audience === 'all')
    ? { completedReports: 0, promoReports: 0, completedPurchases: 0 }
    : await getAudienceSignals(service, userId)

  const picked = pickEligibleSurvey(candidates, answeredIds, signals)
  if (!picked) return NO_SURVEY

  return { show: true, surveyId: picked.id, questions: questionsBySurvey.get(picked.id)! }
}

// ── Promo overlay surveys (migration 028) ────────────────────────────────

/**
 * Pure decision function — no I/O. Given the promo config and the set of
 * survey ids the caller has already answered, decides which of
 * initial_survey_id/full_survey_id still need to be fetched (null = no gate
 * or already answered). Promo-off collapses both to null since neither
 * overlay should ever be shown while the promo isn't running.
 */
export function idsNeedingFetch(
  config: Pick<PromoConfig, 'enabled' | 'initial_survey_id' | 'full_survey_id'>,
  answeredIds: ReadonlySet<string>
): { initial: string | null; full: string | null } {
  if (!config.enabled) return { initial: null, full: null }
  return {
    initial: config.initial_survey_id && !answeredIds.has(config.initial_survey_id) ? config.initial_survey_id : null,
    full: config.full_survey_id && !answeredIds.has(config.full_survey_id) ? config.full_survey_id : null,
  }
}

/**
 * Resolves the two promo overlay surveys (if any) this user still needs to
 * complete: the initial-report gate and the full-report gate. Each survey is
 * answerable once ever (survey_responses dedupe, same as pickSurveyFor).
 *
 * Unlike pickSurveyFor, these ids are NOT placement/audience-picked — the
 * admin selects them explicitly on the promo card, so this loads exactly
 * those two surveys (each independently) rather than picking among
 * candidates. requestClient does the reads — "surveys: public select
 * active" RLS means an inactive survey (or one deactivated mid-promo) simply
 * comes back empty, which is exactly the "admin's graceful pause switch"
 * behaviour the spec calls for: no explicit active check needed here.
 */
export async function pickPromoGateSurveys(
  requestClient: SupabaseClient<Database>,
  userId: string,
  config: PromoConfig
): Promise<{ initial: SurveyCardData | null; full: SurveyCardData | null }> {
  if (!config.enabled || (!config.initial_survey_id && !config.full_survey_id)) {
    return { initial: null, full: null }
  }

  const ids = [config.initial_survey_id, config.full_survey_id].filter((id): id is string => id !== null)

  const { data: answered, error: answeredError } = await requestClient
    .from('survey_responses')
    .select('survey_id')
    .eq('user_id', userId)
    .in('survey_id', ids)

  // A read hiccup here should not incorrectly show/hide an overlay — fall
  // back to "nothing answered" so an existing completion never gets lost
  // (worst case, a user is asked again this load; they can't be trapped
  // since a resubmission 409s and SurveyCard treats that as complete too).
  const answeredIds = new Set(answeredError ? [] : (answered ?? []).map(r => r.survey_id))

  const need = idsNeedingFetch(config, answeredIds)

  async function loadOne(surveyId: string | null): Promise<SurveyCardData | null> {
    if (!surveyId) return null

    const { data: survey } = await requestClient
      .from('surveys')
      .select('id')
      .eq('id', surveyId)
      .maybeSingle()
    if (!survey) return null // inactive (RLS-filtered) or deleted — pause the gate

    const { data: questions } = await requestClient
      .from('survey_questions')
      .select('id, prompt, qtype, options, sort_order')
      .eq('survey_id', surveyId)
      .eq('active', true)
      .order('sort_order', { ascending: true })
    if (!questions || questions.length === 0) return null // no active questions — pause the gate

    return {
      show: true,
      surveyId,
      questions: questions.map(q => ({
        id: q.id,
        prompt: q.prompt,
        qtype: q.qtype,
        options: (q.options as string[] | null) ?? null,
        sort_order: q.sort_order,
      })),
    }
  }

  const [initial, full] = await Promise.all([loadOne(need.initial), loadOne(need.full)])
  return { initial, full }
}
