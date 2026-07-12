'use client'

import { useCallback, useEffect, useState } from 'react'
import { ScoreRing } from '@/components/score-ring'
import { SampleReportView } from '@/components/sample-report-view'
import { ARCHETYPE_LABELS } from '@/lib/archetype-labels'
import type { CapitalRange } from '@/lib/derived-metrics'

export interface GalleryCard {
  id: string
  title: string
  archetype: string
  restatement: string
  headlineScore: number
}

// The built-in fallback card carries its full sections locally (no fetch);
// DB-backed cards are fetched lazily on click from /api/sample-reports/[id].
export interface FallbackCard extends GalleryCard {
  sections: Record<string, unknown>
  /** The fallback sample's founder capital band for the budget-fit tile.
   *  DB-backed samples never get one — a cloned report's founder band isn't
   *  stored, and borrowing another idea's band would contradict the report text. */
  statedCapital: CapitalRange | null
}

type ModalState =
  | { status: 'closed' }
  | { status: 'loading'; title: string; restatement: string; archetype: string }
  | { status: 'loaded'; title: string; restatement: string; archetype: string; sections: Record<string, unknown>; statedCapital: CapitalRange | null }
  | { status: 'error'; message: string }

function SampleCard({ card, onOpen }: { card: GalleryCard; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="text-left w-full rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-xl shadow-black/20 backdrop-blur transition-transform duration-200 hover:-translate-y-1 hover:shadow-2xl light:border-gray-200 light:bg-white light:shadow-md light:shadow-black/5"
    >
      <span className="inline-flex items-center rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-[11px] font-medium text-indigo-300 light:bg-indigo-100 light:border light:border-indigo-200 light:text-indigo-700">
        {ARCHETYPE_LABELS[card.archetype] ?? card.archetype}
      </span>
      <p className="mt-3 text-sm font-semibold text-white light:text-gray-900">{card.title}</p>
      <p className="mt-1 text-xs text-slate-400 light:text-gray-500 line-clamp-3">{card.restatement}</p>
      <div className="mt-4 flex items-center justify-between">
        <ScoreRing score={card.headlineScore} label="Viability" size={52} />
        <span className="text-xs font-medium text-indigo-300 light:text-indigo-600">View report →</span>
      </div>
    </button>
  )
}

function ReportModal({ state, onClose }: { state: ModalState; onClose: () => void }) {
  useEffect(() => {
    if (state.status === 'closed') return
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [state.status, onClose])

  if (state.status === 'closed') return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm px-4 py-8 sm:py-12"
      onClick={onClose}
    >
      <div
        // Solid, explicit background — deliberately NOT bg-slate-950, which
        // the smexy theme turns translucent (glass). A dialog scrolling over
        // arbitrary page content (including the docked CTA bar) must be
        // fully opaque or the layers bleed into each other and become
        // unreadable.
        className="relative w-full max-w-3xl rounded-2xl border border-white/10 bg-[#09071a] light:bg-gray-50 light:border-gray-200 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 light:bg-white light:text-gray-700 light:hover:bg-gray-100 light:shadow"
        >
          ×
        </button>

        {state.status === 'loading' && (
          <div className="px-6 py-24 text-center">
            <p className="text-sm text-slate-400 light:text-gray-500">Loading report…</p>
          </div>
        )}

        {state.status === 'error' && (
          <div className="px-6 py-24 text-center">
            <p className="text-sm text-red-300 light:text-red-600">{state.message}</p>
          </div>
        )}

        {state.status === 'loaded' && (
          <SampleReportView
            title={state.title}
            restatement={state.restatement}
            archetype={state.archetype}
            sections={state.sections}
            statedCapital={state.statedCapital}
          />
        )}
      </div>
    </div>
  )
}

export function SampleGallery({ cards, fallback }: { cards: GalleryCard[]; fallback: FallbackCard }) {
  const [modal, setModal] = useState<ModalState>({ status: 'closed' })

  const closeModal = useCallback(() => setModal({ status: 'closed' }), [])

  const displayCards = cards.length > 0 ? cards : [fallback]

  async function openCard(card: GalleryCard) {
    if (card.id === fallback.id) {
      setModal({ status: 'loaded', title: fallback.title, restatement: fallback.restatement, archetype: fallback.archetype, sections: fallback.sections, statedCapital: fallback.statedCapital })
      return
    }
    setModal({ status: 'loading', title: card.title, restatement: card.restatement, archetype: card.archetype })
    try {
      const res = await fetch(`/api/sample-reports/${card.id}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setModal({ status: 'error', message: data.error ?? 'Could not load this sample report.' })
        return
      }
      setModal({ status: 'loaded', title: data.title, restatement: data.restatement, archetype: data.archetype, sections: data.sections, statedCapital: null })
    } catch {
      setModal({ status: 'error', message: 'Could not load this sample report.' })
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {displayCards.map(card => (
          <SampleCard key={card.id} card={card} onOpen={() => openCard(card)} />
        ))}
      </div>
      <ReportModal state={modal} onClose={closeModal} />
    </>
  )
}
