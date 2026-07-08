import Link from 'next/link'
import { createServiceClient } from '@/lib/db'
import { Pagination } from '@/components/admin'
import { ADMIN_PAGE_SIZE, pageRange, parsePage, totalPageCount } from '@/lib/admin-pagination'
import { ErrorLogList, type ErrorRow } from './errors-client'

export const metadata = { title: 'Errors — Admin — Idea Engine' }

// This page lives under src/app/app/admin/, whose layout.tsx already gates on
// isAdminEmail (redirects non-admins to /app before this ever renders). Reading
// error_log via createServiceClient here is safe BECAUSE that gate already ran.

export default async function AdminErrorsPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; page?: string }>
}) {
  const { source: sourceParam, page: pageParam } = await searchParams
  const sourceFilter = sourceParam || null
  const page = parsePage(pageParam)
  const { from, to } = pageRange(page)

  const service = createServiceClient()

  // Distinct sources for the filter chips. Bounded scan — the log is small and
  // trimmable via Clear all; if it ever grows large this becomes an RPC.
  const { data: sourceRows } = await service.from('error_log').select('source').limit(1000)
  const sources = [...new Set((sourceRows ?? []).map(r => r.source))].sort()

  let listQuery = service
    .from('error_log')
    .select('id, occurred_at, source, message, detail, path, user_id', { count: 'exact' })
    .order('occurred_at', { ascending: false })
  if (sourceFilter) listQuery = listQuery.eq('source', sourceFilter)
  const { data: errors, count } = await listQuery.range(from, to)

  const rows = (errors ?? []) as ErrorRow[]
  const totalCount = count ?? 0
  const pages = totalPageCount(totalCount)

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white light:text-gray-900 mb-1">Errors</h1>
      <p className="text-sm text-slate-400 light:text-gray-500 mb-8">
        Server-side failures recorded across the app — report generation, admin actions, and more.
        Expand a row for full detail, or use Copy to paste it into a chat.
      </p>

      {/* Source filter */}
      {sources.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-xs text-slate-500 light:text-gray-400">Source:</span>
          <Link
            href="/app/admin/errors"
            className={`text-xs px-2.5 py-1 rounded-full border ${
              !sourceFilter
                ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30 light:bg-indigo-100 light:text-indigo-700 light:border-indigo-200'
                : 'bg-white/5 text-slate-400 border-white/10 light:bg-gray-50 light:text-gray-500 light:border-gray-200'
            }`}
          >
            All
          </Link>
          {sources.map(src => (
            <Link
              key={src}
              href={`/app/admin/errors?source=${encodeURIComponent(src)}`}
              className={`text-xs px-2.5 py-1 rounded-full border ${
                sourceFilter === src
                  ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30 light:bg-indigo-100 light:text-indigo-700 light:border-indigo-200'
                  : 'bg-white/5 text-slate-400 border-white/10 light:bg-gray-50 light:text-gray-500 light:border-gray-200'
              }`}
            >
              {src}
            </Link>
          ))}
        </div>
      )}

      <ErrorLogList rows={rows} />

      {totalCount > ADMIN_PAGE_SIZE && (
        <Pagination
          page={page}
          totalPages={pages}
          totalCount={totalCount}
          basePath="/app/admin/errors"
          searchParams={{ source: sourceParam }}
          className="mt-2"
        />
      )}
    </div>
  )
}
