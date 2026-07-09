'use client'

import { useMemo, useState } from 'react'
import { FeatureToggle } from './feature-toggle'

interface FeedbackEntry {
  id: string
  rating: number
  comment: string | null
  allow_public: boolean
  featured: boolean
  created_at: string
  archetypeLabel: string | null
  displayName: string
}

type SortKey = 'date' | 'rating' | 'type'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'rating', label: 'Rating' },
  { key: 'type', label: 'Idea type' },
]

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

const pillClass = (active: boolean) =>
  `text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
    active
      ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30 light:bg-indigo-100 light:text-indigo-700 light:border-indigo-200'
      : 'bg-white/5 text-slate-400 border-white/10 hover:text-white light:bg-gray-50 light:text-gray-500 light:border-gray-200 light:hover:text-gray-900'
  }`

export function FeedbackCards({ entries }: { entries: FeedbackEntry[] }) {
  const [sortBy, setSortBy] = useState<SortKey>('date')

  const sorted = useMemo(() => {
    const copy = [...entries]
    switch (sortBy) {
      case 'date':
        copy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        break
      case 'rating':
        copy.sort((a, b) => b.rating - a.rating || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        break
      case 'type':
        copy.sort((a, b) => (a.archetypeLabel ?? '').localeCompare(b.archetypeLabel ?? '') || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        break
    }
    return copy
  }, [entries, sortBy])

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-xs text-slate-500 light:text-gray-400">Sort:</span>
        {SORT_OPTIONS.map(opt => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setSortBy(opt.key)}
            className={pillClass(sortBy === opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-slate-500 light:text-gray-400 py-8 text-center">No feedback yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map(fb => (
            <div
              key={fb.id}
              className={`rounded-lg border bg-slate-900/80 light:bg-white light:shadow-sm p-5 flex flex-col gap-3 ${
                fb.featured
                  ? 'border-emerald-500/30 light:border-emerald-200'
                  : 'border-white/10 light:border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <Stars rating={fb.rating} />
                <span className="text-[11px] text-slate-500 light:text-gray-400 shrink-0">
                  {new Date(fb.created_at).toLocaleDateString()}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-slate-200 light:text-gray-800 truncate">
                  {fb.displayName}
                </span>
                {fb.archetypeLabel && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-slate-400 light:bg-gray-100 light:text-gray-600">
                    {fb.archetypeLabel}
                  </span>
                )}
              </div>

              {fb.comment && (
                <p className="text-sm text-slate-400 light:text-gray-500 leading-relaxed line-clamp-4 flex-1">
                  {fb.comment}
                </p>
              )}

              <div className="flex items-center justify-between gap-2 mt-auto pt-1">
                <div className="flex items-center gap-1.5">
                  {fb.allow_public && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 light:bg-emerald-50 light:text-emerald-700">
                      Consented
                    </span>
                  )}
                </div>
                <FeatureToggle feedbackId={fb.id} allowPublic={fb.allow_public} initialFeatured={fb.featured} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
