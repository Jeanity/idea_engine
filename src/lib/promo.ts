import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { getSetting, setSetting, isMissingTable } from '@/lib/app-settings'

export const PROMO_SETTING_KEY = 'promo'

export interface PromoConfig {
  enabled: boolean
  spend_cap_usd: number | null
  report_cap: number | null
  per_user_limit: number | null
  started_at: string | null
  ended_at: string | null
  ended_reason: 'spend_cap' | 'report_cap' | 'manual' | null
}

export const DEFAULT_PROMO_CONFIG: PromoConfig = {
  enabled: false,
  spend_cap_usd: null,
  report_cap: null,
  per_user_limit: null,
  started_at: null,
  ended_at: null,
  ended_reason: null,
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

/**
 * Full server-side gate for POST /api/reports/full's non-admin path. Reads
 * config + usage, evaluates the pure decision, and — for cap-triggered
 * denials — ends the promo (setSetting) as a side effect so subsequent
 * requests see it off immediately. Returns a user-facing message alongside
 * the decision; callers map `allowed: false` to a 403.
 */
export async function checkAndApplyPromoGate(
  service: SupabaseClient<Database>,
  userId: string
): Promise<{ allowed: true } | { allowed: false; message: string }> {
  const config = await readPromoConfig(service)
  const usage = await readPromoUsage(service, config, userId)
  const result = evaluatePromoGate(config, usage)

  if (result.allowed) return { allowed: true }

  if (result.endsPromo) {
    await writePromoConfig(service, {
      ...config,
      enabled: false,
      ended_at: new Date().toISOString(),
      ended_reason: result.reason === 'spend_cap' ? 'spend_cap' : 'report_cap',
    })
  }

  const messages: Record<PromoDenyReason, string> = {
    disabled: "Free launch reports aren't available right now — paid reports are coming soon.",
    spend_cap: 'The free launch offer has ended — paid reports are coming soon.',
    report_cap: 'The free launch offer has ended — paid reports are coming soon.',
    per_user_limit: "You've used your free report for this promotion — paid reports are coming soon.",
  }

  return { allowed: false, message: messages[result.reason] }
}

export { isMissingTable }
