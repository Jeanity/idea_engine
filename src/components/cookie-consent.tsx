'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  CONSENT_OPEN_MANAGE_EVENT,
  deleteCookie,
  dispatchConsentChanged,
  readConsent,
  writeConsent,
} from '@/lib/consent'

const VID_COOKIE = 'ie_vid'

type Visibility = 'hidden' | 'banner' | 'manage'

/**
 * Fixed bottom cookie-consent bar. Mounted once in the root layout so it
 * covers the whole app. Shows automatically while consent is undecided
 * (`ie_consent` cookie absent); can also be reopened from anywhere via
 * `openConsentManager()` (used by the footer's "Cookie preferences" link).
 *
 * No cookie wall: the site behaves identically whichever choice is made —
 * this only gates the analytics beacon (see analytics-beacon.tsx).
 */
export function CookieConsentBanner() {
  const [visibility, setVisibility] = useState<Visibility>('hidden')
  const [analyticsChoice, setAnalyticsChoice] = useState(false)
  // Internal ad-production frames (/ad/*) are screenshotted for video — the
  // banner would end up baked into every capture. No analytics decision is
  // being made on those pages, so suppressing the prompt loses nothing.
  const isAdStudio = usePathname()?.startsWith('/ad') ?? false

  useEffect(() => {
    const existing = readConsent()
    if (!existing) {
      setVisibility('banner')
    } else {
      setAnalyticsChoice(existing.analytics)
    }

    function onOpenManage() {
      setAnalyticsChoice(readConsent()?.analytics ?? false)
      setVisibility('manage')
    }
    window.addEventListener(CONSENT_OPEN_MANAGE_EVENT, onOpenManage)
    return () => window.removeEventListener(CONSENT_OPEN_MANAGE_EVENT, onOpenManage)
  }, [])

  function acceptAll() {
    writeConsent(true)
    dispatchConsentChanged()
    setVisibility('hidden')
  }

  function decline() {
    writeConsent(false)
    deleteCookie(VID_COOKIE)
    dispatchConsentChanged()
    setVisibility('hidden')
  }

  function openManage() {
    setAnalyticsChoice(readConsent()?.analytics ?? false)
    setVisibility('manage')
  }

  function save() {
    writeConsent(analyticsChoice)
    if (!analyticsChoice) deleteCookie(VID_COOKIE)
    dispatchConsentChanged()
    setVisibility('hidden')
  }

  if (visibility === 'hidden' || isAdStudio) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-slate-950/95 px-4 py-4 backdrop-blur sm:px-6 light:border-gray-200 light:bg-white/95"
    >
      <div className="mx-auto max-w-4xl">
        {visibility === 'banner' && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-300 light:text-gray-600">
              These aren&apos;t the creepy kind of cookies. Essentials keep you signed in; optional
              analytics count your visit so we can see what&apos;s working — nothing follows you
              once you leave. If that ever changes, we&apos;ll ask first.{' '}
              <Link href="/privacy" className="text-indigo-300 underline hover:text-indigo-200 light:text-indigo-600 light:hover:text-indigo-700">
                See for yourself
              </Link>
              .
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={openManage}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 light:text-gray-600 light:hover:text-gray-900 light:hover:bg-gray-100 transition-colors"
              >
                Manage
              </button>
              <button
                onClick={decline}
                className="rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-white/5 light:border-gray-300 light:text-gray-700 light:hover:bg-gray-100 transition-colors"
              >
                Decline
              </button>
              <button
                onClick={acceptAll}
                className="rounded-lg bg-indigo-500 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-400 transition-colors"
              >
                Accept all
              </button>
            </div>
          </div>
        )}

        {visibility === 'manage' && (
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white light:text-gray-900">Cookie preferences</h2>
              <button
                onClick={() => setVisibility('hidden')}
                aria-label="Close"
                className="rounded p-1 text-slate-400 hover:text-white light:text-gray-400 light:hover:text-gray-900"
              >
                ×
              </button>
            </div>

            <div className="mt-3 space-y-3">
              <div className="flex items-start justify-between gap-4 rounded-lg border border-white/10 px-3 py-2.5 light:border-gray-200">
                <div>
                  <p className="text-sm font-medium text-slate-200 light:text-gray-800">Necessary</p>
                  <p className="mt-0.5 text-xs text-slate-500 light:text-gray-500">
                    Sign-in and this cookie-preference itself. Always on — the site can&apos;t run
                    without them.
                  </p>
                </div>
                <button
                  disabled
                  aria-label="Necessary cookies (always on)"
                  className="mt-0.5 h-5 w-9 shrink-0 cursor-not-allowed rounded-full bg-indigo-500/60"
                >
                  <span className="block h-4 w-4 translate-x-4 rounded-full bg-white" />
                </button>
              </div>

              <div className="flex items-start justify-between gap-4 rounded-lg border border-white/10 px-3 py-2.5 light:border-gray-200">
                <div>
                  <p className="text-sm font-medium text-slate-200 light:text-gray-800">Analytics</p>
                  <p className="mt-0.5 text-xs text-slate-500 light:text-gray-500">
                    Our own anonymous page-view counter, plus Google Analytics (sets{' '}
                    <code>_ga</code> cookies to tell visitors apart). Off by default; declining
                    also deletes any existing analytics cookies.
                  </p>
                </div>
                <button
                  onClick={() => setAnalyticsChoice(v => !v)}
                  aria-label="Toggle analytics cookies"
                  aria-pressed={analyticsChoice}
                  className={`mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${
                    analyticsChoice ? 'bg-indigo-500' : 'bg-white/15 light:bg-gray-300'
                  }`}
                >
                  <span
                    className={`block h-4 w-4 rounded-full bg-white transition-transform ${
                      analyticsChoice ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={save}
                className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 transition-colors"
              >
                Save preferences
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
