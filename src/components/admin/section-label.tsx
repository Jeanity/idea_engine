import type { ReactNode } from 'react'

/**
 * Tiny uppercase muted group heading — used for the sidebar nav sections
 * (OVERVIEW / MANAGEMENT / …) and reusable anywhere a card cluster needs a
 * quiet label above it.
 */
export function SectionLabel({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <p
      className={`text-[11px] font-semibold uppercase tracking-wider text-slate-500 light:text-gray-400 ${className}`}
    >
      {children}
    </p>
  )
}
