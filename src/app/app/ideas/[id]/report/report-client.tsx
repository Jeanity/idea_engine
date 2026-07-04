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
  // Teaser lives in preview_sections; full report (post-payment) will be in sections
  const p = report.preview_sections
  const summary = p.summary as { text: string } | undefined
  const vs = p.viability_snapshot as {
    scores: Record<string, { score: number; rationale: string }>
    overall_verdict: string
  } | undefined
  const nextStepsPreview = (p.next_steps_preview ?? []) as Array<{ action: string; timeframe: string }>

  const labels: Record<string, string> = {
    market_opportunity: 'Market opportunity',
    execution_difficulty: 'Execution difficulty',
    capital_required: 'Capital required',
    time_to_revenue: 'Time to revenue',
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-6 print:py-4">

      {/* Summary */}
      {summary?.text ? (
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-5">
          <h2 className="font-semibold text-gray-900 mb-3">Summary</h2>
          <p className="text-sm text-gray-700 leading-relaxed">{summary.text}</p>
        </div>
      ) : <UnavailableSection title="Summary" />}

      {/* Viability snapshot */}
      {vs?.scores ? (
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-5">
          <h2 className="font-semibold text-gray-900 mb-4">Viability Snapshot</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {Object.entries(vs.scores).map(([key, val]) => (
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
      ) : <UnavailableSection title="Viability Snapshot" />}

      {/* Next steps teaser */}
      {nextStepsPreview.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Where to start</h2>
            <p className="text-xs text-gray-400 mt-0.5">2 of your personalised next steps</p>
          </div>
          <div className="divide-y divide-gray-100">
            {nextStepsPreview.map((step, i) => (
              <div key={i} className="px-5 py-3 flex gap-3 items-baseline">
                <span className="flex-shrink-0 text-xs font-semibold text-indigo-600">{step.timeframe}</span>
                <p className="text-sm text-gray-800">{step.action}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Locked sections */}
      <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-5 py-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Included in full report</p>
        <ul className="space-y-2 text-sm text-gray-500">
          {[
            '5–8 real competitors with pricing and gap analysis',
            'Cost breakdown — materials, labour, power, margin',
            'Pricing strategy with comparable market rates',
            'Legal & compliance checklist with official source links',
            'Risk register with mitigations',
            'Complete prioritised next steps',
          ].map(item => (
            <li key={item} className="flex gap-2 items-start">
              <svg className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
              {item}
            </li>
          ))}
        </ul>
        <button className="mt-5 w-full rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
          Unlock full report — coming soon
        </button>
      </div>

    </div>
  )
}

// ── Main client component ─────────────────────────────────────

function RegenerateButton({ ideaId, onStart }: { ideaId: string; onStart: () => void }) {
  const [loading, setLoading] = useState(false)

  async function handleRegenerate() {
    setLoading(true)
    try {
      await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea_id: ideaId, force: true }),
      })
      onStart()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleRegenerate}
      disabled={loading}
      className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-40 underline underline-offset-2"
    >
      {loading ? 'Starting…' : 'Regenerate report'}
    </button>
  )
}

export default function ReportClient({ ideaId, restatement, archetype: _archetype, initialReport }: Props) {
  const [report, setReport] = useState<ReportData | null>(initialReport)
  const [regenerating, setRegenerating] = useState(false)

  if (report?.status === 'complete' && !regenerating) {
    return (
      <div>
        <ReportViewer report={report} />
        <div className="max-w-3xl mx-auto px-6 pb-6 text-center print:hidden">
          <RegenerateButton ideaId={ideaId} onStart={() => { setRegenerating(true); setReport(null) }} />
        </div>
      </div>
    )
  }

  return (
    <ProgressScreen
      ideaId={ideaId}
      restatement={restatement}
      onComplete={(r) => { setReport(r); setRegenerating(false) }}
    />
  )
}
