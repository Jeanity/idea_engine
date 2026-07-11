'use client'

import { useEffect, useState, type ReactNode } from 'react'

/**
 * Renders a fixed-size slide scaled to fit the viewport, so the whole frame
 * is always visible for screenshotting regardless of window size. Portrait
 * (1080×1920, Reels/TikTok/Shorts) by default; wide swaps to landscape
 * (1920×1080, YouTube). For pixel-perfect captures use devtools device
 * emulation at the frame's exact size — the scale is then 1 and nothing is
 * resampled.
 */
export function SlideFrame({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const w = wide ? 1920 : 1080
  const h = wide ? 1080 : 1920
  const [scale, setScale] = useState(0.4)

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / w, window.innerHeight / h))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [w, h])

  return (
    <main className="flex h-screen w-screen items-center justify-center overflow-hidden bg-black">
      <div style={{ width: w, height: h, transform: `scale(${scale})`, flexShrink: 0 }}>
        {children}
      </div>
    </main>
  )
}
