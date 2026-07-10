import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

// Abuse-resistant rate limiting for POST /api/reports (teaser generation).
// Every fresh teaser costs real AI money (~$0.01-0.03), so this bounds two
// distinct behaviours:
//   1. Spinning up many new ideas in a burst, each triggering a first-time
//      generation.
//   2. Hammering "Regenerate" on one idea's report.
// Admins and paying customers are exempt entirely (see the bypass checks in
// the route) — these limits exist to blunt automated/careless burst usage,
// not to throttle anyone who's already paying.

/** Fresh-generation cap: new ideas created in the trailing window (below). */
export const MAX_NEW_IDEAS_PER_HOUR = 5
export const NEW_IDEA_WINDOW_MS = 60 * 60_000

/** Regeneration cooldown: minimum gap between forced regenerations of the same report. */
export const REGEN_COOLDOWN_MS = 10 * 60_000

// Both constants are deliberate product choices, not derived from anything —
// they bound per-account teaser spend to roughly $1/hour of AI cost even if
// every generation in the window is a fresh (non-cached) run.

export const GENERATION_LIMIT_MESSAGE =
  "You're generating reports quickly — take a breather and try again in a few minutes."

// ── Pure decision logic (no I/O — unit-tested) ──────────────────────────

export interface EvaluateGenerationLimitParams {
  /** Admin or paying-customer — when true, every other input is ignored and the request is always allowed. */
  isBypass: boolean
  /** True when this request would create a report row for an idea that has none yet. */
  isFreshGeneration: boolean
  /** Ideas this user created within NEW_IDEA_WINDOW_MS of `now`. Only meaningful when isFreshGeneration. */
  newIdeaCount: number
  /** True when the request is an explicit regeneration (`force === true`) of an existing report. */
  isForcedRegeneration: boolean
  /**
   * True when the existing report is a stale queued/running run (see the
   * route's STALE_MS rescue logic) that must remain re-firable no matter how
   * recently it "started" — a stuck run isn't a burst-abuse signal.
   */
  isStaleRescue: boolean
  /** The existing report's generation_started_at, or null if it never started. */
  generationStartedAt: Date | null
  now: number
}

export type GenerationLimitReason = 'new_idea_cap' | 'regen_cooldown'

export interface GenerationLimitResult {
  allowed: boolean
  reason?: GenerationLimitReason
}

/**
 * PURE — no I/O. `isBypass` (admin or paying customer, see the route) is
 * checked first and short-circuits everything else — callers should still
 * skip computing the other inputs (the DB reads) when they already know the
 * request is a bypass, but this function is safe to call unconditionally too.
 */
export function evaluateGenerationLimit(params: EvaluateGenerationLimitParams): GenerationLimitResult {
  const { isBypass, isFreshGeneration, newIdeaCount, isForcedRegeneration, isStaleRescue, generationStartedAt, now } = params

  if (isBypass) return { allowed: true }

  if (isFreshGeneration && newIdeaCount >= MAX_NEW_IDEAS_PER_HOUR) {
    return { allowed: false, reason: 'new_idea_cap' }
  }

  // Cooldown never applies to the stale-rescue path — a queued/running run
  // that died must stay re-firable regardless of how recently it "started".
  if (isForcedRegeneration && !isStaleRescue && generationStartedAt !== null) {
    if (now - generationStartedAt.getTime() < REGEN_COOLDOWN_MS) {
      return { allowed: false, reason: 'regen_cooldown' }
    }
  }

  return { allowed: true }
}

// ── I/O wrappers ─────────────────────────────────────────────────────────

/**
 * Count of ideas this user created within NEW_IDEA_WINDOW_MS of `nowMs`.
 * Takes the caller's own request client — RLS ("ideas: select own") already
 * scopes this to the signed-in user, no service client needed.
 *
 * Fails open (returns 0) on a query error: this is a cost-control guard, not
 * a security boundary, and a transient DB error must never block a
 * legitimate generation.
 */
export async function countRecentIdeas(
  supabase: SupabaseClient<Database>,
  userId: string,
  nowMs: number
): Promise<number> {
  const cutoff = new Date(nowMs - NEW_IDEA_WINDOW_MS).toISOString()
  const { count, error } = await supabase
    .from('ideas')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId)
    .gt('created_at', cutoff)

  if (error) {
    console.error('generation-limit: countRecentIdeas failed:', error)
    return 0
  }
  return count ?? 0
}

/**
 * Whether this user has at least one completed purchase. RLS on `purchases`
 * ("purchases: select own", migration 001) is `auth.uid() = user_id`, so the
 * caller's own request client can read this directly — no service-role
 * client needed for a read scoped to the current user.
 *
 * Fails closed (returns false) on a query error, so an infra hiccup can
 * never itself grant an unlimited-usage bypass.
 */
export async function isPayingCustomer(supabase: SupabaseClient<Database>, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('purchases')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'complete')
    .limit(1)

  if (error) {
    console.error('generation-limit: isPayingCustomer failed:', error)
    return false
  }
  return (data?.length ?? 0) > 0
}
