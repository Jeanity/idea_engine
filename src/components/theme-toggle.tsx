'use client'

import { useEffect, useState } from 'react'

/**
 * Dark is the app's default; "light" is opt-in via a `.light` class on <html>
 * (see the no-flash init script in layout.tsx) + `light:` Tailwind variant
 * overrides. Preference persists in localStorage('theme').
 */
export function ThemeToggle() {
  const [light, setLight] = useState(false)

  useEffect(() => {
    setLight(document.documentElement.classList.contains('light'))
  }, [])

  function toggle() {
    const next = !light
    setLight(next)
    document.documentElement.classList.toggle('light', next)
    localStorage.setItem('theme', next ? 'light' : 'dark')
  }

  return (
    <button
      onClick={toggle}
      aria-label={light ? 'Switch to dark mode' : 'Switch to light mode'}
      title={light ? 'Switch to dark mode' : 'Switch to light mode'}
      className="rounded-lg p-2 text-slate-300 hover:text-white hover:bg-white/5 light:text-gray-500 light:hover:text-gray-800 light:hover:bg-gray-100 transition-colors"
    >
      {light ? (
        // moon — offer the way back to dark
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
