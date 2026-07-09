import Link from 'next/link'
import { createServiceClient } from '@/lib/db'
import { ARCHETYPE_LABELS } from '@/lib/archetype-labels'
import { Pagination } from '@/components/admin'
import { ADMIN_PAGE_SIZE, pageRange, parsePage, totalPageCount } from '@/lib/admin-pagination'
import { FeedbackCards } from './feedback-cards'

export const metadata = { title: 'Feedback — Admin — Idea Engine' }

// This page lives under src/app/app/admin/, whose layout.tsx already gates
// on isAdminEmail (redirects non-admins to /app before this ever renders).
// Reading other users' data via createServiceClient here is safe BECAUSE
// that gate already ran — never fetch with the service client before it.

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ rating?: string; page?: string }>
}) {
  const { rating: ratingParam, page: pageParam } = await searchParams
  const ratingFilter = ratingParam ? Number(ratingParam) : null
  const page = parsePage(pageParam)
  const { from, to } = pageRange(page)

  const service = createServiceClient()

  // Stats (average + histogram) are computed over ALL feedback regardless of
  // the rating filter or current page — a single-column select keeps this
  // cheap even as the table grows past what we'd want to paginate.
  const { data: allRatings } = await service.from('report_feedback').select('rating')
  const ratingRows = allRatings ?? []

  let listQuery = service
    .from('report_feedback')
    .select('id, report_id, user_id, rating, comment, allow_public, featured, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
  if (ratingFilter) listQuery = listQuery.eq('rating', ratingFilter)
  const { data: feedback, count } = await listQuery.range(from, to)

  const rows = feedback ?? []
  const totalCount = count ?? 0
  const pages = totalPageCount(totalCount)

  const reportIds = [...new Set(rows.map(r => r.report_id))]
  const userIds = [...new Set(rows.map(r => r.user_id))]

  const [{ data: reports }, { data: profiles }] = await Promise.all([
    reportIds.length
      ? service.from('reports').select('id, idea_id').in('id', reportIds)
      : Promise.resolve({ data: [] as { id: string; idea_id: string }[] }),
    userIds.length
      ? service.from('profiles').select('id, display_name, username').in('id', userIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string | null; username: string | null }[] }),
  ])

  const ideaIds = [...new Set((reports ?? []).map(r => r.idea_id))]
  const { data: ideas } = ideaIds.length
    ? await service.from('ideas').select('id, archetype').in('id', ideaIds)
    : { data: [] as { id: string; archetype: string }[] }

  const reportToIdea = new Map((reports ?? []).map(r => [r.id, r.idea_id]))
  const ideaToArchetype = new Map((ideas ?? []).map(i => [i.id, i.archetype]))
  const profileById = new Map((profiles ?? []).map(p => [p.id, p]))

  const enriched = rows.map(fb => {
    const ideaId = reportToIdea.get(fb.report_id)
    const archetype = ideaId ? ideaToArchetype.get(ideaId) : undefined
    const profile = profileById.get(fb.user_id)
    return {
      ...fb,
      archetypeLabel: archetype ? (ARCHETYPE_LABELS[archetype] ?? archetype) : null,
      displayName: profile?.username ?? profile?.display_name ?? 'Unknown user',
    }
  })

  const average = ratingRows.length
    ? ratingRows.reduce((sum, r) => sum + r.rating, 0) / ratingRows.length
    : null

  const histogram = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: ratingRows.filter(r => r.rating === star).length,
  }))
  const maxCount = Math.max(1, ...histogram.map(h => h.count))

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white light:text-gray-900 mb-1">Feedback</h1>
      <p className="text-sm text-slate-400 light:text-gray-500 mb-8">
        Ratings and comments left by users on their reports. Featured + consented feedback appears on the homepage.
      </p>

      {/* Stats: average + histogram */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <div className="rounded-lg border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm px-5 py-5">
          <p className="text-xs text-slate-500 light:text-gray-400 mb-1">Average rating</p>
          <p className="text-3xl font-bold text-white light:text-gray-900">
            {average !== null ? average.toFixed(2) : '—'}
          </p>
          <p className="text-xs text-slate-500 light:text-gray-400 mt-1">{ratingRows.length} response{ratingRows.length === 1 ? '' : 's'}</p>
        </div>

        <div className="sm:col-span-2 rounded-lg border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm px-5 py-5">
          <p className="text-xs text-slate-500 light:text-gray-400 mb-3">Ratings distribution</p>
          <div className="space-y-1.5">
            {histogram.map(({ star, count: c }) => (
              <div key={star} className="flex items-center gap-3">
                <span className="w-10 text-xs text-slate-400 light:text-gray-500 flex-shrink-0">{star}★</span>
                <div className="flex-1 h-2.5 rounded-full bg-white/5 light:bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-400"
                    style={{ width: `${(c / maxCount) * 100}%` }}
                  />
                </div>
                <span className="w-6 text-right text-xs text-slate-400 light:text-gray-500 flex-shrink-0">{c}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rating filter */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-xs text-slate-500 light:text-gray-400">Filter:</span>
        <Link
          href="/app/admin/feedback"
          className={`text-xs px-2.5 py-1 rounded-full border ${
            !ratingFilter
              ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30 light:bg-indigo-100 light:text-indigo-700 light:border-indigo-200'
              : 'bg-white/5 text-slate-400 border-white/10 light:bg-gray-50 light:text-gray-500 light:border-gray-200'
          }`}
        >
          All
        </Link>
        {[5, 4, 3, 2, 1].map(star => (
          <Link
            key={star}
            href={`/app/admin/feedback?rating=${star}`}
            className={`text-xs px-2.5 py-1 rounded-full border ${
              ratingFilter === star
                ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30 light:bg-indigo-100 light:text-indigo-700 light:border-indigo-200'
                : 'bg-white/5 text-slate-400 border-white/10 light:bg-gray-50 light:text-gray-500 light:border-gray-200'
            }`}
          >
            {star}★
          </Link>
        ))}
      </div>

      {/* Cards */}
      <FeedbackCards entries={enriched} />

      {totalCount > ADMIN_PAGE_SIZE && (
        <div className="mt-6">
          <Pagination
            page={page}
            totalPages={pages}
            totalCount={totalCount}
            basePath="/app/admin/feedback"
            searchParams={{ rating: ratingParam }}
          />
        </div>
      )}
    </div>
  )
}
