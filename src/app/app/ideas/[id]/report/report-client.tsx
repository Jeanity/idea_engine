'use client'

import { useState, useEffect, useCallback } from 'react'

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
  isAdmin: boolean
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

  useEffect(() => {
    triggerGeneration()
  }, [triggerGeneration])

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

  const completedKeys = Object.keys(report?.sections ?? {})

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

// ── Shared helpers ────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= score ? 'bg-indigo-500' : 'bg-gray-200'}`} />
      ))}
    </div>
  )
}

function isUnavailable(v: unknown): v is { status: 'unavailable'; reason: string } {
  return typeof v === 'object' && v !== null && (v as Record<string, unknown>).status === 'unavailable'
}

function UnavailableSection({ title, reason }: { title: string; reason?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
      <h2 className="font-semibold text-gray-900 mb-1">{title}</h2>
      <p className="text-sm text-gray-400">{reason ?? 'This section was unavailable.'}</p>
    </div>
  )
}

const SCORE_LABELS: Record<string, string> = {
  market_opportunity: 'Market opportunity',
  execution_difficulty: 'Execution difficulty',
  capital_required: 'Capital required',
  time_to_revenue: 'Time to revenue',
}

function ViabilitySnapshot({ vs }: {
  vs: { scores: Record<string, { score: number; rationale: string }>; overall_verdict: string }
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-5">
      <h2 className="font-semibold text-gray-900 mb-4">Viability Snapshot</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {Object.entries(vs.scores).map(([key, val]) => (
          <div key={key}>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{SCORE_LABELS[key] ?? key}</span>
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
}

// ── Teaser viewer ─────────────────────────────────────────────

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

function TeaserViewer({ report, ideaId, isAdmin, onGenerateFull }: {
  report: ReportData
  ideaId: string
  isAdmin: boolean
  onGenerateFull: () => void
}) {
  const p = report.preview_sections
  const summary = p.summary as { text: string } | undefined
  const vs = p.viability_snapshot as {
    scores: Record<string, { score: number; rationale: string }>
    overall_verdict: string
  } | undefined
  const nextStepsPreview = (p.next_steps ?? []) as Array<{ action: string; timeframe: string }>

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-6 print:py-4">

      {summary?.text ? (
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-5">
          <h2 className="font-semibold text-gray-900 mb-3">Summary</h2>
          <p className="text-sm text-gray-700 leading-relaxed">{summary.text}</p>
        </div>
      ) : <UnavailableSection title="Summary" />}

      {vs?.scores ? <ViabilitySnapshot vs={vs} /> : <UnavailableSection title="Viability Snapshot" />}

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

      {isAdmin && (
        <GenerateFullReportButton ideaId={ideaId} onStart={onGenerateFull} />
      )}
    </div>
  )
}

// ── Full report section components ───────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    required: 'bg-red-100 text-red-700',
    recommended: 'bg-yellow-100 text-yellow-700',
    fyi: 'bg-blue-100 text-blue-700',
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[severity] ?? 'bg-gray-100 text-gray-600'}`}>
      {severity}
    </span>
  )
}

function currencySymbol(currency: string) {
  return currency === 'AUD' ? 'A$' : currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$'
}

function fmt(sym: string, n: number) {
  return `${sym}${n.toFixed(2)}`
}

function fmt0(sym: string, n: number) {
  return `${sym}${Math.round(n).toLocaleString()}`
}

const REPORT_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'competitors', label: 'Competitors' },
  { key: 'costs', label: 'Costs & Pricing' },
  { key: 'legal', label: 'Legal & Compliance' },
  { key: 'risks', label: 'Risks & Next Steps' },
] as const

type ReportTabKey = typeof REPORT_TABS[number]['key']

function FullReportViewer({ report }: { report: ReportData }) {
  const s = report.sections
  const [activeTab, setActiveTab] = useState<ReportTabKey>('overview')

  const summary = s.summary
  const vs = s.viability_snapshot as { scores: Record<string, { score: number; rationale: string }>; overall_verdict: string } | undefined
  const competitors = s.competitors
  const costBreakdown = s.cost_breakdown
  const pricing = s.pricing_recommendation
  const compliance = s.legal_compliance
  const risks = s.risks
  const nextSteps = s.next_steps

  const competitorsCount = Array.isArray(competitors) ? competitors.length : null

  function handleTabChange(key: ReportTabKey) {
    setActiveTab(key)
    window.scrollTo({ top: 0 })
  }

  function panelClass(key: ReportTabKey) {
    return activeTab === key ? 'block' : 'hidden print:block'
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 print:py-4">

      {/* Tab bar */}
      <div className="sticky top-0 z-10 bg-gray-50 -mx-6 px-6 mb-6 border-b border-gray-200 overflow-x-auto print:hidden">
        <div className="flex gap-1 whitespace-nowrap">
          {REPORT_TABS.map(tab => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                  ${isActive
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                {tab.label}
                {tab.key === 'competitors' && competitorsCount !== null && (
                  <span className={`ml-1.5 ${isActive ? 'text-indigo-500' : 'text-gray-400'}`}>
                    · {competitorsCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Panel 1: Overview */}
      <div className={`${panelClass('overview')} space-y-6 break-inside-avoid`}>
        {isUnavailable(summary)
          ? <UnavailableSection title="Summary" reason={summary.reason} />
          : summary && (summary as { text: string }).text
            ? (
              <div className="rounded-xl border border-gray-200 bg-white px-5 py-5">
                <h2 className="font-semibold text-gray-900 mb-3">Summary</h2>
                <p className="text-sm text-gray-700 leading-relaxed">{(summary as { text: string }).text}</p>
              </div>
            )
            : <UnavailableSection title="Summary" />}

        {isUnavailable(vs)
          ? <UnavailableSection title="Viability Snapshot" reason={vs.reason} />
          : vs?.scores
            ? <ViabilitySnapshot vs={vs} />
            : <UnavailableSection title="Viability Snapshot" />}
      </div>

      {/* Panel 2: Competitors */}
      <div className={`${panelClass('competitors')} space-y-6 break-inside-avoid`}>
        {isUnavailable(competitors)
          ? <UnavailableSection title="Competitors" reason={competitors.reason} />
          : Array.isArray(competitors) && competitors.length > 0
            ? (
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900">Competitors</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{competitors.length} found</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {(competitors as Array<Record<string, string>>).map((c, i) => (
                    <div key={i} className="px-5 py-4">
                      <div className="mb-2">
                        <div className="min-w-0">
                          <a href={c.url} target="_blank" rel="noopener noreferrer"
                            className="font-medium text-indigo-600 hover:underline text-sm break-words">{c.name}</a>
                          <span className="text-xs text-gray-400 ml-2">{c.location}</span>
                        </div>
                        {c.pricing_summary && (
                          <p className="text-xs font-medium text-gray-700 mt-0.5 break-words">{c.pricing_summary}</p>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        <span className="font-medium text-gray-700">Positioning: </span>{c.positioning_angle}
                      </p>
                      <p className="text-xs text-emerald-700 bg-emerald-50 rounded px-2 py-1.5">
                        <span className="font-medium">Gap: </span>{c.gap_notes}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )
            : <UnavailableSection title="Competitors" />}
      </div>

      {/* Panel 3: Costs & Pricing */}
      <div className={`${panelClass('costs')} space-y-6 break-inside-avoid`}>
        {isUnavailable(costBreakdown)
          ? <UnavailableSection title="Cost Breakdown" reason={costBreakdown.reason} />
          : costBreakdown
            ? (() => {
              const cb = costBreakdown as {
                per_unit: Record<string, number | null> | null
                suggested_price: number | null
                gross_margin_pct: number | null
                currency: string
                notes: string
                estimation_flags: Record<string, string>
                startup_costs?: Array<{ item: string; estimate_low: number; estimate_high: number; note: string }>
                ongoing_costs?: Array<{ item: string; estimate_monthly: number; note: string }>
              }
              const sym = currencySymbol(cb.currency ?? 'USD')
              const lineItems = [
                { key: 'materials', label: 'Materials' },
                { key: 'packaging', label: 'Packaging' },
                { key: 'power', label: 'Power' },
                { key: 'active_labour', label: 'Active labour' },
                { key: 'passive_labour', label: 'Passive labour' },
              ]
              return (
                <div className="rounded-xl border border-gray-200 bg-white px-5 py-5">
                  <h2 className="font-semibold text-gray-900 mb-4">
                    Cost Breakdown <span className="text-xs font-normal text-gray-400">{cb.currency}</span>
                  </h2>
                  {cb.per_unit ? (
                    <>
                      <div className="space-y-2 mb-4">
                        {lineItems.map(({ key, label }) => {
                          const val = cb.per_unit![key]
                          const flag = cb.estimation_flags?.[key]
                          if (flag === 'not_applicable') return null
                          return (
                            <div key={key} className="flex justify-between items-center text-sm">
                              <div className="flex items-center gap-2">
                                <span className="text-gray-600">{label}</span>
                                {flag === 'estimated' && (
                                  <span className="text-xs text-yellow-600 bg-yellow-50 border border-yellow-100 px-1.5 py-0.5 rounded">est.</span>
                                )}
                              </div>
                              <span className="font-medium text-gray-800">
                                {val !== null && val !== undefined ? fmt(sym, val) : '—'}
                              </span>
                            </div>
                          )
                        })}
                        {cb.per_unit.total_cogs !== null && cb.per_unit.total_cogs !== undefined && (
                          <div className="flex justify-between items-center text-sm border-t border-gray-100 pt-2">
                            <span className="font-semibold text-gray-700">Total COGS</span>
                            <span className="font-bold text-gray-900">{fmt(sym, cb.per_unit.total_cogs as number)}</span>
                          </div>
                        )}
                      </div>
                      {(cb.suggested_price !== null || cb.gross_margin_pct !== null) && (
                        <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3 flex justify-between items-center mb-3">
                          {cb.suggested_price !== null && (
                            <div>
                              <p className="text-xs text-emerald-600 mb-0.5">Suggested price</p>
                              <p className="text-xl font-bold text-emerald-900">{fmt(sym, cb.suggested_price)}</p>
                            </div>
                          )}
                          {cb.gross_margin_pct !== null && (
                            <div className="text-right">
                              <p className="text-xs text-emerald-600 mb-0.5">Gross margin</p>
                              <p className="text-xl font-bold text-emerald-900">{cb.gross_margin_pct}%</p>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : null}

                  {cb.startup_costs && cb.startup_costs.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-sm font-semibold text-gray-700">Estimated startup costs</h3>
                        <span className="text-xs text-yellow-600 bg-yellow-50 border border-yellow-100 rounded px-1.5 py-0.5">
                          AI estimates — validate with real quotes
                        </span>
                      </div>
                      <div className="space-y-2">
                        {cb.startup_costs.map((item, i) => (
                          <div key={i} className="flex justify-between items-start text-sm gap-4">
                            <div className="min-w-0">
                              <p className="text-gray-700">{item.item}</p>
                              {item.note && <p className="text-xs text-gray-400 mt-0.5">{item.note}</p>}
                            </div>
                            <span className="font-medium text-gray-800 whitespace-nowrap">
                              {fmt0(sym, item.estimate_low)}–{fmt0(sym, item.estimate_high)}
                            </span>
                          </div>
                        ))}
                        <div className="flex justify-between items-center text-sm border-t border-gray-100 pt-2">
                          <span className="font-semibold text-gray-600">Total (range)</span>
                          <span className="font-semibold text-gray-700">
                            {fmt0(sym, cb.startup_costs.reduce((sum, item) => sum + item.estimate_low, 0))}
                            –
                            {fmt0(sym, cb.startup_costs.reduce((sum, item) => sum + item.estimate_high, 0))}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {cb.ongoing_costs && cb.ongoing_costs.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Estimated ongoing costs</h3>
                      <div className="space-y-2">
                        {cb.ongoing_costs.map((item, i) => (
                          <div key={i} className="flex justify-between items-start text-sm gap-4">
                            <div className="min-w-0">
                              <p className="text-gray-700">{item.item}</p>
                              {item.note && <p className="text-xs text-gray-400 mt-0.5">{item.note}</p>}
                            </div>
                            <span className="font-medium text-gray-800 whitespace-nowrap">
                              {fmt0(sym, item.estimate_monthly)}/mo
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {cb.notes && <p className="text-xs text-gray-500 leading-relaxed">{cb.notes}</p>}
                </div>
              )
            })()
            : <UnavailableSection title="Cost Breakdown" />}

        {isUnavailable(pricing)
          ? <UnavailableSection title="Pricing Recommendation" reason={pricing.reason} />
          : pricing
            ? (() => {
              const p = pricing as { model: string; suggested_price_or_range: string; rationale: string; comparable_market_rates: string }
              return (
                <div className="rounded-xl border border-gray-200 bg-white px-5 py-5">
                  <h2 className="font-semibold text-gray-900 mb-1">Pricing Recommendation</h2>
                  <p className="text-xs text-gray-400 mb-4">{p.model}</p>
                  <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-3 mb-3">
                    <p className="text-xs text-indigo-500 mb-0.5">Suggested price</p>
                    <p className="text-lg font-semibold text-indigo-900">{p.suggested_price_or_range}</p>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">{p.rationale}</p>
                  <p className="text-xs text-gray-500">{p.comparable_market_rates}</p>
                </div>
              )
            })()
            : <UnavailableSection title="Pricing Recommendation" />}
      </div>

      {/* Panel 4: Legal & Compliance */}
      <div className={`${panelClass('legal')} space-y-6 break-inside-avoid`}>
        {isUnavailable(compliance)
          ? <UnavailableSection title="Legal & Compliance" reason={compliance.reason} />
          : Array.isArray(compliance) && compliance.length > 0
            ? (
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900">Legal & Compliance</h2>
                </div>
                <div className="divide-y divide-gray-100">
                  {(compliance as Array<Record<string, string>>).map((item, i) => (
                    <div key={i} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <p className="text-sm font-medium text-gray-800">{item.item}</p>
                        <SeverityBadge severity={item.severity} />
                      </div>
                      <p className="text-xs text-gray-400 mb-2">{item.jurisdiction}</p>
                      <p className="text-sm text-gray-600 mb-2">{item.summary}</p>
                      {item.official_source_url && (
                        <a href={item.official_source_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-indigo-600 hover:underline break-all">
                          {item.official_source_url}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
                <div className="px-5 py-4 bg-amber-50 border-t border-amber-100">
                  <p className="text-xs text-amber-800 leading-relaxed">
                    <span className="font-semibold">Not legal advice.</span> The compliance items above are for informational purposes only. Requirements vary by location, business structure, and circumstances. Consult a qualified lawyer, accountant, or relevant government body before acting on any item listed here.
                  </p>
                </div>
              </div>
            )
            : <UnavailableSection title="Legal & Compliance" />}
      </div>

      {/* Panel 5: Risks & Next Steps */}
      <div className={`${panelClass('risks')} space-y-6 break-inside-avoid`}>
        {isUnavailable(risks)
          ? <UnavailableSection title="Key Risks" reason={risks.reason} />
          : Array.isArray(risks) && risks.length > 0
            ? (
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900">Key Risks</h2>
                </div>
                <div className="divide-y divide-gray-100">
                  {(risks as Array<Record<string, string>>).map((risk, i) => {
                    // Tolerate alternate key names from older reports whose
                    // prompt didn't pin the schema (risk/detail vs title/description).
                    const title = risk.title ?? risk.risk
                    const description = risk.description ?? risk.detail
                    return (
                      <div key={i} className="px-5 py-4">
                        {title && <p className="text-sm font-medium text-gray-800 mb-1">{title}</p>}
                        {description && <p className="text-sm text-gray-600 mb-2">{description}</p>}
                        {risk.mitigation && (
                          <p className="text-xs text-indigo-700 bg-indigo-50 rounded px-2 py-1.5">
                            <span className="font-medium">Mitigation: </span>{risk.mitigation}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
            : <UnavailableSection title="Key Risks" />}

        {isUnavailable(nextSteps)
          ? <UnavailableSection title="Next Steps" reason={nextSteps.reason} />
          : Array.isArray(nextSteps) && nextSteps.length > 0
            ? (
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900">Next Steps</h2>
                  <p className="text-xs text-gray-400 mt-0.5">In order of priority</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {(nextSteps as Array<Record<string, string>>).map((step, i) => (
                    <div key={i} className="px-5 py-4 flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center mt-0.5">
                        <span className="text-xs font-semibold text-indigo-700">{i + 1}</span>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-indigo-600">{step.timeframe}</span>
                        <p className="text-sm text-gray-800 mt-0.5">{step.action}</p>
                        {(step.rationale ?? step.detail) && <p className="text-xs text-gray-500 mt-1">{step.rationale ?? step.detail}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
            : <UnavailableSection title="Next Steps" />}
      </div>

    </div>
  )
}

// ── Action buttons ────────────────────────────────────────────

function RegenerateButton({ ideaId, label, onStart }: { ideaId: string; label: string; onStart: () => void }) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
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
      onClick={handleClick}
      disabled={loading}
      className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-40 underline underline-offset-2"
    >
      {loading ? 'Starting…' : label}
    </button>
  )
}

function GenerateFullReportButton({ ideaId, onStart }: { ideaId: string; onStart: () => void }) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    const ok = window.confirm(
      'Run the full AI research pipeline?\n\n' +
      '• Competitor research (web search, max 5 searches)\n' +
      '• Cost estimation\n' +
      '• Compliance check (web search, max 3 searches)\n' +
      '• Synthesis\n\n' +
      'Estimated cost: ~US$0.30–0.60\n\nContinue?'
    )
    if (!ok) return
    setLoading(true)
    try {
      const res = await fetch('/api/reports/full', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea_id: ideaId }),
      })
      if (!res.ok) {
        const d = await res.json()
        alert(d.error ?? 'Failed to start full report')
        return
      }
      onStart()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border-2 border-dashed border-amber-200 bg-amber-50 px-5 py-4 text-center">
      <p className="text-xs font-semibold text-amber-700 mb-1">Admin — Test mode</p>
      <p className="text-xs text-amber-600 mb-3">
        Runs the full research pipeline. ~US$0.30–0.60 per run.
      </p>
      <button
        onClick={handleClick}
        disabled={loading}
        className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Starting…' : 'Generate full report'}
      </button>
    </div>
  )
}

// ── Main client component ─────────────────────────────────────

export default function ReportClient({ ideaId, restatement, archetype: _archetype, initialReport, isAdmin }: Props) {
  const [report, setReport] = useState<ReportData | null>(initialReport)
  const [regenerating, setRegenerating] = useState(false)

  const hasFullSections = report?.status === 'complete' && Object.keys(report.sections).length > 0
  const generationCost = (report?.sections?._meta as { cost_usd?: number } | undefined)?.cost_usd

  if (hasFullSections && !regenerating) {
    return (
      <div>
        <FullReportViewer report={report!} />
        <div className="max-w-3xl mx-auto px-6 pb-8 flex flex-col items-center gap-2 print:hidden">
          {isAdmin && generationCost !== undefined && (
            <p className="text-xs text-gray-400">Generation cost: US${generationCost.toFixed(2)}</p>
          )}
          <RegenerateButton ideaId={ideaId} label="Regenerate teaser" onStart={() => { setRegenerating(true); setReport(null) }} />
        </div>
      </div>
    )
  }

  if (report?.status === 'complete' && !regenerating) {
    return (
      <div>
        <TeaserViewer
          report={report}
          ideaId={ideaId}
          isAdmin={isAdmin}
          onGenerateFull={() => { setRegenerating(true); setReport(null) }}
        />
        <div className="max-w-3xl mx-auto px-6 pb-8 flex flex-col items-center gap-2 print:hidden">
          <RegenerateButton ideaId={ideaId} label="Regenerate teaser" onStart={() => { setRegenerating(true); setReport(null) }} />
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
