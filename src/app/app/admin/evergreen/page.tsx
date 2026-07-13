import Link from 'next/link'
import { createServiceClient } from '@/lib/db'
import { Pagination } from '@/components/admin'
import { ADMIN_PAGE_SIZE, pageRange, parsePage, totalPageCount } from '@/lib/admin-pagination'
import { ARCHETYPE_LABELS } from '@/lib/archetype-labels'
import type { EvergreenReviewStatus } from '@/lib/database.types'
import { EvergreenList, type EvergreenRow } from './evergreen-list'

export const metadata = { title: 'Evergreen — Admin — HadIdea' }

// This page lives under src/app/app/admin/, whose layout.tsx already gates on
// isAdminEmail (redirects non-admins to /app before this ever renders). Reading
// evergreen_baselines via createServiceClient here is safe BECAUSE that gate
// already ran — never fetch with the service client before it.
//
// migration 030 may not have been run yet in this environment — a 42P01
// (undefined_table) error is expected until Danny runs it, and the page must
// show a friendly notice instead of crashing (same pattern as /app/admin/bugs).
//
// review_status is informational in phase 1 — unreviewed baselines ARE served
// (a first user from a new country can't wait for review). This queue exists
// so Danny can eyeball new entries soon after they appear; there is no
// approval gate on serving.

const STATUSES: EvergreenReviewStatus[] = ['unreviewed', 'approved']

export default async function AdminEvergreenPage({
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
    .from('evergreen_baselines')
    .select(
      'id, created_at, updated_at, country_code, region, archetype, section, items, review_status, reviewed_at, generated_by_model, generation_cost_usd, source_report_id, expires_at',
      { count: 'exact' }
    )
    .order('updated_at', { ascending: false })
  if (statusFilter) listQuery = listQuery.eq('review_status', statusFilter as EvergreenReviewStatus)
  const { data: rows, count, error } = await listQuery.range(from, to)

  // Postgres 42P01 and PostgREST's PGRST205 ("table not found in schema
  // cache") both mean migration 030 hasn't been run yet — same pattern as
  // /app/admin/bugs.
  const migrationMissing = error?.code === '42P01' || error?.code === 'PGRST205'

  const evergreenRows: EvergreenRow[] = (rows ?? []).map(row => ({
    ...row,
    items: (Array.isArray(row.items) ? row.items : []) as unknown as EvergreenRow['items'],
  }))

  const totalCount = count ?? 0
  const pages = totalPageCount(totalCount)

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white light:text-gray-900 mb-1">Evergreen baselines</h1>
      <p className="text-sm text-slate-400 light:text-gray-500 mb-8 max-w-2xl">
        Self-populating country x archetype compliance research. The first report from a new
        country x archetype pays for a one-time baseline; every later report reuses it for
        free. Unreviewed entries are already being served — this queue is for eyeballing new
        ones, not gating them.
      </p>

      {migrationMissing ? (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 light:bg-amber-50 light:border-amber-200 px-5 py-5">
          <p className="text-sm font-semibold text-amber-200 light:text-amber-900 mb-1">
            Evergreen baselines table not found
          </p>
          <p className="text-sm text-amber-100/90 light:text-amber-800">
            Run <code className="rounded bg-black/20 light:bg-amber-100 px-1.5 py-0.5">supabase/migrations/030_evergreen_baselines.sql</code> in
            the Supabase SQL editor, then reload this page. Report generation behaves exactly
            as before this migration exists in the meantime — no evergreen caching, no errors.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-xs text-slate-500 light:text-gray-400">Status:</span>
            <Link
              href="/app/admin/evergreen"
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
                href={`/app/admin/evergreen?status=${encodeURIComponent(st)}`}
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

          <EvergreenList rows={evergreenRows} archetypeLabels={ARCHETYPE_LABELS} />

          {totalCount > ADMIN_PAGE_SIZE && (
            <Pagination
              page={page}
              totalPages={pages}
              totalCount={totalCount}
              basePath="/app/admin/evergreen"
              searchParams={{ status: statusParam }}
              className="mt-2"
            />
          )}
        </>
      )}
    </div>
  )
}
