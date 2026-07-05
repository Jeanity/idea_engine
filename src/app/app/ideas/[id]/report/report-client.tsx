'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

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

const TICKER_LINES: Record<string, string[]> = {
  competitors: [
    'Scanning competitor sites…',
    'Reading pricing pages…',
    'Comparing local operators…',
    'Mapping gaps in the market…',
  ],
  cost_breakdown: [
    'Pricing materials and inputs…',
    'Calculating power draw…',
    'Splitting active vs passive labour…',
    'Modelling margins…',
  ],
  legal_compliance: [
    'Checking permits and registrations…',
    'Reading official sources…',
    'Flagging what applies to you…',
  ],
  summary: [
    'Weighing the evidence…',
    'Scoring viability…',
    'Writing your next steps…',
  ],
}

// One cog path reused at three sizes/colors/speeds via CSS classes.
function Cog({ className, size, color }: { className?: string; size: number; color: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      style={{ color, filter: `drop-shadow(0 0 8px ${color}66)` }}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        opacity={0.7}
        d="M50 4a4 4 0 0 1 4 3.4l1.2 8.3a37.9 37.9 0 0 1 9.6 4l7-4.8a4 4 0 0 1 5 .5l6.8 6.8a4 4 0 0 1 .5 5l-4.8 7a37.9 37.9 0 0 1 4 9.6l8.3 1.2a4 4 0 0 1 3.4 4v9.6a4 4 0 0 1-3.4 4l-8.3 1.2a37.9 37.9 0 0 1-4 9.6l4.8 7a4 4 0 0 1-.5 5l-6.8 6.8a4 4 0 0 1-5 .5l-7-4.8a37.9 37.9 0 0 1-9.6 4l-1.2 8.3a4 4 0 0 1-4 3.4h-9.6a4 4 0 0 1-4-3.4l-1.2-8.3a37.9 37.9 0 0 1-9.6-4l-7 4.8a4 4 0 0 1-5-.5l-6.8-6.8a4 4 0 0 1-.5-5l4.8-7a37.9 37.9 0 0 1-4-9.6l-8.3-1.2a4 4 0 0 1-3.4-4v-9.6a4 4 0 0 1 3.4-4l8.3-1.2a37.9 37.9 0 0 1 4-9.6l-4.8-7a4 4 0 0 1 .5-5l6.8-6.8a4 4 0 0 1 5-.5l7 4.8a37.9 37.9 0 0 1 9.6-4l1.2-8.3a4 4 0 0 1 4-3.4z"
      />
      <circle cx="50" cy="50" r="16" fill="var(--gear-hole-bg, #020617)" />
    </svg>
  )
}

/**
 * A glow blob that drifts around its parent with a random direction/speed
 * and bounces off the edges. fx/fy = starting position as a fraction of the
 * available space. Static (no drift) under prefers-reduced-motion.
 */
function BouncingBlob({ sizePx, className, fx, fy }: {
  sizePx: number
  className: string
  fx: number
  fy: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const parent = el.parentElement
    if (!parent) return

    let w = parent.clientWidth
    let h = parent.clientHeight
    let x = fx * Math.max(0, w - sizePx)
    let y = fy * Math.max(0, h - sizePx)

    const place = () => { el.style.transform = `translate3d(${x}px, ${y}px, 0)` }
    place()
    el.style.opacity = '1'

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // Random gentle drift: 25–50 px/s in a random direction.
    const speed = 25 + Math.random() * 25
    const angle = Math.random() * Math.PI * 2
    let vx = Math.cos(angle) * speed
    let vy = Math.sin(angle) * speed

    const onResize = () => { w = parent.clientWidth; h = parent.clientHeight }
    window.addEventListener('resize', onResize)

    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      x += vx * dt
      y += vy * dt
      const maxX = Math.max(0, w - sizePx)
      const maxY = Math.max(0, h - sizePx)
      if (x <= 0) { x = 0; vx = Math.abs(vx) }
      else if (x >= maxX) { x = maxX; vx = -Math.abs(vx) }
      if (y <= 0) { y = 0; vy = Math.abs(vy) }
      else if (y >= maxY) { y = maxY; vy = -Math.abs(vy) }
      place()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [sizePx, fx, fy])

  return (
    <div
      ref={ref}
      className={`absolute top-0 left-0 rounded-full blur-3xl will-change-transform opacity-0 transition-opacity duration-700 ${className}`}
      style={{ width: sizePx, height: sizePx }}
    />
  )
}

function GearCluster() {
  return (
    <div className="relative flex items-center justify-center h-28 mb-2" aria-hidden="true">
      {/* Large gear, back-left, slowest */}
      <div className="gear-spin absolute" style={{ animationDuration: '13s', left: 'calc(50% - 58px)', top: 'calc(50% - 8px)' }}>
        <Cog size={56} color="#818cf8" />
      </div>
      {/* Middle gear, center, reversed */}
      <div className="gear-spin-reverse absolute" style={{ animationDuration: '9s' }}>
        <Cog size={72} color="#a78bfa" />
      </div>
      {/* Small gear, front-right, fastest */}
      <div className="gear-spin absolute" style={{ animationDuration: '6s', left: 'calc(50% + 28px)', top: 'calc(50% - 46px)' }}>
        <Cog size={40} color="#22d3ee" />
      </div>
    </div>
  )
}

function ConsoleTicker({ stepKey }: { stepKey: string }) {
  const lines = TICKER_LINES[stepKey] ?? []
  const [index, setIndex] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    setIndex(0)
    if (reducedMotion || lines.length <= 1) return
    const interval = setInterval(() => {
      setIndex(i => (i + 1) % lines.length)
    }, 2500)
    return () => clearInterval(interval)
  }, [stepKey, reducedMotion, lines.length])

  if (lines.length === 0) return null

  return (
    <p className="mt-1 font-mono text-xs text-cyan-300/80">
      {lines[index]}
      <span className="cursor-blink inline-block w-1.5 h-3 bg-cyan-300/80 ml-1 align-middle" />
    </p>
  )
}

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
      // Server errors can return an empty/non-JSON body — don't let the
      // parse error ("Unexpected end of JSON input") mask the real status.
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? `Report generation failed to start (server error ${res.status}). Please try again.`)
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

  const activeKey = STEPS.find(({ key }, i) => {
    const done = completedKeys.includes(key)
    return !done && (i === 0 || completedKeys.includes(STEPS[i - 1]?.key ?? ''))
  })?.key

  if (error) {
    return (
      <div className="relative min-h-[calc(100vh-62px)] bg-slate-950 dot-grid overflow-hidden">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <BouncingBlob sizePx={384} className="bg-indigo-600/30" fx={0.05} fy={0.08} />
          <BouncingBlob sizePx={384} className="bg-violet-600/20" fx={0.9} fy={0.85} />
          <BouncingBlob sizePx={280} className="bg-cyan-500/15" fx={0.55} fy={0.4} />
        </div>
        <div className="relative z-10 max-w-2xl mx-auto px-6 py-24 text-center">
          <p className="text-red-300 text-sm mb-4">{error}</p>
          <button
            onClick={() => { setError(null); triggerGeneration() }}
            className="text-sm text-indigo-400 hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  // Full-bleed engine bay — the whole area below the header goes dark so
  // the generating state reads as a place, not a card floating on white.
  return (
    <div className="relative min-h-[calc(100vh-62px)] bg-slate-950 dot-grid overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="animate-blob-1 absolute -top-24 -left-16 h-96 w-96 rounded-full bg-indigo-600/30 blur-3xl" />
        <div className="animate-blob-2 absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl" />
      </div>

      <div className="max-w-2xl mx-auto px-6 py-16 sm:py-20">
        <div className="relative z-10">
          <div className="text-center mb-4">
            <h1 className="text-xl font-semibold text-white mb-2">Generating your report</h1>
            {restatement && <p className="text-sm text-slate-400">{restatement}</p>}
          </div>

          <GearCluster />

          <div className="space-y-0">
            {STEPS.map(({ key, label }, i) => {
              const done = completedKeys.includes(key)
              const active = !done && key === activeKey
              const isLast = i === STEPS.length - 1
              return (
                <div key={key} className="relative flex gap-4 pb-8 last:pb-0">
                  {!isLast && (
                    <div className="absolute left-[9px] top-5 bottom-0 w-0.5 bg-slate-700 overflow-hidden rounded-full">
                      <div
                        className="w-full bg-gradient-to-b from-indigo-400 to-cyan-400 transition-all duration-500"
                        style={{ height: done ? '100%' : '0%' }}
                      />
                    </div>
                  )}

                  <span className="relative flex-shrink-0 mt-0.5">
                    {active && (
                      <span className="absolute inset-0 rounded-full bg-indigo-500/40 animate-ping" />
                    )}
                    <span
                      className={`relative flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold
                        ${done
                          ? 'bg-emerald-500 text-white'
                          : active
                            ? 'bg-indigo-500 text-white ring-4 ring-indigo-500/25'
                            : 'bg-slate-900 border border-slate-700 text-transparent'}`}
                    >
                      {done ? '✓' : ''}
                    </span>
                  </span>

                  <div className="min-w-0">
                    <span className={`text-sm ${done ? 'text-slate-300' : active ? 'text-white font-medium' : 'text-slate-500'}`}>
                      {label}
                    </span>
                    {active && <ConsoleTicker stepKey={key} />}
                  </div>
                </div>
              )
            })}
          </div>

          {!generating && !report && (
            <p className="text-center text-xs text-slate-500 mt-2">Starting up…</p>
          )}
        </div>
      </div>
      <p className="text-center text-xs text-slate-500 mt-4">This usually takes 1–3 minutes.</p>
    </div>
  )
}

// ── Shared helpers ────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= score ? 'bg-indigo-400' : 'bg-white/10 light:bg-gray-200'}`} />
      ))}
    </div>
  )
}

function isUnavailable(v: unknown): v is { status: 'unavailable'; reason: string } {
  return typeof v === 'object' && v !== null && (v as Record<string, unknown>).status === 'unavailable'
}

function UnavailableSection({ title, reason }: { title: string; reason?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm px-5 py-4">
      <h2 className="font-semibold text-white light:text-gray-900 mb-1">{title}</h2>
      <p className="text-sm text-slate-500 light:text-gray-400">{reason ?? 'This section was unavailable.'}</p>
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
    <div className="rounded-2xl border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm px-5 py-5">
      <h2 className="font-semibold text-white light:text-gray-900 mb-4">Viability Snapshot</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {Object.entries(vs.scores).map(([key, val]) => (
          <div key={key}>
            <div className="flex justify-between text-xs text-slate-400 light:text-gray-500 mb-1">
              <span>{SCORE_LABELS[key] ?? key}</span>
              <span className="font-medium text-slate-300 light:text-gray-700">{val.score}/5</span>
            </div>
            <ScoreBar score={val.score} />
            <p className="text-xs text-slate-500 light:text-gray-400 mt-1">{val.rationale}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 light:bg-indigo-50 light:border-indigo-100 px-4 py-3">
        <p className="text-sm text-indigo-200 light:text-indigo-900">{vs.overall_verdict}</p>
      </div>
    </div>
  )
}

// ── Teaser viewer ─────────────────────────────────────────────

function LockedSection({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10 light:border-gray-200 flex items-center justify-between">
        <h2 className="font-semibold text-white light:text-gray-900">{title}</h2>
        <span className="text-xs text-slate-500 light:text-gray-400 flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
          Unlock to view
        </span>
      </div>
      <div className="px-5 py-4 blur-sm select-none pointer-events-none" aria-hidden>
        <div className="space-y-2">
          <div className="h-3 bg-white/10 light:bg-gray-200 rounded w-full" />
          <div className="h-3 bg-white/10 light:bg-gray-200 rounded w-5/6" />
          <div className="h-3 bg-white/10 light:bg-gray-200 rounded w-4/6" />
          <div className="h-3 bg-white/10 light:bg-gray-200 rounded w-5/6 mt-2" />
          <div className="h-3 bg-white/10 light:bg-gray-200 rounded w-3/6" />
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
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm px-5 py-5">
          <h2 className="font-semibold text-white light:text-gray-900 mb-3">Summary</h2>
          <p className="text-sm text-slate-300 light:text-gray-700 leading-relaxed">{summary.text}</p>
        </div>
      ) : <UnavailableSection title="Summary" />}

      {vs?.scores ? <ViabilitySnapshot vs={vs} /> : <UnavailableSection title="Viability Snapshot" />}

      {nextStepsPreview.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 light:border-gray-200">
            <h2 className="font-semibold text-white light:text-gray-900">Where to start</h2>
            <p className="text-xs text-slate-500 light:text-gray-400 mt-0.5">2 of your personalised next steps</p>
          </div>
          <div className="divide-y divide-white/10 light:divide-gray-100">
            {nextStepsPreview.map((step, i) => (
              <div key={i} className="px-5 py-3 flex gap-3 items-baseline">
                <span className="flex-shrink-0 text-xs font-semibold text-indigo-300">{step.timeframe}</span>
                <p className="text-sm text-slate-300 light:text-gray-700">{step.action}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border-2 border-dashed border-white/15 bg-white/5 light:border-gray-200 light:bg-gray-50 px-5 py-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 light:text-gray-400 mb-3">Included in full report</p>
        <ul className="space-y-2 text-sm text-slate-300 light:text-gray-600">
          {[
            '5–8 real competitors with pricing and gap analysis',
            'Cost breakdown — materials, labour, power, margin',
            'Pricing strategy with comparable market rates',
            'Legal & compliance checklist with official source links',
            'Things to consider — with how to handle each',
            'Complete prioritised next steps',
          ].map(item => (
            <li key={item} className="flex gap-2 items-start">
              <svg className="w-4 h-4 text-slate-500 light:text-gray-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
              {item}
            </li>
          ))}
        </ul>
        <button className="mt-5 w-full rounded-lg bg-indigo-500 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-400 transition-colors">
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
    required: 'bg-red-500/15 text-red-300 light:bg-red-100 light:text-red-700',
    recommended: 'bg-yellow-500/15 text-yellow-300 light:bg-yellow-100 light:text-yellow-700',
    fyi: 'bg-blue-500/15 text-blue-300 light:bg-blue-100 light:text-blue-700',
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[severity] ?? 'bg-white/10 text-slate-400 light:bg-gray-100 light:text-gray-700'}`}>
      {severity}
    </span>
  )
}

function FundingTypeBadge({ type }: { type: string }) {
  const highlighted = type === 'grant' || type === 'tax_incentive'
  const label = (type ?? '').replace(/_/g, ' ')
  return (
    <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${highlighted ? 'bg-indigo-500/15 text-indigo-300 light:bg-indigo-100 light:text-indigo-700' : 'bg-white/10 text-slate-400 light:bg-gray-100 light:text-gray-700'}`}>
      {label}
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
  { key: 'risks', label: 'Considerations & Next Steps' },
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
  const fundingOptions = s.funding_options

  const competitorsCount = Array.isArray(competitors) ? competitors.length : null

  function handleTabChange(key: ReportTabKey) {
    setActiveTab(key)
    window.scrollTo({ top: 0 })
  }

  function panelClass(key: ReportTabKey) {
    return activeTab === key ? 'block' : 'hidden print:block'
  }

  return (
    <div className="print-force-light max-w-3xl mx-auto px-6 py-10 print:py-4">

      {/* Tab bar */}
      <div className="sticky top-0 z-10 bg-slate-950/90 light:bg-gray-50/95 backdrop-blur -mx-6 px-6 mb-6 border-b border-white/10 light:border-gray-200 overflow-x-auto print:hidden">
        <div className="flex gap-1 whitespace-nowrap">
          {REPORT_TABS.map(tab => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                  ${isActive
                    ? 'border-indigo-400 text-white light:text-indigo-700'
                    : 'border-transparent text-slate-400 hover:text-slate-200 light:text-gray-500 light:hover:text-gray-700'}`}
              >
                {tab.label}
                {tab.key === 'competitors' && competitorsCount !== null && (
                  <span className={`ml-1.5 ${isActive ? 'text-indigo-300' : 'text-slate-500 light:text-gray-400'}`}>
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
              <div className="rounded-2xl border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm px-5 py-5">
                <h2 className="font-semibold text-white light:text-gray-900 mb-3">Summary</h2>
                <p className="text-sm text-slate-300 light:text-gray-700 leading-relaxed">{(summary as { text: string }).text}</p>
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
              <div className="rounded-2xl border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10 light:border-gray-200">
                  <h2 className="font-semibold text-white light:text-gray-900">Competitors</h2>
                  <p className="text-xs text-slate-500 light:text-gray-400 mt-0.5">{competitors.length} found</p>
                </div>
                <div className="divide-y divide-white/10 light:divide-gray-100">
                  {(competitors as Array<Record<string, string>>).map((c, i) => (
                    <div key={i} className="px-5 py-4">
                      <div className="mb-2">
                        <div className="min-w-0">
                          <a href={c.url} target="_blank" rel="noopener noreferrer"
                            className="font-medium text-indigo-300 hover:underline text-sm break-words">{c.name}</a>
                          <span className="text-xs text-slate-500 light:text-gray-400 ml-2">{c.location}</span>
                        </div>
                        {c.pricing_summary && (
                          <p className="text-xs font-medium text-slate-300 light:text-gray-700 mt-0.5 break-words">{c.pricing_summary}</p>
                        )}
                      </div>
                      <p className="text-sm text-slate-400 light:text-gray-500 mb-2">
                        <span className="font-medium text-slate-300 light:text-gray-700">Positioning: </span>{c.positioning_angle}
                      </p>
                      <p className="text-xs text-emerald-200 bg-emerald-500/10 border border-emerald-500/20 light:bg-emerald-50 light:border-emerald-100 light:text-emerald-800 rounded px-2 py-1.5">
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
                <div className="rounded-2xl border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm px-5 py-5">
                  <h2 className="font-semibold text-white light:text-gray-900 mb-4">
                    Cost Breakdown <span className="text-xs font-normal text-slate-500 light:text-gray-400">{cb.currency}</span>
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
                                <span className="text-slate-400 light:text-gray-500">{label}</span>
                                {flag === 'estimated' && (
                                  <span className="text-xs text-yellow-300 bg-yellow-500/15 light:bg-yellow-50 light:text-yellow-700 light:border light:border-yellow-200 px-1.5 py-0.5 rounded">est.</span>
                                )}
                              </div>
                              <span className="font-medium text-slate-200 light:text-gray-800">
                                {val !== null && val !== undefined ? fmt(sym, val) : '—'}
                              </span>
                            </div>
                          )
                        })}
                        {cb.per_unit.total_cogs !== null && cb.per_unit.total_cogs !== undefined && (
                          <div className="flex justify-between items-center text-sm border-t border-white/10 light:border-gray-200 pt-2">
                            <span className="font-semibold text-slate-300 light:text-gray-700">Total COGS</span>
                            <span className="font-bold text-white light:text-gray-900">{fmt(sym, cb.per_unit.total_cogs as number)}</span>
                          </div>
                        )}
                      </div>
                      {(cb.suggested_price !== null || cb.gross_margin_pct !== null) && (
                        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 light:bg-emerald-50 light:border-emerald-100 px-4 py-3 flex justify-between items-center mb-3">
                          {cb.suggested_price !== null && (
                            <div>
                              <p className="text-xs text-emerald-200 light:text-emerald-800 mb-0.5">Suggested price</p>
                              <p className="text-xl font-bold text-emerald-200 light:text-emerald-800">{fmt(sym, cb.suggested_price)}</p>
                            </div>
                          )}
                          {cb.gross_margin_pct !== null && (
                            <div className="text-right">
                              <p className="text-xs text-emerald-200 light:text-emerald-800 mb-0.5">Gross margin</p>
                              <p className="text-xl font-bold text-emerald-200 light:text-emerald-800">{cb.gross_margin_pct}%</p>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : null}

                  {cb.startup_costs && cb.startup_costs.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-sm font-semibold text-slate-300 light:text-gray-700">Estimated startup costs</h3>
                        <span className="text-xs text-yellow-300 bg-yellow-500/15 light:bg-yellow-50 light:text-yellow-700 light:border light:border-yellow-200 rounded px-1.5 py-0.5">
                          AI estimates — validate with real quotes
                        </span>
                      </div>
                      <div className="space-y-2">
                        {cb.startup_costs.map((item, i) => (
                          <div key={i} className="flex justify-between items-start text-sm gap-4">
                            <div className="min-w-0">
                              <p className="text-slate-300 light:text-gray-700">{item.item}</p>
                              {item.note && <p className="text-xs text-slate-500 light:text-gray-400 mt-0.5">{item.note}</p>}
                            </div>
                            <span className="font-medium text-slate-200 light:text-gray-800 whitespace-nowrap">
                              {fmt0(sym, item.estimate_low)}–{fmt0(sym, item.estimate_high)}
                            </span>
                          </div>
                        ))}
                        <div className="flex justify-between items-center text-sm border-t border-white/10 light:border-gray-200 pt-2">
                          <span className="font-semibold text-slate-400 light:text-gray-500">Total (range)</span>
                          <span className="font-semibold text-slate-300 light:text-gray-700">
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
                      <h3 className="text-sm font-semibold text-slate-300 light:text-gray-700 mb-2">Estimated ongoing costs</h3>
                      <div className="space-y-2">
                        {cb.ongoing_costs.map((item, i) => (
                          <div key={i} className="flex justify-between items-start text-sm gap-4">
                            <div className="min-w-0">
                              <p className="text-slate-300 light:text-gray-700">{item.item}</p>
                              {item.note && <p className="text-xs text-slate-500 light:text-gray-400 mt-0.5">{item.note}</p>}
                            </div>
                            <span className="font-medium text-slate-200 light:text-gray-800 whitespace-nowrap">
                              {fmt0(sym, item.estimate_monthly)}/mo
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {cb.notes && <p className="text-xs text-slate-500 light:text-gray-400 leading-relaxed">{cb.notes}</p>}
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
                <div className="rounded-2xl border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm px-5 py-5">
                  <h2 className="font-semibold text-white light:text-gray-900 mb-1">Pricing Recommendation</h2>
                  <p className="text-xs text-slate-500 light:text-gray-400 mb-4">{p.model}</p>
                  <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 light:bg-indigo-50 light:border-indigo-100 px-4 py-3 mb-3">
                    <p className="text-xs text-indigo-200 light:text-indigo-900 mb-0.5">Suggested price</p>
                    <p className="text-lg font-semibold text-indigo-200 light:text-indigo-900">{p.suggested_price_or_range}</p>
                  </div>
                  <p className="text-sm text-slate-300 light:text-gray-700 mb-2">{p.rationale}</p>
                  <p className="text-xs text-slate-500 light:text-gray-400">{p.comparable_market_rates}</p>
                </div>
              )
            })()
            : <UnavailableSection title="Pricing Recommendation" />}

        {isUnavailable(fundingOptions)
          ? <UnavailableSection title="Funding Options" reason={fundingOptions.reason} />
          : Array.isArray(fundingOptions) && fundingOptions.length > 0
            ? (
              <div className="rounded-2xl border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10 light:border-gray-200">
                  <h2 className="font-semibold text-white light:text-gray-900">Funding Options</h2>
                  <p className="text-xs text-slate-500 light:text-gray-400 mt-0.5">Your stated capital is below the estimated startup cost — realistic ways to bridge the gap</p>
                </div>
                <div className="divide-y divide-white/10 light:divide-gray-100">
                  {(fundingOptions as Array<Record<string, string>>).map((item, i) => (
                    <div key={i} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <a href={item.url} target="_blank" rel="noopener noreferrer"
                          className="font-medium text-indigo-300 hover:underline text-sm break-words">{item.name}</a>
                        <FundingTypeBadge type={item.type} />
                      </div>
                      <p className="text-xs text-slate-500 light:text-gray-400 mb-2">{item.jurisdiction}</p>
                      <p className="text-sm text-slate-400 light:text-gray-500 mb-2">{item.summary}</p>
                      {item.eligibility && (
                        <p className="text-xs text-slate-500 light:text-gray-400 mb-2">
                          <span className="font-medium">Eligibility: </span>{item.eligibility}
                        </p>
                      )}
                      {item.fit_note && (
                        <p className="text-xs text-indigo-200 bg-indigo-500/10 border border-indigo-500/20 light:bg-indigo-50 light:border-indigo-100 light:text-indigo-900 rounded px-2 py-1.5">
                          <span className="font-bold">Why this fits: </span>{item.fit_note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
            : null}
      </div>

      {/* Panel 4: Legal & Compliance */}
      <div className={`${panelClass('legal')} space-y-6 break-inside-avoid`}>
        {isUnavailable(compliance)
          ? <UnavailableSection title="Legal & Compliance" reason={compliance.reason} />
          : Array.isArray(compliance) && compliance.length > 0
            ? (
              <div className="rounded-2xl border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10 light:border-gray-200">
                  <h2 className="font-semibold text-white light:text-gray-900">Legal & Compliance</h2>
                </div>
                <div className="divide-y divide-white/10 light:divide-gray-100">
                  {(compliance as Array<Record<string, string>>).map((item, i) => (
                    <div key={i} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <p className="text-sm font-medium text-slate-200 light:text-gray-800">{item.item}</p>
                        <SeverityBadge severity={item.severity} />
                      </div>
                      <p className="text-xs text-slate-500 light:text-gray-400 mb-2">{item.jurisdiction}</p>
                      <p className="text-sm text-slate-400 light:text-gray-500 mb-2">{item.summary}</p>
                      {item.official_source_url && (
                        <a href={item.official_source_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-indigo-300 hover:underline break-all">
                          {item.official_source_url}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
                <div className="px-5 py-4 bg-amber-500/10 border-t border-amber-500/20 light:bg-amber-50 light:border-amber-100">
                  <p className="text-xs text-amber-200 light:text-amber-900 leading-relaxed">
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
          ? <UnavailableSection title="Things to consider" reason={risks.reason} />
          : Array.isArray(risks) && risks.length > 0
            ? (
              <div className="rounded-2xl border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10 light:border-gray-200">
                  <h2 className="font-semibold text-white light:text-gray-900">Things to consider</h2>
                </div>
                <div className="divide-y divide-white/10 light:divide-gray-100">
                  {(risks as Array<Record<string, string>>).map((risk, i) => {
                    // Tolerate alternate key names from older reports whose
                    // prompt didn't pin the schema (risk/detail vs title/description).
                    const title = risk.title ?? risk.risk
                    const description = risk.description ?? risk.detail
                    return (
                      <div key={i} className="px-5 py-4">
                        {title && <p className="text-sm font-medium text-slate-200 light:text-gray-800 mb-1">{title}</p>}
                        {description && <p className="text-sm text-slate-400 light:text-gray-500 mb-2">{description}</p>}
                        {risk.mitigation && (
                          <p className="text-xs text-indigo-200 bg-indigo-500/10 border border-indigo-500/20 light:bg-indigo-50 light:border-indigo-100 light:text-indigo-900 rounded px-2 py-1.5">
                            <span className="font-medium">How to handle it: </span>{risk.mitigation}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
            : <UnavailableSection title="Things to consider" />}

        {isUnavailable(nextSteps)
          ? <UnavailableSection title="Next Steps" reason={nextSteps.reason} />
          : Array.isArray(nextSteps) && nextSteps.length > 0
            ? (
              <div className="rounded-2xl border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10 light:border-gray-200">
                  <h2 className="font-semibold text-white light:text-gray-900">Next Steps</h2>
                  <p className="text-xs text-slate-500 light:text-gray-400 mt-0.5">In order of priority</p>
                </div>
                <div className="divide-y divide-white/10 light:divide-gray-100">
                  {(nextSteps as Array<Record<string, string>>).map((step, i) => (
                    <div key={i} className="px-5 py-4 flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-500/15 flex items-center justify-center mt-0.5">
                        <span className="text-xs font-semibold text-indigo-300">{i + 1}</span>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-indigo-300">{step.timeframe}</span>
                        <p className="text-sm text-slate-200 light:text-gray-800 mt-0.5">{step.action}</p>
                        {(step.rationale ?? step.detail) && <p className="text-xs text-slate-500 light:text-gray-400 mt-1">{step.rationale ?? step.detail}</p>}
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
      className="text-xs text-slate-500 hover:text-slate-300 light:text-gray-400 light:hover:text-gray-700 disabled:opacity-40 underline underline-offset-2"
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
        const d = await res.json().catch(() => ({}))
        alert(d.error ?? `Failed to start full report (server error ${res.status})`)
        return
      }
      onStart()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-amber-500/30 bg-amber-500/10 light:bg-amber-50 light:border-amber-200 px-5 py-4 text-center">
      <p className="text-xs font-semibold text-amber-200 light:text-amber-900 mb-1">Admin — Test mode</p>
      <p className="text-xs text-amber-300 light:text-amber-700 mb-3">
        Runs the full research pipeline. ~US$0.30–0.60 per run.
      </p>
      <button
        onClick={handleClick}
        disabled={loading}
        className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-medium text-white hover:bg-amber-400 disabled:opacity-50 transition-colors"
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
            <p className="text-xs text-slate-500 light:text-gray-400">Generation cost: US${generationCost.toFixed(2)}</p>
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
