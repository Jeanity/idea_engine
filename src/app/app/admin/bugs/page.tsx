import Link from 'next/link'
import { createServiceClient } from '@/lib/db'
import { Pagination, MarkSeen } from '@/components/admin'
import { ADMIN_PAGE_SIZE, pageRange, parsePage, totalPageCount } from '@/lib/admin-pagination'
import type { BugReportStatus } from '@/lib/database.types'
import { BugQueueList, type BugRow } from './bug-queue-list'

export const metadata = { title: 'Bugs — Admin — HadIdea' }

// This page lives under src/app/app/admin/, whose layout.tsx already gates on
// isAdminEmail (redirects non-admins to /app before this ever renders). Reading
// bug_reports via createServiceClient here is safe BECAUSE that gate already
// ran — never fetch with the service client before it.
//
// migration 018 may not have been run yet in this environment — a 42P01
// (undefined_table) error is expected until Danny runs it, and the page must
// show a friendly notice instead of crashing (same pattern as /app/admin/contact).

const STATUSES: BugReportStatus[] = ['open', 'triaged', 'resolved', 'wontfix']

export default async function AdminBugsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  const { status: statusParam, page: pageParam } = await searchParams
  const statusFilter = statusParam || null
  const page = parsePage(pageParam)
  const { from, to } = pageRange(page)

  const service = createServiceClient()

  let listQuery = service
    .from('bug_reports')
    .select(
      'id, created_at, user_id, idea_id, report_id, report_tab, description, screenshot_path, browser_info, page_url, status, admin_notes',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
  if (statusFilter) listQuery = listQuery.eq('status', statusFilter as BugReportStatus)
  const { data: rows, count, error } = await listQuery.range(from, to)

  // Postgres 42P01 and PostgREST's PGRST205 ("table not found in schema
  // cache") both mean migration 018 hasn't been run yet — same pattern as
  // /app/admin/contact.
  const migrationMissing = error?.code === '42P01' || error?.code === 'PGRST205'

  // Signed URLs for any attached screenshots — generated here (server side,
  // service client) rather than exposed as a general API, since only the
  // admin queue ever needs to view them. Short-lived (1hr).
  const reports: BugRow[] = []
  for (const row of rows ?? []) {
    let screenshotUrl: string | null = null
    if (row.screenshot_path) {
      const { data: signed } = await service.storage
        .from('bug-screenshots')
        .createSignedUrl(row.screenshot_path, 3600)
      screenshotUrl = signed?.signedUrl ?? null
    }
    reports.push({ ...row, screenshot_url: screenshotUrl })
  }

  const totalCount = count ?? 0
  const pages = totalPageCount(totalCount)

  return (
    <div>
      <MarkSeen section="bugs" />
      <h1 className="text-2xl font-semibold text-white light:text-gray-900 mb-1">Bugs</h1>
      <p className="text-sm text-slate-400 light:text-gray-500 mb-8 max-w-2xl">
        Bugs flagged by users from inside their reports, with auto-captured context and an
        optional screenshot.
      </p>

      {migrationMissing ? (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 light:bg-amber-50 light:border-amber-200 px-5 py-5">
          <p className="text-sm font-semibold text-amber-200 light:text-amber-900 mb-1">
            Bug reports table not found
          </p>
          <p className="text-sm text-amber-100/90 light:text-amber-800">
            Run <code className="rounded bg-black/20 light:bg-amber-100 px-1.5 py-0.5">supabase/migrations/018_bug_reports.sql</code> in
            the Supabase SQL editor, then reload this page. The in-report bug widget shows a
            friendly error in the meantime instead of crashing.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-xs text-slate-500 light:text-gray-400">Status:</span>
            <Link
              href="/app/admin/bugs"
              className={`text-xs px-2.5 py-1 rounded-full border ${
                !statusFilter
                  ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30 light:bg-indigo-100 light:text-indigo-700 light:border-indigo-200'
                  : 'bg-white/5 text-slate-400 border-white/10 light:bg-gray-50 light:text-gray-500 light:border-gray-200'
              }`}
            >
              All
            </Link>
            {STATUSES.map(st => (
              <Link
                key={st}
                href={`/app/admin/bugs?status=${encodeURIComponent(st)}`}
                className={`text-xs px-2.5 py-1 rounded-full border capitalize ${
                  statusFilter === st
                    ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30 light:bg-indigo-100 light:text-indigo-700 light:border-indigo-200'
                    : 'bg-white/5 text-slate-400 border-white/10 light:bg-gray-50 light:text-gray-500 light:border-gray-200'
                }`}
              >
                {st}
              </Link>
            ))}
          </div>

          <BugQueueList rows={reports} />

          {totalCount > ADMIN_PAGE_SIZE && (
            <Pagination
              page={page}
              totalPages={pages}
              totalCount={totalCount}
              basePath="/app/admin/bugs"
              searchParams={{ status: statusParam }}
              className="mt-2"
            />
          )}
        </>
      )}
    </div>
  )
}
