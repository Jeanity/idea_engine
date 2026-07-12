'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Fits an exact-pixel brand asset to the space under its own nav bar for
 * screenshotting. The nav is normal flow (never an overlay), so it can't
 * end up inside a capture at any window shape — and when the viewport
 * exactly matches the asset size (devtools device emulation) the nav hides
 * itself, keeping those captures 1:1 and chrome-free. Mirrors SlideFrame.
 */
export function PixelFrame({ w, h, label, children }: { w: number; h: number; label: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.4)
  const [captureMode, setCaptureMode] = useState(false)

  useEffect(() => {
    const detect = () =>
      setCaptureMode(Math.abs(window.innerWidth - w) <= 2 && Math.abs(window.innerHeight - h) <= 2)
    detect()
    window.addEventListener('resize', detect)
    return () => window.removeEventListener('resize', detect)
  }, [w, h])

  useEffect(() => {
    const el = box.current
    if (!el) return
    const fit = () => setScale(Math.min(el.clientWidth / w, el.clientHeight / h, 1))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [w, h])

  return (
    <main className="flex h-screen w-screen flex-col bg-black">
      {!captureMode && (
        <nav className="flex h-9 shrink-0 items-center gap-3 px-3 text-xs text-slate-400">
          <Link href="/ad" className="hover:text-white">index</Link>
          <span>{label} · capture at {w}×{h}</span>
        </nav>
      )}
      <div ref={box} className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden">
        <div style={{ width: w, height: h, transform: `scale(${scale})`, flexShrink: 0 }}>
          {children}
        </div>
      </div>
    </main>
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
