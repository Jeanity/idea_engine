import Link from 'next/link'
import { createServiceClient } from '@/lib/db'
import { ARCHETYPE_LABELS } from '@/lib/archetype-labels'
import { FeatureToggle } from './feature-toggle'

export const metadata = { title: 'Feedback — Admin — Idea Engine' }

// This page lives under src/app/app/admin/, whose layout.tsx already gates
// on isAdminEmail (redirects non-admins to /app before this ever renders).
// Reading other users' data via createServiceClient here is safe BECAUSE
// that gate already ran — never fetch with the service client before it.

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(i => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          className={`h-3.5 w-3.5 ${i <= rating ? 'fill-amber-400' : 'fill-white/10 light:fill-gray-200'}`}
        >
          <path d="M10 1.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L1.6 7.6l5.8-.8z" />
        </svg>
      ))}
    </span>
  )
}

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ rating?: string }>
}) {
  const { rating: ratingParam } = await searchParams
  const ratingFilter = ratingParam ? Number(ratingParam) : null

  const service = createServiceClient()

  const { data: feedback } = await service
    .from('report_feedback')
    .select('id, report_id, user_id, rating, comment, allow_public, featured, created_at')
    .order('created_at', { ascending: false })

  const rows = feedback ?? []

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
      displayName: profile?.display_name ?? profile?.username ?? 'Unknown user',
    }
  })

  const average = rows.length
    ? rows.reduce((sum, r) => sum + r.rating, 0) / rows.length
    : null

  const histogram = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: rows.filter(r => r.rating === star).length,
  }))
  const maxCount = Math.max(1, ...histogram.map(h => h.count))

  const visible = ratingFilter
    ? enriched.filter(fb => fb.rating === ratingFilter)
    : enriched

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white light:text-gray-900 mb-1">Feedback</h1>
      <p className="text-sm text-slate-400 light:text-gray-500 mb-8">
        Ratings and comments left by users on their reports. Featured + consented feedback appears on the homepage.
      </p>

      {/* Stats: average + histogram */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm px-5 py-5">
          <p className="text-xs text-slate-500 light:text-gray-400 mb-1">Average rating</p>
          <p className="text-3xl font-bold text-white light:text-gray-900">
            {average !== null ? average.toFixed(2) : '—'}
          </p>
          <p className="text-xs text-slate-500 light:text-gray-400 mt-1">{rows.length} response{rows.length === 1 ? '' : 's'}</p>
        </div>

        <div className="sm:col-span-2 rounded-2xl border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm px-5 py-5">
          <p className="text-xs text-slate-500 light:text-gray-400 mb-3">Ratings distribution</p>
          <div className="space-y-1.5">
            {histogram.map(({ star, count }) => (
              <div key={star} className="flex items-center gap-3">
                <span className="w-10 text-xs text-slate-400 light:text-gray-500 flex-shrink-0">{star}★</span>
                <div className="flex-1 h-2.5 rounded-full bg-white/5 light:bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-400"
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="w-6 text-right text-xs text-slate-400 light:text-gray-500 flex-shrink-0">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 mb-4">
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

      {/* List */}
      {visible.length === 0 ? (
        <p className="text-sm text-slate-500 light:text-gray-400 py-8 text-center">No feedback yet.</p>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm divide-y divide-white/10 light:divide-gray-100 overflow-hidden">
          {visible.map(fb => (
            <div key={fb.id} className="px-5 py-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Stars rating={fb.rating} />
                  <span className="text-sm font-medium text-slate-200 light:text-gray-800">{fb.displayName}</span>
                  {fb.archetypeLabel && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-400 light:bg-gray-100 light:text-gray-600">
                      {fb.archetypeLabel}
                    </span>
                  )}
                  {fb.allow_public && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 light:bg-emerald-50 light:text-emerald-700">
                      Consented
                    </span>
                  )}
                </div>
                {fb.comment && (
                  <p className="text-sm text-slate-400 light:text-gray-500 leading-relaxed">{fb.comment}</p>
                )}
                <p className="text-xs text-slate-600 light:text-gray-400 mt-1">
                  {new Date(fb.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex-shrink-0">
                <FeatureToggle feedbackId={fb.id} allowPublic={fb.allow_public} initialFeatured={fb.featured} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
