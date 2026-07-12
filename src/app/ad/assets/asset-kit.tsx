'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'

/**
 * Fits an exact-pixel brand asset to the viewport for screenshotting —
 * same workflow as the campaign slides: devtools device emulation at the
 * asset's stated size captures it 1:1.
 */
export function PixelFrame({ w, h, label, children }: { w: number; h: number; label: string; children: ReactNode }) {
  const [scale, setScale] = useState(0.4)

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / w, window.innerHeight / h, 1))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [w, h])

  return (
    <>
      <nav className="fixed left-3 top-3 z-50 flex items-center gap-3 rounded-lg bg-black/70 px-3 py-1.5 text-xs text-slate-400">
        <Link href="/ad" className="hover:text-white">index</Link>
        <span>{label} · capture at {w}×{h}</span>
      </nav>
      <main className="flex h-screen w-screen items-center justify-center overflow-hidden bg-black">
        <div style={{ width: w, height: h, transform: `scale(${scale})`, flexShrink: 0 }}>
          {children}
        </div>
      </main>
    </>
  )
}

/** The site icon's lightbulb motif (src/app/icon.svg paths, verbatim) at an
 *  arbitrary size — keeps every brand asset pixel-consistent with the favicon. */
export function BulbMark({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <path fill="#fff" d="M16 6.5a6.5 6.5 0 0 0-3.9 11.7c.6.45 1.02 1.1 1.18 1.83l.12.47h5.2l.12-.47c.16-.73.58-1.38 1.18-1.83A6.5 6.5 0 0 0 16 6.5Z" />
      <rect x="13.2" y="21.7" width="5.6" height="1.7" rx="0.85" fill="#fff" opacity="0.9" />
      <rect x="13.8" y="24.1" width="4.4" height="1.6" rx="0.8" fill="#fff" opacity="0.75" />
      <path stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity="0.85" d="M16 3.2v1.4M8.7 6.2l1 1M23.3 6.2l-1 1M6.2 13h1.4M24.4 13h1.4" />
    </svg>
  )
}
