'use client'

import { openConsentManager } from '@/lib/consent'

/**
 * Reopens the cookie-consent manage panel (mounted once in the root layout)
 * so visitors can revise an earlier accept/decline choice at any time.
 */
export function CookiePreferencesLink() {
  return (
    <button
      type="button"
      onClick={openConsentManager}
      className="text-sm text-slate-400 hover:text-white transition-colors light:text-gray-500 light:hover:text-gray-900"
    >
      Cookie preferences
    </button>
  )
}
