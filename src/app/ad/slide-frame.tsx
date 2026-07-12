'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { FORMAT_DIMS, type SlideFormat } from './slide-formats'

/**
 * Renders a fixed-size slide scaled to fit the space under a nav bar. The
 * nav is normal flow (never a fixed overlay), so it can't sit on top of the
 * slide in a screenshot at any window shape — and when the viewport exactly
 * matches the frame size (devtools device emulation for pixel-perfect
 * captures) the nav hides itself entirely, so those captures stay 1:1 and
 * chrome-free.
 */
export function SlideFrame({
  children,
  format = 'tall',
  nav,
}: {
  children: ReactNode
  format?: SlideFormat
  nav?: ReactNode
}) {
  const { w, h } = FORMAT_DIMS[format]
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
    const fit = () => setScale(Math.min(el.clientWidth / w, el.clientHeight / h))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [w, h])

  return (
    <div className="flex h-screen w-screen flex-col bg-black">
      {nav && !captureMode && (
        <nav className="flex h-9 shrink-0 items-center gap-3 px-3 text-xs text-slate-400">{nav}</nav>
      )}
      <div ref={box} className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden">
        <div style={{ width: w, height: h, transform: `scale(${scale})`, flexShrink: 0 }}>
          {children}
        </div>
      </div>
    </div>
  )
}
