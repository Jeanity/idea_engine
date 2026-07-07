import type { ReactNode } from 'react'

/**
 * Base admin surface — the rounded, bordered, theme-aware panel every admin
 * widget sits on. R2/R3/R4 compose StatCard / WidgetCard / tables on top of it,
 * so keep it dumb: just the shell + spacing. `padded={false}` for cases that
 * manage their own inner padding (e.g. a table that bleeds to the card edge).
 */
export function AdminCard({
  children,
  className = '',
  padded = true,
}: {
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm ${
        padded ? 'p-5' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}
