import type { ReactNode } from 'react'
import { AdminCard } from './admin-card'

/**
 * Titled widget container: header row (title + optional right-aligned action
 * slot, e.g. a period toggle) over a body. R2 uses this for the overview chart
 * and the quick-view widgets. Body padding is owned here so callers just pass
 * content; pass `bodyClassName="p-0"` for edge-to-edge bodies like tables.
 */
export function WidgetCard({
  title,
  subtitle,
  action,
  children,
  className = '',
  bodyClassName = '',
}: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <AdminCard padded={false} className={className}>
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white light:text-gray-900">{title}</p>
          {subtitle && (
            <p className="mt-0.5 text-xs text-slate-500 light:text-gray-400">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={`flex-1 ${bodyClassName === '' ? 'p-5' : bodyClassName}`}>{children}</div>
    </AdminCard>
  )
}
