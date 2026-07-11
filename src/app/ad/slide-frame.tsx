'use client'

import { useEffect, useState, type ReactNode } from 'react'

export const SLIDE_W = 1080
export const SLIDE_H = 1920

/**
 * Renders a fixed 1080×1920 slide scaled to fit the viewport, so the whole
 * frame is always visible for screenshotting regardless of window size.
 * For pixel-perfect captures use devtools device emulation at 1080×1920 —
 * at exactly that size the scale is 1 and nothing is resampled.
 */
export function SlideFrame({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(0.4)

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / SLIDE_W, window.innerHeight / SLIDE_H))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  return (
    <main className="flex h-screen w-screen items-center justify-center overflow-hidden bg-black">
      <div style={{ width: SLIDE_W, height: SLIDE_H, transform: `scale(${scale})`, flexShrink: 0 }}>
        {children}
      </div>
    </main>
  )
}
