import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ADMIN_PAGE_SIZE } from '@/lib/admin-pagination'

/**
 * Shared prev/next pager for admin lists (Block R3): Users, Affiliates,
 * Offers, Feedback. Server-renderable — just `<Link>`s to `?page=N`, so it
 * works with zero client JS and plain browser back/forward. Callers pass
 * whatever *other* search params (search query, filter) need to survive the
 * page change; page itself is added/stripped here.
 */
export function Pagination({
  page,
  totalPages,
  totalCount,
  pageSize = ADMIN_PAGE_SIZE,
  basePath,
  searchParams,
  className = '',
}: {
  /** Current 1-indexed page. */
  page: number
  totalPages: number
  /** Row count across all pages, if cheap to compute — renders "Showing X–Y of Z". */
  totalCount?: number
  pageSize?: number
  /** Path the page links point at, e.g. "/app/admin/users". */
  basePath: string
  /** Other search params to preserve across page changes (e.g. { q: "..." }). Falsy values are dropped. */
  searchParams?: Record<string, string | undefined>
  className?: string
}) {
  const canPrev = page > 1
  const canNext = page < totalPages

  const hrefFor = (target: number) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(searchParams ?? {})) {
      if (value) params.set(key, value)
    }
    if (target > 1) params.set('page', String(target))
    const qs = params.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }

  const from = totalCount !== undefined && totalCount > 0 ? (page - 1) * pageSize + 1 : 0
  const to = totalCount !== undefined ? Math.min(page * pageSize, totalCount) : 0

  const buttonCls = (enabled: boolean) =>
    `inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
      enabled
        ? 'border-white/10 text-slate-300 hover:border-white/20 hover:text-white light:border-gray-200 light:text-gray-600 light:hover:border-gray-300 light:hover:text-gray-900'
        : 'border-white/5 text-slate-600 cursor-not-allowed opacity-50 light:border-gray-100 light:text-gray-300'
    }`

  return (
    <nav
      aria-label="Pagination"
      className={`flex items-center justify-between gap-4 flex-wrap pt-4 ${className}`}
    >
      <p className="text-xs text-slate-500 light:text-gray-400">
        {totalCount !== undefined
          ? totalCount > 0
            ? `Showing ${from}–${to} of ${totalCount}`
            : 'No results'
          : `Page ${page} of ${totalPages}`}
      </p>
      <div className="flex items-center gap-2">
        {canPrev ? (
          <Link href={hrefFor(page - 1)} className={buttonCls(true)} rel="prev" aria-label="Previous page">
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Prev
          </Link>
        ) : (
          <span className={buttonCls(false)} aria-disabled="true">
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Prev
          </span>
        )}
        <span className="text-xs text-slate-400 light:text-gray-500 px-1 tabular-nums">
          Page {page} of {totalPages}
        </span>
        {canNext ? (
          <Link href={hrefFor(page + 1)} className={buttonCls(true)} rel="next" aria-label="Next page">
            Next
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        ) : (
          <span className={buttonCls(false)} aria-disabled="true">
            Next
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        )}
      </div>
    </nav>
  )
}
