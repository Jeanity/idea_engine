import Link from 'next/link'
import { createServiceClient } from '@/lib/db'
import { Pagination, MarkSeen } from '@/components/admin'
import { ADMIN_PAGE_SIZE, pageRange, parsePage, totalPageCount } from '@/lib/admin-pagination'
import { ARCHETYPE_LABELS } from '@/lib/archetype-labels'
import type { EvergreenReviewStatus } from '@/lib/database.types'
import { EvergreenList, type EvergreenRow, type EvergreenUsage } from './evergreen-list'

export const metadata = { title: 'Evergreen — Admin — HadIdea' }

// This page lives under src/app/app/admin/, whose layout.tsx already gates on
// isAdminEmail (redirects non-admins to /app before this ever renders). Reading
// evergreen_baselines via createServiceClient here is safe BECAUSE that gate
// already ran — never fetch with the service client before it.
//
// migration 030 (table) and 031 (disapprove state + usage tagging) may not
// have been run yet in this environment. Pre-030: the whole evergreen_baselines
// table is missing (42P01 / PGRST205). Post-030-but-pre-031: the table exists
// but this query also selects 031's disapproved_at/disapprove_note columns,
// which don't exist yet (42703 undefined_column / PGRST204 "column not found
// in schema cache") — the SELECT fails the same way. Both cases show the same
// friendly notice instead of crashing (same pattern as /app/admin/bugs) —
// there's no meaningful partial-listing mode between the two migrations, and
// the spec has Danny run both before C1 sees prod traffic anyway. A missing
// evergreen_report_usage table (031's OTHER piece) degrades separately and
// more quietly — see the usage-count query below.
//
// review_status is informational for 'unreviewed'/'approved' (phase 1) —
// both ARE served (a first user from a new country can't wait for review).
// 'disapproved' (Workstream C1) is the one status that changes serving — see
// src/lib/evergreen.ts's quad-state lookup.

const STATUSES: EvergreenReviewStatus[] = ['unreviewed', 'approved', 'disapproved']
const STATUS_LABELS: Record<EvergreenReviewStatus, string> = {
  unreviewed: 'New',
  approved: 'Approved',
  disapproved: 'Disapproved',
}

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
      'id, created_at, updated_at, country_code, region, archetype, section, items, review_status, reviewed_at, disapproved_at, disapprove_note, generated_by_model, generation_cost_usd, source_report_id, expires_at',
      { count: 'exact' }
    )
    .order('updated_at', { ascending: false })
  if (statusFilter) listQuery = listQuery.eq('review_status', statusFilter as EvergreenReviewStatus)
  const { data: rows, count, error } = await listQuery.range(from, to)

  // 42P01/PGRST205 ("table not found") = migration 030 not run. 42703/PGRST204
  // ("column not found in schema cache") = 030 is run but 031 isn't, so the
  // disapproved_at/disapprove_note columns this SELECT asks for don't exist
  // yet. Either way: same friendly notice, same "run the migration(s)" story.
  const migrationMissing =
    error?.code === '42P01' || error?.code === 'PGRST205' ||
    error?.code === '42703' || error?.code === 'PGRST204'

  const evergreenRows: EvergreenRow[] = (rows ?? []).map(row => ({
    ...row,
    items: (Array.isArray(row.items) ? row.items : []) as unknown as EvergreenRow['items'],
  }))

  // Per-row usage counts (migration 031): "N reports on this version (M
  // before approval)". N = usage rows whose evergreen_updated_at matches this
  // row's CURRENT updated_at (an older/superseded revision's usage doesn't
  // count against the live row); M = the subset of those with
  // approved_at_use = false. One query for every row on this page, grouped in
  // JS rather than N queries. The table may not exist yet (031 not run) —
  // that's a quiet degrade to zero counts, not a page-level notice, since
  // 030 (the table this page fundamentally depends on) is the one that gets
  // the loud banner above.
  const usageByRow: Record<string, EvergreenUsage> = {}
  const ids = evergreenRows.map(r => r.id)
  if (ids.length > 0) {
    const { data: usageRows, error: usageError } = await service
      .from('evergreen_report_usage')
      .select('evergreen_id, evergreen_updated_at, approved_at_use')
      .in('evergreen_id', ids)

    if (!usageError && usageRows) {
      for (const row of evergreenRows) {
        const matches = usageRows.filter(
          u => u.evergreen_id === row.id && u.evergreen_updated_at === row.updated_at
        )
        usageByRow[row.id] = {
          total: matches.length,
          beforeApproval: matches.filter(m => !m.approved_at_use).length,
        }
      }
    }
    // usageError (including a missing table, 42P01/PGRST205) leaves
    // usageByRow empty for the affected rows — EvergreenList treats a
    // missing entry as { total: 0, beforeApproval: 0 }.
  }

  const totalCount = count ?? 0
  const pages = totalPageCount(totalCount)

  return (
    <div>
      <MarkSeen section="evergreen" />
      <h1 className="text-2xl font-semibold text-white light:text-gray-900 mb-1">Evergreen baselines</h1>
      <p className="text-sm text-slate-400 light:text-gray-500 mb-8 max-w-2xl">
        Self-populating country x archetype compliance research. The first report from a new
        country x archetype pays for a one-time baseline; every later report reuses it for
        free. New and Approved entries are both already being served — this queue is for
        eyeballing new ones and disapproving anything wrong.
      </p>

      {migrationMissing ? (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 light:bg-amber-50 light:border-amber-200 px-5 py-5">
          <p className="text-sm font-semibold text-amber-200 light:text-amber-900 mb-1">
            Evergreen baselines table not found
          </p>
          <p className="text-sm text-amber-100/90 light:text-amber-800">
            Run <code className="rounded bg-black/20 light:bg-amber-100 px-1.5 py-0.5">supabase/migrations/030_evergreen_baselines.sql</code> and{' '}
            <code className="rounded bg-black/20 light:bg-amber-100 px-1.5 py-0.5">supabase/migrations/031_evergreen_lifecycle.sql</code> in
            the Supabase SQL editor, then reload this page. Report generation behaves exactly
            as before these migrations exist in the meantime — no evergreen caching, no errors.
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
                className={`text-xs px-2.5 py-1 rounded-full border ${
                  statusFilter === st
                    ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30 light:bg-indigo-100 light:text-indigo-700 light:border-indigo-200'
                    : 'bg-white/5 text-slate-400 border-white/10 light:bg-gray-50 light:text-gray-500 light:border-gray-200'
                }`}
              >
                {STATUS_LABELS[st]}
              </Link>
            ))}
          </div>

          <EvergreenList rows={evergreenRows} archetypeLabels={ARCHETYPE_LABELS} usageByRow={usageByRow} />

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
