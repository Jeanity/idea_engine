'use client'

import { useEffect, useState } from 'react'

type Theme = 'dark' | 'light' | 'smexy'

/**
 * Dark is the app's default; "light" and "smexy" are opt-in via a class on
 * <html> (see the no-flash init script in layout.tsx) — light: Tailwind
 * variant overrides for light, the globals.css "Smexy mode" layer for smexy.
 * Preference persists in localStorage('theme').
 *
 * Smexy is offered only while the admin flag (app_settings 'smexy_theme',
 * fetched from /api/theme-modes) is on; when it's off the cycle collapses to
 * the old dark↔light toggle and a saved smexy preference demotes to dark.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark')
  const [smexyAllowed, setSmexyAllowed] = useState(false)

  useEffect(() => {
    // Reads the class the no-flash init script (layout.tsx) applied to <html>
    // before hydration. Must run post-mount, not during render, so SSR output
    // (always dark) matches the client's first paint and avoids a hydration
    // mismatch; there is no render-time equivalent for this DOM read.
    const el = document.documentElement
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(el.classList.contains('smexy') ? 'smexy' : el.classList.contains('light') ? 'light' : 'dark')

    fetch('/api/theme-modes')
      .then(res => res.json())
      .then(data => {
        const allowed = data?.smexy === true
        setSmexyAllowed(allowed)
        if (!allowed && el.classList.contains('smexy')) apply('dark')
      })
      .catch(() => {}) // flag fetch failing just means the third mode isn't offered
  }, [])

  function apply(next: Theme) {
    setTheme(next)
    const el = document.documentElement
    el.classList.toggle('light', next === 'light')
    el.classList.toggle('smexy', next === 'smexy')
    localStorage.setItem('theme', next)
  }

  function cycle() {
    if (theme === 'dark') apply('light')
    else if (theme === 'light') apply(smexyAllowed ? 'smexy' : 'dark')
    else apply('dark')
  }

  const nextLabel =
    theme === 'dark' ? 'Switch to light mode'
    : theme === 'light' ? (smexyAllowed ? 'Switch to smexy mode' : 'Switch to dark mode')
    : 'Switch to dark mode'

  return (
    <button
      onClick={cycle}
      aria-label={nextLabel}
      title={nextLabel}
      className={`rounded-lg p-2 transition-colors ${
        theme === 'smexy'
          ? 'text-fuchsia-300 hover:text-fuchsia-200 hover:bg-white/5'
          : 'text-slate-300 hover:text-white hover:bg-white/5 light:text-gray-500 light:hover:text-gray-800 light:hover:bg-gray-100'
      }`}
    >
      {theme === 'smexy' ? (
        // sparkles — smexy mode is on
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
        </svg>
      ) : theme === 'light' ? (
        // moon — offer the way back to dark (or onward to smexy)
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
        </svg>
      ) : (
        // sun — "turn the lights on"
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
        </svg>
      )}
    </button>
  )
}
