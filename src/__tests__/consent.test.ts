import { describe, it, expect } from 'vitest'
import { CONSENT_COOKIE, CONSENT_VERSION, parseConsentCookie, serializeConsentCookie, serializeCookieDeletion } from '@/lib/consent'

describe('parseConsentCookie', () => {
  it('returns null when the cookie is absent', () => {
    expect(parseConsentCookie('')).toBeNull()
    expect(parseConsentCookie('other=1; ie_sid=abc')).toBeNull()
  })

  it('parses a valid consent value', () => {
    const value = { v: CONSENT_VERSION, analytics: true, at: '2026-07-09T00:00:00.000Z' }
    const cookieString = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(value))}`
    expect(parseConsentCookie(cookieString)).toEqual(value)
  })

  it('parses when other cookies surround it', () => {
    const value = { v: CONSENT_VERSION, analytics: false, at: '2026-07-09T00:00:00.000Z' }
    const cookieString = `ie_sid=xyz; ${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(value))}; theme=light`
    expect(parseConsentCookie(cookieString)).toEqual(value)
  })

  it('returns null for malformed JSON', () => {
    expect(parseConsentCookie(`${CONSENT_COOKIE}=not-json`)).toBeNull()
  })

  it('returns null when required fields are missing or mistyped', () => {
    expect(parseConsentCookie(`${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify({ v: CONSENT_VERSION, analytics: 'yes' }))}`)).toBeNull()
    expect(parseConsentCookie(`${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify({ v: CONSENT_VERSION, at: '2026' }))}`)).toBeNull()
  })

  it('treats a pre-versioning (v1) consent as undecided — the banner must re-ask', () => {
    // Cookies written before CONSENT_VERSION existed have no `v` field. The
    // banner promised "if that ever changes, we'll ask first" — adding GA
    // changed what "analytics" means, so old consents must NOT carry over.
    const v1 = { analytics: true, at: '2026-07-09T00:00:00.000Z' }
    expect(parseConsentCookie(`${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(v1))}`)).toBeNull()
  })

  it('treats a mismatched future/older version as undecided', () => {
    const other = { v: CONSENT_VERSION + 1, analytics: true, at: '2026-07-09T00:00:00.000Z' }
    expect(parseConsentCookie(`${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(other))}`)).toBeNull()
  })
})

describe('serializeConsentCookie', () => {
  it('round-trips through parseConsentCookie', () => {
    const value = { v: CONSENT_VERSION, analytics: true, at: '2026-07-09T00:00:00.000Z' }
    const serialized = serializeConsentCookie(value, false)
    expect(parseConsentCookie(serialized)).toEqual(value)
  })

  it('adds Secure only when requested', () => {
    const value = { v: CONSENT_VERSION, analytics: false, at: '2026-07-09T00:00:00.000Z' }
    expect(serializeConsentCookie(value, true)).toContain('; Secure')
    expect(serializeConsentCookie(value, false)).not.toContain('; Secure')
  })

  it('sets a ~12 month Max-Age', () => {
    const value = { v: CONSENT_VERSION, analytics: false, at: '2026-07-09T00:00:00.000Z' }
    expect(serializeConsentCookie(value, false)).toContain('Max-Age=31536000')
  })
})

describe('serializeCookieDeletion', () => {
  it('expires the named cookie immediately', () => {
    expect(serializeCookieDeletion('ie_vid')).toBe('ie_vid=; Path=/; Max-Age=0; SameSite=Lax')
  })
})
