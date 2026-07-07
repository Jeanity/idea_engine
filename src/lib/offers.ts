import type { Database } from './database.types'

type OfferRow = Database['public']['Tables']['offers']['Row']

/**
 * How long after signup a profile counts as a "new user" for offer audience
 * targeting (audience = 'new_users'). Single source of truth — used by the
 * account-page banner. Keep in sync with any copy that references "first
 * week" style language.
 */
export const NEW_USER_WINDOW_DAYS = 7

export function isNewUser(profileCreatedAt: string, now: Date = new Date()): boolean {
  const ageMs = now.getTime() - new Date(profileCreatedAt).getTime()
  return ageMs < NEW_USER_WINDOW_DAYS * 24 * 60 * 60 * 1000
}

export type OfferLifecycleStatus = 'live' | 'scheduled' | 'expired'

/**
 * Derives a display status from active + starts_at/ends_at. This is the same
 * "live" definition the RLS policies use (active AND now within
 * [starts_at, ends_at ?? infinity]) — kept in one place so the admin chip and
 * the public banners never disagree about what "live" means.
 */
export function offerLifecycleStatus(
  offer: Pick<OfferRow, 'active' | 'starts_at' | 'ends_at'>,
  now: Date = new Date()
): OfferLifecycleStatus {
  if (!offer.active) return 'expired'
  const start = new Date(offer.starts_at)
  if (now < start) return 'scheduled'
  if (offer.ends_at && now > new Date(offer.ends_at)) return 'expired'
  return 'live'
}

export function isOfferLive(
  offer: Pick<OfferRow, 'active' | 'starts_at' | 'ends_at'>,
  now: Date = new Date()
): boolean {
  return offerLifecycleStatus(offer, now) === 'live'
}

/** "20% off" / "$5.00 off" / falls back to the raw description if neither is set. */
export function formatDiscount(offer: Pick<OfferRow, 'percent_off' | 'amount_off_cents'>): string | null {
  if (offer.percent_off != null) return `${offer.percent_off}% off`
  if (offer.amount_off_cents != null) return `$${(offer.amount_off_cents / 100).toFixed(2)} off`
  return null
}
