'use client'

import { useEffect } from 'react'
import { CONSENT_CHANGED_EVENT, hasAnalyticsConsent } from '@/lib/consent'
import { GA_MEASUREMENT_ID } from '@/lib/site'

// Consent-gated Google Analytics loader (the standing GA decision,
// 2026-07-09: GA loads ONLY behind hasAnalyticsConsent()). Mounted once in
// the root layout next to the first-party AnalyticsBeacon.
//
// - gtag.js is injected only after the visitor opts into analytics — never
//   on first paint, never for decliners. Accepting via the banner loads it
//   immediately (CONSENT_CHANGED_EVENT), no reload needed.
// - Declining (or revoking from "Cookie preferences") sets GA's official
//   per-property kill switch (window['ga-disable-<id>']) — an already-loaded
//   gtag stops sending anything — and deletes GA's _ga* cookies, mirroring
//   how the beacon's decline path deletes ie_vid.
// - Loads only on the real hostname so localhost/preview traffic can never
//   pollute the property.
// - No SPA route-change wiring needed: GA4's enhanced measurement tracks
//   history-based page changes by itself (left ON when the stream was made).

const SCRIPT_ID = 'ga-gtag'
const DISABLE_KEY = `ga-disable-${GA_MEASUREMENT_ID}`

/** Expire GA's cookies (_ga + _ga_<stream>). GA sets them on the top-level
 *  domain, so expire both with and without an explicit Domain attribute. */
function deleteGaCookies() {
  const names = document.cookie
    .split('; ')
    .map(pair => pair.split('=')[0])
    .filter(name => name === '_ga' || name.startsWith('_ga_'))
  for (const name of names) {
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`
    document.cookie = `${name}=; Path=/; Domain=.${location.hostname}; Max-Age=0; SameSite=Lax`
  }
}

export function GoogleAnalytics() {
  useEffect(() => {
    if (!location.hostname.endsWith('hadidea.com')) return

    const w = window as unknown as Record<string, unknown>

    function sync() {
      if (hasAnalyticsConsent()) {
        w[DISABLE_KEY] = false
        if (!document.getElementById(SCRIPT_ID)) {
          const dataLayer: unknown[] = Array.isArray(w.dataLayer) ? (w.dataLayer as unknown[]) : []
          w.dataLayer = dataLayer
          // gtag stubs must push the live `arguments` object — gtag.js
          // depends on it; an args array does not work.
          w.gtag = function gtag() {
            // eslint-disable-next-line prefer-rest-params
            dataLayer.push(arguments)
          }
          const gtag = w.gtag as (...args: unknown[]) => void
          gtag('js', new Date())
          gtag('config', GA_MEASUREMENT_ID)

          const script = document.createElement('script')
          script.id = SCRIPT_ID
          script.async = true
          script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`
          document.head.appendChild(script)
        }
      } else {
        w[DISABLE_KEY] = true
        deleteGaCookies()
      }
    }

    sync()
    window.addEventListener(CONSENT_CHANGED_EVENT, sync)
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, sync)
  }, [])

  return null
}
