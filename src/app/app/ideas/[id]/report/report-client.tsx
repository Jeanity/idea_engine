'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface ReportData {
  id: string
  status: string
  sections: Record<string, unknown>
  preview_sections: Record<string, unknown>
  error: string | null
}

interface Props {
  ideaId: string
  restatement: string | null
  archetype: string
  initialReport: ReportData | null
}

// ── Progress screen ───────────────────────────────────────────

const STEPS = [
  { key: 'competitors', label: 'Researching competitors' },
  { key: 'cost_breakdown', label: 'Crunching your numbers' },
  { key: 'legal_compliance', label: 'Checking compliance' },
  { key: 'summary', label: 'Writing your report' },
]

function ProgressScreen({ ideaId, restatement, onComplete }: {
  ideaId: string
  restatement: string | null
  onComplete: (report: ReportData) => void
}) {
  const [report, setReport] = useState<ReportData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const triggerGeneration = useCallback(async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea_id: ideaId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to start report generation')
      setReport(prev => prev ?? { id: data.reportId, status: data.status, sections: {}, preview_sections: {}, error: null })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start generation')
    } finally {
      setGenerating(false)
    }
  }, [ideaId])

  // Start generation on mount if no report
  useEffect(() => {
    triggerGeneration()
  }, [triggerGeneration])

  // Poll for updates
  useEffect(() => {
    if (!report || report.status === 'complete' || report.status === 'failed') return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/reports?idea_id=${ideaId}`)
        const data = await res.json()
        if (data.report) {
          setReport(data.report)
          if (data.report.status === 'complete') {
            clearInterval(interval)
            onComplete(data.report)
          }
        }
      } catch {
        // poll failure is non-fatal
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [report, ideaId, onComplete])

  const sections = report?.sections ?? {}
  const completedKeys = Object.keys(sections)

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <p className="text-red-600 text-sm mb-4">{error}</p>
        <button
          onClick={() => { setError(null); triggerGeneration() }}
          className="text-sm text-indigo-600 hover:underline"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-100 mb-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Generating your report</h1>
        {restatement && <p className="text-sm text-gray-500">{restatement}</p>}
      </div>

      <div className="space-y-3">
        {STEPS.map(({ key, label }, i) => {
          const done = completedKeys.includes(key)
          const active = !done && (i === 0 || completedKeys.includes(STEPS[i - 1]?.key ?? ''))
          return (
            <div key={key} className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors
              ${done ? 'border-green-200 bg-green-50' : active ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200 bg-white'}`}>
              <span className={`flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-xs
                ${done ? 'bg-green-500 text-white' : active ? 'bg-indigo-500' : 'bg-gray-200'}`}>
                {done ? '✓' : active ? (
                  <span className="h-2.5 w-2.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : ''}
              </span>
              <span className={`text-sm ${done ? 'text-green-700' : active ? 'text-indigo-700 font-medium' : 'text-gray-400'}`}>
                {label}{done ? '…done' : active ? '…' : ''}
              </span>
            </div>
          )
        })}
      </div>

      {!generating && !report && (
        <p className="text-center text-xs text-gray-400 mt-6">Starting up…</p>
      )}
      <p className="text-center text-xs text-gray-400 mt-4">This usually takes 1–3 minutes.</p>
    </div>
  )
}

// ── Report viewer ─────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= score ? 'bg-indigo-500' : 'bg-gray-200'}`} />
      ))}
    </div>
  )
}

function LockedSection({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
          Unlock to view
        </span>
      </div>
      <div className="px-5 py-4 blur-sm select-none pointer-events-none" aria-hidden>
        <div className="space-y-2">
          <div className="h-3 bg-gray-200 rounded w-full" />
          <div className="h-3 bg-gray-200 rounded w-5/6" />
          <div className="h-3 bg-gray-200 rounded w-4/6" />
          <div className="h-3 bg-gray-200 rounded w-5/6 mt-2" />
          <div className="h-3 bg-gray-200 rounded w-3/6" />
        </div>
      </div>
    </div>
  )
}

function UnavailableSection({ title, reason }: { title: string; reason?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
      <h2 className="font-semibold text-gray-900 mb-1">{title}</h2>
      <p className="text-sm text-gray-400">{reason ?? 'This section was unavailable.'}</p>
    </div>
  )
}

function isUnavailable(v: unknown): v is { status: 'unavailable'; reason: string } {
  return typeof v === 'object' && v !== null && (v as Record<string, unknown>).status === 'unavailable'
}

function ReportViewer({ report }: { report: ReportData }) {
  const s = report.sections
  const p = report.preview_sections

  // Use preview for free tier; full sections locked (visual only in Phase 4)
  const competitors = (p.competitors ?? []) as Array<Record<string, unknown>>
  const allCompetitors = Array.isArray(s.competitors) ? s.competitors as Array<Record<string, unknown>> : []
  const hasMoreCompetitors = allCompetitors.length > 2

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-6 print:py-4">
      {/* Summary */}
      {isUnavailable(s.summary)
        ? <UnavailableSection title="Summary" reason={(s.summary as {reason: string}).reason} />
        : (
          <div className="rounded-xl border border-gray-200 bg-white px-5 py-5">
            <h2 className="font-semibold text-gray-900 mb-3">Summary</h2>
            <p className="text-sm text-gray-700 leading-relaxed">{(s.summary as {text: string})?.text}</p>
          </div>
        )}

      {/* Viability snapshot */}
      {isUnavailable(s.viability_snapshot)
        ? <UnavailableSection title="Viability Snapshot" />
        : (() => {
            const vs = s.viability_snapshot as {
              scores: Record<string, { score: number; rationale: string }>
              overall_verdict: string
            }
            const labels: Record<string, string> = {
              market_opportunity: 'Market opportunity',
              execution_difficulty: 'Execution difficulty',
              capital_required: 'Capital required',
              time_to_revenue: 'Time to revenue',
            }
            return (
              <div className="rounded-xl border border-gray-200 bg-white px-5 py-5">
                <h2 className="font-semibold text-gray-900 mb-4">Viability Snapshot</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  {Object.entries(vs.scores ?? {}).map(([key, val]) => (
                    <div key={key}>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{labels[key] ?? key}</span>
                        <span className="font-medium text-gray-700">{val.score}/5</span>
                      </div>
                      <ScoreBar score={val.score} />
                      <p className="text-xs text-gray-500 mt-1">{val.rationale}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-3">
                  <p className="text-sm text-indigo-900">{vs.overall_verdict}</p>
                </div>
              </div>
            )
          })()}

      {/* Competitors — preview shows 2, rest locked */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Competitors</h2>
        </div>
        {isUnavailable(s.competitors) ? (
          <div className="px-5 py-4">
            <p className="text-sm text-gray-400">{(s.competitors as {reason: string}).reason}</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-100">
              {competitors.map((c, i) => (
                <div key={i} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <a href={c.url as string} target="_blank" rel="noopener noreferrer"
                        className="text-sm font-medium text-indigo-600 hover:underline">
                        {c.name as string}
                      </a>
                      <p className="text-xs text-gray-500 mt-0.5">{c.location as string} · {c.pricing_summary as string}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {hasMoreCompetitors && <LockedSection title={`+${allCompetitors.length - 2} more competitors with gap analysis`} />}
          </>
        )}
      </div>

      {/* Locked sections */}
      <LockedSection title="Cost Breakdown" />
      <LockedSection title="Pricing Recommendation" />
      <LockedSection title="Legal & Compliance" />
      <LockedSection title="Risks" />

      {/* Next steps — preview shows 2 */}
      {Array.isArray(p.next_steps) && p.next_steps.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Next Steps (preview)</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {(p.next_steps as Array<Record<string, unknown>>).map((step, i) => (
              <div key={i} className="px-5 py-4">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 text-xs font-bold text-indigo-600 mt-0.5">{step.timeframe as string}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{step.action as string}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{step.rationale as string}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <LockedSection title="Full next steps + full report" />
        </div>
      )}

      <div className="pt-4 pb-8 text-center print:hidden">
        <p className="text-sm text-gray-500 mb-3">Unlock the full report to see all competitor gap analysis, cost breakdown, pricing strategy, compliance checklist, and complete next steps.</p>
        <button className="inline-flex items-center rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
          Unlock full report — coming in Phase 5
        </button>
      </div>
    </div>
  )
}

// ── Main client component ─────────────────────────────────────

export default function ReportClient({ ideaId, restatement, archetype: _archetype, initialReport }: Props) {
  const [report, setReport] = useState<ReportData | null>(initialReport)

  if (report?.status === 'complete') {
    return <ReportViewer report={report} />
  }

  return (
    <ProgressScreen
      ideaId={ideaId}
      restatement={restatement}
      onComplete={setReport}
    />
  )
}
