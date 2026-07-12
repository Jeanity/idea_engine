import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { getSetting, setSetting, isMissingTable } from '@/lib/app-settings'
import {
  normalizeEmail,
  isDisposableEmail,
  hashIp,
  evaluateAbuseSignals,
  countSuspiciousClusters,
  queryPromoIdentityMatches,
  insertPromoIdentity,
} from '@/lib/promo-abuse'

// Not meant to be secret-strength — just namespaces the IP hash so it isn't
// directly reversible/rainbow-tableable as a bare IP. See src/lib/promo-abuse.ts.
const IP_HASH_SALT = 'idea-engine-promo-abuse-v1'

export const PROMO_SETTING_KEY = 'promo'

export interface PromoConfig {
  enabled: boolean
  spend_cap_usd: number | null
  report_cap: number | null
  per_user_limit: number | null
  started_at: string | null
  ended_at: string | null
  ended_reason: 'spend_cap' | 'report_cap' | 'manual' | null
  /** Overlay survey (surveys.promo_gate = true) a promo user must complete,
   *  on their completed INITIAL report, before starting the full report.
   *  null = no gate. See src/lib/survey.ts pickPromoGateSurveys. */
  initial_survey_id: string | null
  /** Overlay survey a promo user must complete, on their completed FULL
   *  report, before reading it / seeing the PDF download button. */
  full_survey_id: string | null
}

export const DEFAULT_PROMO_CONFIG: PromoConfig = {
  enabled: false,
  spend_cap_usd: null,
  report_cap: null,
  per_user_limit: null,
  started_at: null,
  ended_at: null,
  ended_reason: null,
  initial_survey_id: null,
  full_survey_id: null,
}

export interface PromoUsage {
  reportsUsed: number
  spendUsedUsd: number
  perUserUsed: number
}

export type PromoDenyReason = 'disabled' | 'spend_cap' | 'report_cap' | 'per_user_limit'

export type PromoGateResult =
  | { allowed: true }
  | { allowed: false; reason: PromoDenyReason; endsPromo: boolean }

/**
 * Pure decision function — no I/O. Given the current promo config and the
 * caller's usage figures, decides whether a NEW promo full-report run may
 * start, and (for cap reasons) whether the promo period should be ended as a
 * side effect. `endsPromo` is true only for the two admin-set caps (spend,
 * report count) — a per-user limit denial does not end the promo for
 * everyone else, and `disabled` needs no further action since it's already
 * off.
 *
 * Check-then-act note: spend/report totals are read, then compared here,
 * then (by the caller) acted on — under concurrent requests two reports
 * could both pass the check before either's usage is counted, so the cap can
 * be overshot by roughly one report. Traffic here is tiny; that overshoot is
 * accepted rather than adding transactional locking.
 */
export function evaluatePromoGate(config: PromoConfig, usage: PromoUsage): PromoGateResult {
  if (!config.enabled) {
    return { allowed: false, reason: 'disabled', endsPromo: false }
  }

  if (config.spend_cap_usd !== null && usage.spendUsedUsd >= config.spend_cap_usd) {
    return { allowed: false, reason: 'spend_cap', endsPromo: true }
  }

  if (config.report_cap !== null && usage.reportsUsed >= config.report_cap) {
    return { allowed: false, reason: 'report_cap', endsPromo: true }
  }

  if (config.per_user_limit !== null && usage.perUserUsed >= config.per_user_limit) {
    return { allowed: false, reason: 'per_user_limit', endsPromo: false }
  }

  return { allowed: true }
}

export function mergePromoConfig(raw: Partial<PromoConfig> | null): PromoConfig {
  return { ...DEFAULT_PROMO_CONFIG, ...(raw ?? {}) }
}

/** Reads the promo setting, defaulting to "off" if unset or migration 013 hasn't run. */
export async function readPromoConfig(service: SupabaseClient<Database>): Promise<PromoConfig> {
  const raw = await getSetting<Partial<PromoConfig>>(service, PROMO_SETTING_KEY)
  return mergePromoConfig(raw)
}

export async function writePromoConfig(service: SupabaseClient<Database>, config: PromoConfig): Promise<{ error: string | null }> {
  return setSetting(service, PROMO_SETTING_KEY, config)
}

/**
 * Derived usage for the CURRENT promo period (config.started_at). Promo rows
 * keep is_promo=true forever (historical record), so every query here is
 * additionally filtered to generation_started_at >= config.started_at —
 * without that filter a new promo period would inherit a prior period's
 * spend/report counts.
 */
export async function readPromoUsage(
  service: SupabaseClient<Database>,
  config: PromoConfig,
  userId?: string
): Promise<PromoUsage> {
  if (!config.started_at) {
    return { reportsUsed: 0, spendUsedUsd: 0, perUserUsed: 0 }
  }

  const { data: rows, error } = await service
    .from('reports')
    .select('cost_usd, owner_id')
    .eq('is_promo', true)
    .gte('generation_started_at', config.started_at)

  if (error || !rows) {
    return { reportsUsed: 0, spendUsedUsd: 0, perUserUsed: 0 }
  }

  const reportsUsed = rows.length
  const spendUsedUsd = rows.reduce((sum, r) => sum + (r.cost_usd ?? 0), 0)
  const perUserUsed = userId ? rows.filter(r => r.owner_id === userId).length : 0

  return { reportsUsed, spendUsedUsd, perUserUsed }
}

/** Distinct users served in the current promo period — admin usage readout only. */
export async function readPromoDistinctUsers(service: SupabaseClient<Database>, config: PromoConfig): Promise<number> {
  if (!config.started_at) return 0
  const { data: rows } = await service
    .from('reports')
    .select('owner_id')
    .eq('is_promo', true)
    .gte('generation_started_at', config.started_at)
  return new Set((rows ?? []).map(r => r.owner_id)).size
}

export interface PromoPublicStatus {
  active: boolean
  perUserRemaining: number | null
}

/**
 * User-facing promo status — ONLY what's safe to show a regular signed-in
 * user (never caps or spend numbers). Uses the service client internally
 * because app_settings has no RLS policies at all, but the query is scoped
 * to app-global config plus this one user's own report count — never another
 * user's data.
 */
export async function getPromoPublicStatus(service: SupabaseClient<Database>, userId: string): Promise<PromoPublicStatus> {
  const config = await readPromoConfig(service)
  if (!config.enabled) return { active: false, perUserRemaining: null }

  if (config.per_user_limit === null) {
    return { active: true, perUserRemaining: null }
  }

  const usage = await readPromoUsage(service, config, userId)
  const remaining = Math.max(0, config.per_user_limit - usage.perUserUsed)
  return { active: true, perUserRemaining: remaining }
}

const PROMO_MESSAGES: Record<PromoDenyReason, string> = {
  disabled: "Free launch reports aren't available right now — paid reports are coming soon.",
  spend_cap: 'The free launch offer has ended — paid reports are coming soon.',
  report_cap: 'The free launch offer has ended — paid reports are coming soon.',
  per_user_limit: "You've used your free report for this promotion — paid reports are coming soon.",
}

export interface PromoAbuseSignals {
  email: string
  /** First hop of X-Forwarded-For, or null if unavailable. */
  ip: string | null
  /** Value of the ie_ab anti-abuse cookie, or null if not yet set on this browser. */
  abId: string | null
}

export type PromoGateCheckResult =
  | { allowed: true; normalizedEmail: string; ipHash: string | null }
  | { allowed: false; message: string }

/** Pure: the survey gate only applies when the selected survey is currently
 *  ANSWERABLE — active with at least one active question. This mirrors the
 *  RLS conditions under which pickPromoGateSurveys renders the overlay, so
 *  the server can never demand a survey the client cannot show. */
export function isAnswerableSurvey(
  survey: { active: boolean } | null,
  activeQuestionCount: number | null
): boolean {
  return survey?.active === true && (activeQuestionCount ?? 0) > 0
}

async function isSurveyAnswerable(
  service: SupabaseClient<Database>,
  surveyId: string
): Promise<boolean> {
  // Any read error counts as "not answerable" → the gate falls through to
  // allow, which is the safe direction (never brick the promo on a hiccup).
  const { data: survey, error } = await service
    .from('surveys')
    .select('active')
    .eq('id', surveyId)
    .maybeSingle()
  if (error || !survey) return false

  const { count, error: qError } = await service
    .from('survey_questions')
    .select('id', { count: 'exact', head: true })
    .eq('survey_id', surveyId)
    .eq('active', true)
  if (qError) return false

  return isAnswerableSurvey(survey, count)
}

/**
 * Full server-side gate for POST /api/reports/full's non-admin path. Reads
 * config + usage, evaluates the pure per-user-limit decision, and — for
 * cap-triggered denials — ends the promo (setSetting) as a side effect so
 * subsequent requests see it off immediately.
 *
 * On top of that, runs the promo-abuse layer (migration 020 / promo-abuse.ts):
 * a disposable-email blocklist check (no I/O — always active regardless of
 * whether the migration has run), then — table permitting — email/browser/IP
 * reuse signals. Any denial here reuses the exact per_user_limit message so
 * the product never reveals which signal tripped.
 *
 * Also checked here: the initial-report survey gate (migration 028). If the
 * admin has set config.initial_survey_id AND that survey is answerable, the
 * caller must have a survey_responses row for it before a full report can
 * start. Unlike the abuse denials above, that message is deliberately
 * specific — see the comment at the check itself.
 *
 * Returns a user-facing message alongside the decision; callers map
 * `allowed: false` to a 403. On `allowed: true`, also returns the
 * normalizedEmail/ipHash computed here so the caller can pass them straight
 * to recordPromoIdentity after the report is successfully queued, without
 * recomputing (and risking drift from) the same values.
 */
export async function checkAndApplyPromoGate(
  service: SupabaseClient<Database>,
  userId: string,
  signals: PromoAbuseSignals
): Promise<PromoGateCheckResult> {
  const config = await readPromoConfig(service)
  const usage = await readPromoUsage(service, config, userId)
  const result = evaluatePromoGate(config, usage)

  if (!result.allowed) {
    if (result.endsPromo) {
      await writePromoConfig(service, {
        ...config,
        enabled: false,
        ended_at: new Date().toISOString(),
        ended_reason: result.reason === 'spend_cap' ? 'spend_cap' : 'report_cap',
      })
    }
    return { allowed: false, message: PROMO_MESSAGES[result.reason] }
  }

  // Disposable-email blocklist — pure, no DB dependency, always enforced.
  if (isDisposableEmail(signals.email)) {
    return { allowed: false, message: PROMO_MESSAGES.per_user_limit }
  }

  // Initial-report survey gate (migration 028) — unlike every other denial
  // in this function, this message is deliberately SPECIFIC. The others
  // reuse one generic string on purpose so the product never reveals which
  // abuse signal tripped; this one is an instruction ("go answer the
  // survey"), not a security signal, so telling the user exactly what to do
  // is the whole point.
  //
  // DEADLOCK GUARD: the overlay the user answers is only rendered when the
  // survey is ANSWERABLE — active with ≥1 active question (RLS hides
  // inactive surveys from pickPromoGateSurveys). The server must mirror
  // exactly that condition, or an inactive/questionless selection would
  // deny users with an instruction they cannot follow. Deactivating the
  // selected survey is therefore the admin's pause switch for this gate.
  // Degrade gracefully on any read error — a DB hiccup should never brick
  // the promo, so every uncertain path falls through to allow.
  if (config.initial_survey_id) {
    if (await isSurveyAnswerable(service, config.initial_survey_id)) {
      const { count, error: surveyError } = await service
        .from('survey_responses')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('survey_id', config.initial_survey_id)

      if (!surveyError && (count ?? 0) === 0) {
        return {
          allowed: false,
          message: 'Quick one first: complete the short survey on your initial report — it unlocks the full report.',
        }
      }
    }
  }

  const normalizedEmail = normalizeEmail(signals.email)
  const ipHash = signals.ip ? hashIp(signals.ip, IP_HASH_SALT) : null

  // Email/browser/IP reuse signals — degrade gracefully if migration 020
  // hasn't been run yet (missingTable), same as every other promo table.
  const { rows, missingTable } = await queryPromoIdentityMatches(service, {
    normalizedEmail,
    abId: signals.abId,
    ipHash,
  })

  if (!missingTable) {
    const verdict = evaluateAbuseSignals(rows, {
      normalizedEmail,
      abId: signals.abId,
      ipHash,
      currentUserId: userId,
      now: new Date(),
    })
    if (verdict.verdict === 'deny') {
      return { allowed: false, message: PROMO_MESSAGES.per_user_limit }
    }
  }

  return { allowed: true, normalizedEmail, ipHash }
}

/**
 * Records a promo_identity row after a promo full report has been
 * successfully queued. Call with the normalizedEmail/ipHash returned by
 * checkAndApplyPromoGate. Swallows missing-table and other errors — never
 * fails the request that already succeeded.
 */
export async function recordPromoIdentity(
  service: SupabaseClient<Database>,
  params: { userId: string; normalizedEmail: string; ipHash: string | null; abId: string | null }
): Promise<void> {
  await insertPromoIdentity(service, params)
}

/**
 * Admin-only readout: count of distinct ip_hash/ab_id values in the current
 * promo period that are shared by 2+ distinct accounts — a rough "possible
 * duplicate-account clusters" signal. Scoped the same way as
 * readPromoUsage/readPromoDistinctUsers (generation window from
 * config.started_at). Returns 0 gracefully if migration 020 hasn't run yet.
 */
export async function readSuspiciousClusters(service: SupabaseClient<Database>, config: PromoConfig): Promise<number> {
  if (!config.started_at) return 0

  const { data, error } = await service
    .from('promo_identity')
    .select('user_id, normalized_email, ip_hash, ab_id, created_at')
    .gte('created_at', config.started_at)

  if (error || !data) return 0
  return countSuspiciousClusters(data)
}

export { isMissingTable }
