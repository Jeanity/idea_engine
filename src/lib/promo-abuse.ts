import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { isMissingTable } from '@/lib/app-settings'

// Promo abuse guard (migration 020) — cheap layers to raise the effort of
// creating fresh accounts to claim repeat promo freebies above the reward.
// Not meant to be airtight; the admin-set spend/report caps in promo.ts
// already bound total damage. This file holds the pure decision logic plus
// the I/O wrapper functions that read/write the promo_identity table —
// src/lib/promo.ts orchestrates them alongside the existing per-user-limit
// gate so promo logic has a single home.

// ── Email normalization (pure) ──────────────────────────────────────────

/**
 * Lowercases, strips plus-addressing ("+anything" before the @) from the
 * local part, and — for gmail.com/googlemail.com only — also strips dots
 * from the local part (Gmail treats "a.b@gmail.com" and "ab@gmail.com" as
 * the same inbox; most other providers do not).
 */
export function normalizeEmail(email: string): string {
  const trimmed = email.trim().toLowerCase()
  const atIndex = trimmed.lastIndexOf('@')
  if (atIndex === -1) return trimmed

  let local = trimmed.slice(0, atIndex)
  const domain = trimmed.slice(atIndex + 1)

  const plusIndex = local.indexOf('+')
  if (plusIndex !== -1) local = local.slice(0, plusIndex)

  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    local = local.replace(/\./g, '')
  }

  return `${local}@${domain}`
}

// ── Disposable email blocklist (pure) ───────────────────────────────────

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  '10minutemail.com',
  'temp-mail.org',
  'yopmail.com',
  'sharklasers.com',
  'throwaway.email',
  'getnada.com',
  'tempmail.com',
  'trashmail.com',
  'fakeinbox.com',
  'dispostable.com',
  'mailnesia.com',
  'mintemail.com',
  'mytemp.email',
  'spamgourmet.com',
  'tempinbox.com',
  'guerrillamailblock.com',
  'mailcatch.com',
  'moakt.com',
  'emailondeck.com',
  'tempail.com',
  'throwawaymail.com',
  'mailinator.net',
  'mailinator.org',
  'tempmailo.com',
  '33mail.com',
  'maildrop.cc',
  'spambog.com',
  'mohmal.com',
  'mailpoof.com',
  'inboxbear.com',
  'tempmail.dev',
  'discard.email',
  'emlhub.com',
  'tmpmail.org',
  'mail-temp.com',
  'temporary-mail.net',
  'luxusmail.org',
  'fakemailgenerator.com',
  'anonaddy.com',
])

export function isDisposableEmail(email: string): boolean {
  const lower = email.trim().toLowerCase()
  const atIndex = lower.lastIndexOf('@')
  if (atIndex === -1) return false
  const domain = lower.slice(atIndex + 1)
  return DISPOSABLE_EMAIL_DOMAINS.has(domain)
}

// ── IP hashing + header parsing (pure) ──────────────────────────────────

/** sha256 hex of ip+salt. Salt is a plain constant (see IP_HASH_SALT in promo.ts) — not meant to be secret-strength. */
export function hashIp(ip: string, salt: string): string {
  return createHash('sha256').update(`${ip}${salt}`).digest('hex')
}

/** First IP in a comma-separated X-Forwarded-For header value, or null if absent/blank. */
export function firstForwardedIp(headerValue: string | null): string | null {
  if (!headerValue) return null
  const first = headerValue.split(',')[0]?.trim()
  return first || null
}

// ── Abuse signal evaluation (pure) ──────────────────────────────────────

export interface PromoIdentityRow {
  user_id: string
  normalized_email: string
  ip_hash: string | null
  ab_id: string | null
  created_at: string
}

export interface EvaluateAbuseSignalsParams {
  normalizedEmail: string
  abId: string | null
  ipHash: string | null
  currentUserId: string
  now: Date
}

export interface AbuseVerdict {
  verdict: 'allow' | 'deny'
  reason?: 'email_reused' | 'browser_reused' | 'ip_velocity'
}

const IP_VELOCITY_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * PURE — no I/O. `rows` are EXISTING promo_identity rows the caller already
 * fetched (matching normalized_email, ab_id, or ip_hash). Evaluated in order:
 * email reuse under a different account, then browser (ab_id) reuse under a
 * different account, then IP velocity (2+ distinct accounts sharing an IP
 * within 24h, counting the current user as a potential one of them).
 * A null ab_id/ip_hash never matches anything — there is no signal to
 * compare against.
 */
export function evaluateAbuseSignals(rows: PromoIdentityRow[], params: EvaluateAbuseSignalsParams): AbuseVerdict {
  const { normalizedEmail, abId, ipHash, currentUserId, now } = params

  const emailReused = rows.some(r => r.normalized_email === normalizedEmail && r.user_id !== currentUserId)
  if (emailReused) return { verdict: 'deny', reason: 'email_reused' }

  const browserReused = abId !== null && rows.some(r => r.ab_id !== null && r.ab_id === abId && r.user_id !== currentUserId)
  if (browserReused) return { verdict: 'deny', reason: 'browser_reused' }

  if (ipHash !== null) {
    const cutoff = now.getTime() - IP_VELOCITY_WINDOW_MS
    const usersOnThisIp = new Set<string>()
    for (const r of rows) {
      if (r.ip_hash !== null && r.ip_hash === ipHash && new Date(r.created_at).getTime() >= cutoff) {
        usersOnThisIp.add(r.user_id)
      }
    }
    usersOnThisIp.add(currentUserId) // velocity is about distinct accounts on one IP, including this request's account
    if (usersOnThisIp.size >= 2) return { verdict: 'deny', reason: 'ip_velocity' }
  }

  return { verdict: 'allow' }
}

// ── Suspicious-cluster counting for admin visibility (pure) ────────────

/**
 * Count of distinct ip_hash values PLUS distinct ab_id values (within the
 * given rows — caller scopes to the current promo period) that are
 * associated with 2 or more distinct user_ids each.
 */
export function countSuspiciousClusters(rows: PromoIdentityRow[]): number {
  function countGroupsWith2PlusUsers(keyOf: (row: PromoIdentityRow) => string | null): number {
    const groups = new Map<string, Set<string>>()
    for (const row of rows) {
      const key = keyOf(row)
      if (key === null) continue
      const users = groups.get(key) ?? new Set<string>()
      users.add(row.user_id)
      groups.set(key, users)
    }
    let clusters = 0
    for (const users of groups.values()) {
      if (users.size >= 2) clusters++
    }
    return clusters
  }

  return countGroupsWith2PlusUsers(r => r.ip_hash) + countGroupsWith2PlusUsers(r => r.ab_id)
}

// ── I/O wrapper: promo_identity table access ────────────────────────────

export interface PromoIdentityMatchParams {
  normalizedEmail: string
  abId: string | null
  ipHash: string | null
}

/**
 * Fetches promo_identity rows matching ANY of the given signals. Returns
 * `missingTable: true` (rows: []) if migration 020 hasn't been run yet —
 * callers must treat that as "skip abuse checks", never as "no matches".
 */
export async function queryPromoIdentityMatches(
  service: SupabaseClient<Database>,
  params: PromoIdentityMatchParams
): Promise<{ rows: PromoIdentityRow[]; missingTable: boolean }> {
  const { normalizedEmail, abId, ipHash } = params

  const orParts = [`normalized_email.eq.${normalizedEmail}`]
  if (abId) orParts.push(`ab_id.eq.${abId}`)
  if (ipHash) orParts.push(`ip_hash.eq.${ipHash}`)

  const { data, error } = await service
    .from('promo_identity')
    .select('user_id, normalized_email, ip_hash, ab_id, created_at')
    .or(orParts.join(','))

  if (error) {
    if (isMissingTable(error)) return { rows: [], missingTable: true }
    console.error('promo_identity match query failed:', error)
    return { rows: [], missingTable: false }
  }

  return { rows: data ?? [], missingTable: false }
}

export interface InsertPromoIdentityParams {
  userId: string
  normalizedEmail: string
  ipHash: string | null
  abId: string | null
}

/** Inserts a promo_identity row. Swallows missing-table and other errors — never fails the caller's request. */
export async function insertPromoIdentity(
  service: SupabaseClient<Database>,
  params: InsertPromoIdentityParams
): Promise<void> {
  const { error } = await service.from('promo_identity').insert({
    user_id: params.userId,
    normalized_email: params.normalizedEmail,
    ip_hash: params.ipHash,
    ab_id: params.abId,
  })

  if (error && !isMissingTable(error)) {
    console.error('promo_identity insert failed:', error)
  }
}
