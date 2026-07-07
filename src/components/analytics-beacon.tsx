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

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { parseUtmParams } from '@/lib/analytics'

const SID_COOKIE = 'ie_sid'
const VID_COOKIE = 'ie_vid'
const SESSION_TTL_S = 30 * 60 // 30 minutes, rolling
const VISITOR_TTL_S = 365 * 24 * 60 * 60 // 1 year

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

export function AnalyticsBeacon() {
  const pathname = usePathname()

  useEffect(() => {
    if (typeof navigator === 'undefined' || typeof document === 'undefined') return
    if (!pathname) return

    try {
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

      const body = JSON.stringify(payload)
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }))
      } else {
        // Fallback — keepalive so it survives the page unloading.
        fetch('/api/track', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(
          () => {}
        )
      }
    } catch {
      // Analytics must never break the page.
    }
  }, [pathname])

  return null
}
