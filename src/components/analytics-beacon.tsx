'use client'

// First-party, cookie-light page-view beacon. Mounted once in the root layout
// so it covers BOTH the public marketing site and the signed-in /app. It never
// blocks render and never touches the network on the server (all work is
// guarded behind `useEffect` + `typeof` checks).
//
// Cookies it owns (functional-only, no third-party analytics):
//   ie_sid  session id (uuid), 30-min rolling expiry  → session semantics
//   ie_vid  visitor id (uuid), persistent (1yr)       → returning-visitor counts
// On the first hit of a session it also sends document.referrer + parsed UTM.
// First-touch attribution is derived server-side at /auth/callback from the
// visitor's earliest event (see that route) — no extra cookie needed.
//
// Consent gating (see src/lib/consent.ts):
//   undecided → do nothing at all (no cookie, no network call).
//   accepted  → behaviour above, unchanged.
//   declined  → fire exactly one anonymised pageview per 10-minute window
//               (sessionStorage-backed throwaway id, no ie_sid/ie_vid ever
//               written) so admin traffic counts still see the visit, then
//               go quiet.

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { parseUtmParams } from '@/lib/analytics'
import { CONSENT_CHANGED_EVENT, deleteCookie, readConsent } from '@/lib/consent'

const SID_COOKIE = 'ie_sid'
const VID_COOKIE = 'ie_vid'
const SESSION_TTL_S = 30 * 60 // 30 minutes, rolling
const VISITOR_TTL_S = 365 * 24 * 60 * 60 // 1 year

const ANON_SID_KEY = 'ie_anon_sid'
const ANON_PING_KEY = 'ie_anon_ping_at'
const ANON_WINDOW_MS = 10 * 60 * 1000 // 10 minutes

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

function writeCookie(name: string, value: string, maxAgeSeconds: number) {
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  // Fallback for older browsers — good enough for a functional analytics id.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function send(payload: Record<string, unknown>) {
  const body = JSON.stringify(payload)
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }))
  } else {
    // Fallback — keepalive so it survives the page unloading.
    fetch('/api/track', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(
      () => {}
    )
  }
}

/** Declined path: at most one anonymised pageview per rolling 10-min window. */
function sendAnonymousPingIfDue(pathname: string) {
  try {
    const lastPing = Number(sessionStorage.getItem(ANON_PING_KEY) ?? 0)
    if (Date.now() - lastPing < ANON_WINDOW_MS) return

    let anonId = sessionStorage.getItem(ANON_SID_KEY)
    if (!anonId) {
      anonId = newId()
      sessionStorage.setItem(ANON_SID_KEY, anonId)
    }
    sessionStorage.setItem(ANON_PING_KEY, String(Date.now()))

    // Shaped exactly like a normal pageview event, minus `vid` — /api/track
    // accepts a null visitor id, so this counts toward session/pageview
    // totals without ever contributing to visitor or returning-visitor
    // counts (those key off `visitor_id`, which stays unset here).
    send({ path: pathname, sid: anonId, isNewSession: true })
  } catch {
    // sessionStorage can throw in locked-down contexts — analytics must
    // never break the page.
  }
}

export function AnalyticsBeacon() {
  const pathname = usePathname()

  useEffect(() => {
    if (typeof navigator === 'undefined' || typeof document === 'undefined') return
    if (!pathname) return

    try {
      const consent = readConsent()

      if (consent === null) {
        // Undecided — do nothing until the visitor chooses. No cookie, no call.
        return
      }

      if (!consent.analytics) {
        // Declined — no ie_sid/ie_vid ever, a persistent ie_vid from before
        // the decline must be removed, and at most one anonymous ping per
        // 10-minute sessionStorage window.
        deleteCookie(VID_COOKIE)
        sendAnonymousPingIfDue(pathname)
        return
      }

      // Accepted — original behaviour.
      let sessionId = readCookie(SID_COOKIE)
      const isNewSession = !sessionId
      if (!sessionId) sessionId = newId()
      // Refresh the session cookie on every navigation (rolling 30-min window).
      writeCookie(SID_COOKIE, sessionId, SESSION_TTL_S)

      let visitorId = readCookie(VID_COOKIE)
      if (!visitorId) visitorId = newId()
      writeCookie(VID_COOKIE, visitorId, VISITOR_TTL_S)

      const payload: Record<string, unknown> = {
        path: pathname,
        sid: sessionId,
        vid: visitorId,
        isNewSession,
      }

      // referrer + UTM are captured only on the first page of a session.
      if (isNewSession) {
        const ref = document.referrer
        // Ignore same-origin referrers (internal navigation before the cookie set).
        if (ref && !ref.startsWith(location.origin)) payload.referrer = ref
        const utm = parseUtmParams(location.search)
        if (utm) payload.utm = utm
      }

      send(payload)
    } catch {
      // Analytics must never break the page.
    }
    // Re-run when consent changes (e.g. accept → decline via the footer link)
    // so the very next navigation respects the new choice immediately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Consent can change without a navigation (Accept/Decline click on the
  // current page) — listen so a decline takes effect without waiting for the
  // next pathname change, and so any lingering ie_vid is cleared right away.
  useEffect(() => {
    function onConsentChanged() {
      try {
        const consent = readConsent()
        if (consent && !consent.analytics) {
          deleteCookie(VID_COOKIE)
        }
      } catch {
        // no-op
      }
    }
    window.addEventListener(CONSENT_CHANGED_EVENT, onConsentChanged)
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, onConsentChanged)
  }, [])

  return null
}
