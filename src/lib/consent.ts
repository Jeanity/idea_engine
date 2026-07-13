// Cookie-consent state: pure helpers (unit-testable, no DOM) + thin
// document.cookie-backed wrappers used by client components.
//
// Consent lives in a single first-party cookie, `ie_consent`, holding JSON
// `{ analytics: boolean, at: ISO8601 }`. Its absence means "undecided" — the
// banner shows. The consent cookie itself is strictly necessary (it records a
// legal preference) and is never gated behind itself.

export const CONSENT_COOKIE = 'ie_consent'
export const CONSENT_TTL_S = 365 * 24 * 60 * 60 // ~12 months

/**
 * Bump whenever what a category MEANS changes — the banner promises "if
 * that ever changes, we'll ask first", and this is the asking mechanism: an
 * older (or missing) version parses as null = undecided, so the banner
 * reshows and the previous choice is not carried over.
 *   v2 (2026-07-14): "analytics" now includes Google Analytics, not just
 *   our own first-party counter.
 */
export const CONSENT_VERSION = 2

export interface ConsentValue {
  v: number
  analytics: boolean
  at: string
}

/** Read the raw `ie_consent` cookie out of a `document.cookie`-shaped string. */
export function parseConsentCookie(cookieString: string): ConsentValue | null {
  const match = cookieString.match(new RegExp('(?:^|; )' + CONSENT_COOKIE + '=([^;]*)'))
  if (!match) return null
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(match[1]))
    if (
      parsed &&
      typeof parsed === 'object' &&
      (parsed as Record<string, unknown>).v === CONSENT_VERSION &&
      typeof (parsed as Record<string, unknown>).analytics === 'boolean' &&
      typeof (parsed as Record<string, unknown>).at === 'string'
    ) {
      return { v: CONSENT_VERSION, analytics: (parsed as ConsentValue).analytics, at: (parsed as ConsentValue).at }
    }
  } catch {
    // Malformed cookie — treat as undecided.
  }
  // Absent, malformed, or from an older CONSENT_VERSION — all mean "ask".
  return null
}

/** Build the `Set-Cookie`-style string used to persist a consent decision. */
export function serializeConsentCookie(value: ConsentValue, secure: boolean): string {
  const secureFlag = secure ? '; Secure' : ''
  return `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(value))}; Path=/; Max-Age=${CONSENT_TTL_S}; SameSite=Lax${secureFlag}`
}

/** Build the string used to delete a cookie by name. */
export function serializeCookieDeletion(name: string): string {
  return `${name}=; Path=/; Max-Age=0; SameSite=Lax`
}

// ── DOM-backed wrappers ──────────────────────────────────────────

/** Current consent decision, or null when the visitor hasn't decided yet. */
export function readConsent(): ConsentValue | null {
  if (typeof document === 'undefined') return null
  return parseConsentCookie(document.cookie)
}

/** True only once the visitor has explicitly opted into analytics. */
export function hasAnalyticsConsent(): boolean {
  return readConsent()?.analytics === true
}

/** Persist a consent decision as the `ie_consent` cookie. */
export function writeConsent(analytics: boolean): ConsentValue {
  const value: ConsentValue = { v: CONSENT_VERSION, analytics, at: new Date().toISOString() }
  if (typeof document !== 'undefined') {
    const secure = typeof location !== 'undefined' && location.protocol === 'https:'
    document.cookie = serializeConsentCookie(value, secure)
  }
  return value
}

/** Delete a first-party cookie by name (used to clear `ie_vid` on decline). */
export function deleteCookie(name: string): void {
  if (typeof document !== 'undefined') {
    document.cookie = serializeCookieDeletion(name)
  }
}

// ── Cross-component signalling ───────────────────────────────────
// The banner is mounted once (root layout); the footer's "Cookie
// preferences" link needs to reopen it from anywhere in the tree without a
// shared React context. A plain window event keeps both sides decoupled.

export const CONSENT_CHANGED_EVENT = 'ie:consent-changed'
export const CONSENT_OPEN_MANAGE_EVENT = 'ie:consent-open-manage'

/** Notify listeners (e.g. the analytics beacon) that consent just changed. */
export function dispatchConsentChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT))
}

/** Ask the mounted consent banner to (re)open its manage panel. */
export function openConsentManager(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CONSENT_OPEN_MANAGE_EVENT))
}

// Google Analytics loads via src/components/google-analytics.tsx — gated on
// `hasAnalyticsConsent()`, re-synced on CONSENT_CHANGED_EVENT (declining sets
// GA's official disable flag and deletes its cookies immediately).
