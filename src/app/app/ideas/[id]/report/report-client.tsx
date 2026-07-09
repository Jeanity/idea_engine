'use client'

import { useState, useEffect, useCallback, useRef, useSyncExternalStore, type ReactNode } from 'react'
import Link from 'next/link'
import { symbolForCurrency } from '@/lib/countries'
import { ScoreRing } from '@/components/score-ring'
import { deriveHeadlineScore } from '@/lib/viability-score'
import { splitCiteSegments, hasCiteMarkers } from '@/lib/cite'

interface ReportData {
  id: string
  status: string
  sections: Record<string, unknown>
  preview_sections: Record<string, unknown>
  error: string | null
}

interface FeedbackData {
  rating: number
  comment: string | null
  allow_public: boolean
}

interface PromoStatus {
  active: boolean
  perUserRemaining: number | null
}

interface Props {
  ideaId: string
  restatement: string | null
  archetype: string
  initialReport: ReportData | null
  initialFeedback: FeedbackData | null
  isAdmin: boolean
  promoStatus: PromoStatus
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

function subscribeReducedMotion(callback: () => void) {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  mq.addEventListener('change', callback)
  return () => mq.removeEventListener('change', callback)
}
function getReducedMotionSnapshot() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
function getReducedMotionServerSnapshot() {
  return false
}

function ConsoleTicker({ stepKey }: { stepKey: string }) {
  const lines = TICKER_LINES[stepKey] ?? []
  const [index, setIndex] = useState(0)
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  )

  // Reset the ticker index whenever the active step changes. Adjusting state
  // during render (rather than in an effect) avoids an extra commit — see
  // https://react.dev/learn/you-might-not-need-an-effect.
  const [syncedStepKey, setSyncedStepKey] = useState(stepKey)
  if (syncedStepKey !== stepKey) {
    setSyncedStepKey(stepKey)
    setIndex(0)
  }

  useEffect(() => {
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
    // Kicks off the report-generation POST on mount. `generating` flips
    // synchronously so the "Starting up…" placeholder disappears immediately
    // instead of flashing while the request is in flight — this is the
    // standard fetch-on-mount pattern, there's no render-time equivalent for
    // starting a network request as a side effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

// Renders report prose, highlighting <cite>…</cite> spans — verbatim quotes
// backed by a source found during live research. The stored index attr is
// meaningless (transient search-result pointer), so the treatment is a subtle
// highlight + tooltip, not a link. Plain strings pass through untouched.
function CitedText({ text }: { text: string | null | undefined }) {
  if (!text) return null
  if (!hasCiteMarkers(text)) return <>{text}</>
  return (
    <>
      {splitCiteSegments(text).map((seg, i) =>
        seg.cited ? (
          <span
            key={i}
            title="Quoted from a source found during live research"
            className="bg-indigo-400/10 light:bg-indigo-50 border-b border-dotted border-indigo-400/60 light:border-indigo-400 rounded-[2px] px-0.5 cursor-help"
          >
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  )
}

// Shown at the top of a tab whose content came from the model's own knowledge
// because live web search was unavailable. Keeps the report honest without
// leaving the tab blank.
function InferredNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 light:bg-amber-50 light:border-amber-200 px-4 py-2.5 flex gap-2 items-start">
      <svg className="w-4 h-4 text-amber-300 light:text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
      <p className="text-xs text-amber-200 light:text-amber-900 leading-relaxed">{children}</p>
    </div>
  )
}

// Report-level banner when a required section is thin (live + fallback both
// failed). Driven by _meta.partial from the pipeline.
function PartialReportBanner() {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 light:bg-amber-50 light:border-amber-200 px-4 py-3 mb-6 flex gap-2.5 items-start">
      <svg className="w-5 h-5 text-amber-300 light:text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
      <p className="text-xs text-amber-100 light:text-amber-900 leading-relaxed">
        <span className="font-semibold">Some sections are incomplete.</span> One or more parts of this report couldn&rsquo;t be fully generated. What&rsquo;s shown is still accurate — you can regenerate the report below to try filling the gaps.
      </p>
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
      <div className="flex items-center gap-3 mb-4">
        <ScoreRing score={deriveHeadlineScore(vs.scores)} label="" size={48} />
        <h2 className="font-semibold text-white light:text-gray-900">Viability Snapshot</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {Object.entries(vs.scores).map(([key, val]) => (
          <div key={key}>
            <div className="flex justify-between text-xs text-slate-400 light:text-gray-500 mb-1">
              <span>{SCORE_LABELS[key] ?? key}</span>
              <span className="font-medium text-slate-300 light:text-gray-700">{val.score}/5</span>
            </div>
            <ScoreBar score={val.score} />
            <p className="text-xs text-slate-500 light:text-gray-400 mt-1"><CitedText text={val.rationale} /></p>
          </div>
        ))}
      </div>
      <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 light:bg-indigo-50 light:border-indigo-100 px-4 py-3">
        <p className="text-sm text-indigo-200 light:text-indigo-900"><CitedText text={vs.overall_verdict} /></p>
      </div>
    </div>
  )
}

// ── Teaser viewer ─────────────────────────────────────────────

// Free-during-launch unlock button for regular users when promo mode is
// active. Reuses the exact same generation-progress flow as the admin test
// button (POST /api/reports/full → onGenerateFull, which flips the parent
// into the ProgressScreen/poll flow) — no separate progress UI to maintain.
function PromoUnlockButton({ ideaId, onStart }: { ideaId: string; onStart: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleClick() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/reports/full', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea_id: ideaId }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? 'Could not start your full report. Please try again.')
        return
      }
      onStart()
    } catch {
      setError('Could not start your full report. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="mt-5 w-full rounded-lg bg-indigo-500 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-400 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Starting…' : 'Generate full report — free during launch'}
      </button>
      {error && <p className="mt-2 text-xs text-red-300 light:text-red-600 text-center">{error}</p>}
    </div>
  )
}

function TeaserViewer({ report, ideaId, isAdmin, promoStatus, onGenerateFull }: {
  report: ReportData
  ideaId: string
  isAdmin: boolean
  promoStatus: { active: boolean; perUserRemaining: number | null }
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
            'Why this is worth pursuing — what the competition proves, your edge, and your realistic upside',
            'Cost breakdown — materials, labour, power, margin',
            'Pricing strategy with comparable market rates',
            'Legal & compliance checklist with official source links',
            'Marketing playbook — the right channels for your customers, with starter budgets',
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
        {promoStatus.active && promoStatus.perUserRemaining !== 0 ? (
          <PromoUnlockButton ideaId={ideaId} onStart={onGenerateFull} />
        ) : promoStatus.active ? (
          <button
            disabled
            title="Free launch limit reached"
            className="mt-5 w-full rounded-lg bg-white/10 light:bg-gray-100 px-6 py-2.5 text-sm font-medium text-slate-400 light:text-gray-500 cursor-not-allowed"
          >
            Free launch limit reached — paid reports coming soon
          </button>
        ) : (
          <button
            disabled
            className="mt-5 w-full rounded-lg bg-indigo-500 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-400 transition-colors"
          >
            Unlock full report — coming soon
          </button>
        )}
      </div>

      {isAdmin && (
        <GenerateFullReportButton ideaId={ideaId} onStart={onGenerateFull} />
      )}
    </div>
  )
}

// ── Full report section components ───────────────────────────

// Feather Icons' "external-link" glyph (MIT) — mirrors the PDF's LinkIcon
// (src/lib/pdf/components.tsx) so both surfaces use the same visual cue for
// "this opens elsewhere," rather than relying on color/underline alone.
function ExternalLinkIcon({ className = 'w-3 h-3' }: { className?: string }) {
  return (
    <svg className={`inline-block shrink-0 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

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
  return symbolForCurrency(currency)
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
  { key: 'marketing', label: 'Getting the Word Out' },
  { key: 'risks', label: 'Considerations & Next Steps' },
] as const

type ReportTabKey = typeof REPORT_TABS[number]['key']

export function FullReportViewer({ report }: { report: ReportData }) {
  const s = report.sections
  const [activeTab, setActiveTab] = useState<ReportTabKey>('overview')

  const meta = s._meta as { partial?: boolean; section_status?: Record<string, string> } | undefined
  const competitorsInferred = meta?.section_status?.competitors === 'fallback_inferred'
  const complianceInferred = meta?.section_status?.legal_compliance === 'fallback_inferred'

  const summary = s.summary
  const vs = s.viability_snapshot as { scores: Record<string, { score: number; rationale: string }>; overall_verdict: string } | undefined
  const whyProceed = s.why_this_can_work as { market_proof: string; your_edge: string; upside: string } | undefined
  const competitors = s.competitors
  const costBreakdown = s.cost_breakdown
  const pricing = s.pricing_recommendation
  const compliance = s.legal_compliance
  const risks = s.risks
  const nextSteps = s.next_steps
  const fundingOptions = s.funding_options
  const oneThingToDo = s.one_thing_to_do as { action: string; why_first: string } | undefined
  const validationCopy = s.validation_copy as { poll_question: string; ad_line: string; forum_post: string } | undefined
  const marketing = s.marketing_plan as {
    strategy_summary: string
    free_first: string
    channels: Array<{ name: string; channel_type: string; priority: number; why_this_channel: string; how_to_start: string; est_cost: string; link: string | null }>
    starter_budget: { weekly_total: string; allocation: Array<{ channel: string; amount: string }>; note: string }
  } | undefined

  const competitorsCount = Array.isArray(competitors) ? competitors.length : null
  // Reports generated before the marketing step existed have no key at all —
  // hide the tab entirely rather than showing an empty panel.
  const visibleTabs = REPORT_TABS.filter(tab => tab.key !== 'marketing' || marketing !== undefined)

  function handleTabChange(key: ReportTabKey, el?: HTMLElement) {
    setActiveTab(key)
    window.scrollTo({ top: 0 })
    // Keep the tapped tab fully in view within the horizontal scroller.
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }

  function panelClass(key: ReportTabKey) {
    return activeTab === key ? 'block' : 'hidden print:block'
  }

  return (
    <div className="print-force-light max-w-3xl mx-auto px-6 py-10 print:py-4">

      {/* Tab bar */}
      <div className="sticky top-0 z-10 bg-slate-950/90 light:bg-gray-50/95 backdrop-blur -mx-6 px-6 mb-6 border-b border-white/10 light:border-gray-200 overflow-x-auto tab-scroll print:hidden">
        <div className="flex gap-0.5 whitespace-nowrap">
          {visibleTabs.map(tab => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={(e) => handleTabChange(tab.key, e.currentTarget)}
                className={`shrink-0 px-3 py-3 text-sm font-medium border-b-2 transition-colors
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

      {meta?.partial && <PartialReportBanner />}

      {/* Panel 1: Overview */}
      <div className={`${panelClass('overview')} space-y-6 break-inside-avoid`}>
        {isUnavailable(summary)
          ? <UnavailableSection title="Summary" reason={summary.reason} />
          : summary && (summary as { text: string }).text
            ? (
              <div className="rounded-2xl border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm px-5 py-5">
                <h2 className="font-semibold text-white light:text-gray-900 mb-3">Summary</h2>
                <p className="text-sm text-slate-300 light:text-gray-700 leading-relaxed"><CitedText text={(summary as { text: string }).text} /></p>
              </div>
            )
            : <UnavailableSection title="Summary" />}

        {isUnavailable(vs)
          ? <UnavailableSection title="Viability Snapshot" reason={vs.reason} />
          : vs?.scores
            ? <ViabilitySnapshot vs={vs} />
            : <UnavailableSection title="Viability Snapshot" />}

        {/* Older reports pre-date this section — render nothing rather than "unavailable" */}
        {isUnavailable(whyProceed)
          ? <UnavailableSection title="Why This Is Worth Pursuing" reason={whyProceed.reason} />
          : whyProceed?.market_proof
            ? (
              <div className="rounded-2xl border border-indigo-400/25 bg-indigo-500/5 light:bg-indigo-50/50 light:border-indigo-200 light:shadow-sm px-5 py-5">
                <h2 className="font-semibold text-white light:text-gray-900 mb-4">Why This Is Worth Pursuing</h2>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300 light:text-indigo-700 mb-1">What the market is telling you</p>
                    <p className="text-sm text-slate-300 light:text-gray-700 leading-relaxed"><CitedText text={whyProceed.market_proof} /></p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300 light:text-indigo-700 mb-1">Your edge</p>
                    <p className="text-sm text-slate-300 light:text-gray-700 leading-relaxed"><CitedText text={whyProceed.your_edge} /></p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300 light:text-indigo-700 mb-1">The upside</p>
                    <p className="text-sm text-slate-300 light:text-gray-700 leading-relaxed"><CitedText text={whyProceed.upside} /></p>
                  </div>
                </div>
              </div>
            )
            : null}
      </div>

      {/* Panel 2: Competitors */}
      <div className={`${panelClass('competitors')} space-y-6 break-inside-avoid`}>
        {competitorsInferred && (
          <InferredNote>
            Live competitor search couldn&rsquo;t be completed, so these are drawn from the model&rsquo;s own knowledge rather than verified web results. Treat them as a starting point and confirm current details before relying on them.
          </InferredNote>
        )}
        {isUnavailable(competitors)
          ? <UnavailableSection title="Competitors" reason={competitors.reason} />
          : Array.isArray(competitors) && competitors.length > 0
            ? (
              <div className="rounded-2xl border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10 light:border-gray-200">
                  <h2 className="font-semibold text-white light:text-gray-900">Competitors</h2>
                  <p className="text-xs text-slate-500 light:text-gray-400 mt-0.5">{competitors.length} {competitorsInferred ? 'listed' : 'found'}</p>
                </div>
                <div className="divide-y divide-white/10 light:divide-gray-100">
                  {(competitors as Array<Record<string, string>>).map((c, i) => (
                    <div key={i} className="px-5 py-4">
                      <div className="mb-2">
                        <div className="min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          {c.url
                            ? <a href={c.url} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-medium text-indigo-300 underline underline-offset-2 text-sm break-words">{c.name}<ExternalLinkIcon /></a>
                            : <span className="font-medium text-slate-200 light:text-gray-800 text-sm break-words">{c.name}</span>}
                          {c.kind && (
                            <span className="text-[10px] uppercase tracking-wide font-medium text-slate-400 light:text-gray-500 bg-white/5 light:bg-gray-100 rounded px-1.5 py-0.5">{c.kind}</span>
                          )}
                          <span className="text-xs text-slate-500 light:text-gray-400">{c.location}</span>
                        </div>
                        {c.pricing_summary && (
                          <p className="text-xs font-medium text-slate-300 light:text-gray-700 mt-0.5 break-words"><CitedText text={c.pricing_summary} /></p>
                        )}
                      </div>
                      {c.positioning_angle && (
                        <p className="text-sm text-slate-400 light:text-gray-500 mb-2">
                          <span className="font-medium text-slate-300 light:text-gray-700">Positioning: </span><CitedText text={c.positioning_angle} />
                        </p>
                      )}
                      {c.gap_notes && (
                        <p className="text-xs text-emerald-200 bg-emerald-500/10 border border-emerald-500/20 light:bg-emerald-50 light:border-emerald-100 light:text-emerald-800 rounded px-2 py-1.5">
                          <span className="font-medium">Gap: </span><CitedText text={c.gap_notes} />
                        </p>
                      )}
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
                              {item.note && <p className="text-xs text-slate-500 light:text-gray-400 mt-0.5"><CitedText text={item.note} /></p>}
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
                              {item.note && <p className="text-xs text-slate-500 light:text-gray-400 mt-0.5"><CitedText text={item.note} /></p>}
                            </div>
                            <span className="font-medium text-slate-200 light:text-gray-800 whitespace-nowrap">
                              {fmt0(sym, item.estimate_monthly)}/mo
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {cb.notes && <p className="text-xs text-slate-500 light:text-gray-400 leading-relaxed"><CitedText text={cb.notes} /></p>}
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
                  <p className="text-sm text-slate-300 light:text-gray-700 mb-2"><CitedText text={p.rationale} /></p>
                  <p className="text-xs text-slate-500 light:text-gray-400"><CitedText text={p.comparable_market_rates} /></p>
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
                          className="inline-flex items-center gap-1 font-medium text-indigo-300 underline underline-offset-2 text-sm break-words">{item.name}<ExternalLinkIcon /></a>
                        <FundingTypeBadge type={item.type} />
                      </div>
                      <p className="text-xs text-slate-500 light:text-gray-400 mb-2">{item.jurisdiction}</p>
                      <p className="text-sm text-slate-400 light:text-gray-500 mb-2"><CitedText text={item.summary} /></p>
                      {item.eligibility && (
                        <p className="text-xs text-slate-500 light:text-gray-400 mb-2">
                          <span className="font-medium">Eligibility: </span><CitedText text={item.eligibility} />
                        </p>
                      )}
                      {item.fit_note && (
                        <p className="text-xs text-indigo-200 bg-indigo-500/10 border border-indigo-500/20 light:bg-indigo-50 light:border-indigo-100 light:text-indigo-900 rounded px-2 py-1.5">
                          <span className="font-bold">Why this fits: </span><CitedText text={item.fit_note} />
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
        {complianceInferred && (
          <InferredNote>
            Live regulatory search couldn&rsquo;t be completed, so this is a baseline checklist from the model&rsquo;s own knowledge — not verified against official sources. Confirm each item with the relevant government body or a qualified professional before acting.
          </InferredNote>
        )}
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
                      <p className="text-sm text-slate-400 light:text-gray-500 mb-2"><CitedText text={item.summary} /></p>
                      {item.official_source_url && (
                        <a href={item.official_source_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-indigo-300 underline underline-offset-2 break-all">
                          {item.official_source_url}
                          {/* Plain inline flow (not inline-flex) — this is a long URL that
                              can wrap across lines, so the icon should ride the text flow
                              and land after the last character, not center on the block. */}
                          <ExternalLinkIcon className="w-3 h-3 ml-1 align-[-2px]" />
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

      {/* Panel 5: Getting the Word Out (marketing playbook) */}
      <div className={`${panelClass('marketing')} space-y-6 break-inside-avoid`}>
        {isUnavailable(marketing)
          ? <UnavailableSection title="Getting the Word Out" reason={marketing.reason} />
          : marketing?.strategy_summary
            ? (
              <>
                <div className="rounded-2xl border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm px-5 py-5">
                  <h2 className="font-semibold text-white light:text-gray-900 mb-3">Getting the Word Out</h2>
                  <p className="text-sm text-slate-300 light:text-gray-700 leading-relaxed mb-4"><CitedText text={marketing.strategy_summary} /></p>
                  {marketing.free_first && (
                    <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 light:bg-emerald-50 light:border-emerald-100 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200 light:text-emerald-800 mb-1">Before you spend a dollar</p>
                      <p className="text-sm text-emerald-100 light:text-emerald-900 leading-relaxed"><CitedText text={marketing.free_first} /></p>
                    </div>
                  )}
                </div>

                {Array.isArray(marketing.channels) && marketing.channels.length > 0 && (
                  <div className="rounded-2xl border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/10 light:border-gray-200">
                      <h2 className="font-semibold text-white light:text-gray-900">Channels</h2>
                      <p className="text-xs text-slate-500 light:text-gray-400 mt-0.5">In order of priority — costs are planning estimates, not quotes</p>
                    </div>
                    <div className="divide-y divide-white/10 light:divide-gray-100">
                      {[...marketing.channels].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99)).map((ch, i) => (
                        <div key={i} className="px-5 py-4 flex gap-3">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-500/15 flex items-center justify-center mt-0.5">
                            <span className="text-xs font-semibold text-indigo-300">{ch.priority ?? i + 1}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3 mb-1">
                              <p className="min-w-0 text-sm font-medium text-slate-200 light:text-gray-800">
                                {ch.link
                                  ? <a href={ch.link} target="_blank" rel="noopener noreferrer" className="text-indigo-300 underline underline-offset-2 break-words">{ch.name}<ExternalLinkIcon className="w-3 h-3 ml-1 align-[-2px]" /></a>
                                  : ch.name}
                              </p>
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${ch.channel_type === 'free'
                                ? 'bg-emerald-500/15 text-emerald-200 light:bg-emerald-100 light:text-emerald-700'
                                : 'bg-indigo-500/15 text-indigo-300 light:bg-indigo-100 light:text-indigo-700'}`}>
                                {ch.channel_type === 'free' ? 'Free' : 'Paid'}
                              </span>
                            </div>
                            <p className="text-sm text-slate-400 light:text-gray-500 mb-1"><CitedText text={ch.why_this_channel} /></p>
                            {ch.channel_type !== 'free' && ch.est_cost && (
                              <p className="text-xs text-slate-300 light:text-gray-600 mb-1">
                                <span className="font-medium text-slate-200 light:text-gray-700">Cost: </span><CitedText text={ch.est_cost} />
                              </p>
                            )}
                            {ch.how_to_start && (
                              <p className="text-xs text-indigo-200 bg-indigo-500/10 border border-indigo-500/20 light:bg-indigo-50 light:border-indigo-100 light:text-indigo-900 rounded px-2 py-1.5">
                                <span className="font-medium">How to start: </span><CitedText text={ch.how_to_start} />
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {marketing.starter_budget?.weekly_total && (
                  <div className="rounded-2xl border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm px-5 py-5">
                    <h2 className="font-semibold text-white light:text-gray-900 mb-3">Starter Budget</h2>
                    <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 light:bg-emerald-50 light:border-emerald-100 px-4 py-3 mb-3">
                      <p className="text-xs text-emerald-200 light:text-emerald-800 mb-0.5">Suggested starting spend</p>
                      <p className="text-xl font-bold text-emerald-200 light:text-emerald-800">{marketing.starter_budget.weekly_total}</p>
                    </div>
                    {Array.isArray(marketing.starter_budget.allocation) && marketing.starter_budget.allocation.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {marketing.starter_budget.allocation.map((row, i) => (
                          <div key={i} className="flex justify-between items-center text-sm">
                            <span className="text-slate-400 light:text-gray-500">{row.channel}</span>
                            <span className="font-medium text-slate-200 light:text-gray-800">{row.amount}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {marketing.starter_budget.note && (
                      <p className="text-xs text-slate-500 light:text-gray-400 leading-relaxed"><CitedText text={marketing.starter_budget.note} /></p>
                    )}
                  </div>
                )}
              </>
            )
            : null}
      </div>

      {/* Panel 6: Risks & Next Steps */}
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
                        {title && <p className="text-sm font-medium text-slate-200 light:text-gray-800 mb-1"><CitedText text={title} /></p>}
                        {description && <p className="text-sm text-slate-400 light:text-gray-500 mb-2"><CitedText text={description} /></p>}
                        {risk.mitigation && (
                          <p className="text-xs text-indigo-200 bg-indigo-500/10 border border-indigo-500/20 light:bg-indigo-50 light:border-indigo-100 light:text-indigo-900 rounded px-2 py-1.5">
                            <span className="font-medium">How to handle it: </span><CitedText text={risk.mitigation} />
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
                        <p className="text-sm text-slate-200 light:text-gray-800 mt-0.5"><CitedText text={step.action} /></p>
                        {(step.rationale ?? step.detail) && <p className="text-xs text-slate-500 light:text-gray-400 mt-1"><CitedText text={step.rationale ?? step.detail} /></p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
            : <UnavailableSection title="Next Steps" />}

        {/* Older reports pre-date this section — render nothing rather than "unavailable" */}
        {isUnavailable(validationCopy)
          ? <UnavailableSection title="Test the demand — copy, paste, post" reason={validationCopy.reason} />
          : validationCopy?.poll_question
            ? (
              <div className="rounded-2xl border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm px-5 py-5">
                <h2 className="font-semibold text-white light:text-gray-900 mb-1">Test the demand — copy, paste, post</h2>
                <p className="text-xs text-slate-500 light:text-gray-400 mb-4">Ready to paste unchanged — no editing needed.</p>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300 light:text-indigo-700 mb-1">Poll question</p>
                    <p className="text-sm text-slate-200 light:text-gray-800 font-mono bg-white/5 light:bg-gray-50 border border-white/10 light:border-gray-200 rounded-lg px-3 py-2 leading-relaxed">
                      &ldquo;<CitedText text={validationCopy.poll_question} />&rdquo;
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300 light:text-indigo-700 mb-1">Ad line</p>
                    <p className="text-sm text-slate-200 light:text-gray-800 font-mono bg-white/5 light:bg-gray-50 border border-white/10 light:border-gray-200 rounded-lg px-3 py-2 leading-relaxed">
                      &ldquo;<CitedText text={validationCopy.ad_line} />&rdquo;
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300 light:text-indigo-700 mb-1">Forum post</p>
                    <p className="text-sm text-slate-200 light:text-gray-800 font-mono bg-white/5 light:bg-gray-50 border border-white/10 light:border-gray-200 rounded-lg px-3 py-2 leading-relaxed whitespace-pre-wrap">
                      &ldquo;<CitedText text={validationCopy.forum_post} />&rdquo;
                    </p>
                  </div>
                </div>
              </div>
            )
            : null}

        {/* Older reports pre-date this section — render nothing rather than "unavailable" */}
        {isUnavailable(oneThingToDo)
          ? <UnavailableSection title="If you do nothing else, do this" reason={oneThingToDo.reason} />
          : oneThingToDo?.action
            ? (
              <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/5 light:bg-emerald-50/50 light:border-emerald-200 light:shadow-sm px-5 py-5">
                <h2 className="font-semibold text-white light:text-gray-900 mb-3">If you do nothing else, do this</h2>
                <p className="text-sm font-medium text-emerald-200 light:text-emerald-800 leading-relaxed mb-2"><CitedText text={oneThingToDo.action} /></p>
                <p className="text-sm text-slate-300 light:text-gray-700 leading-relaxed"><CitedText text={oneThingToDo.why_first} /></p>
              </div>
            )
            : null}
      </div>

    </div>
  )
}

// ── Feedback card ─────────────────────────────────────────────

function StaticStars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-1" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(i => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          className={`h-5 w-5 ${i <= rating ? 'fill-amber-400' : 'fill-white/10 light:fill-gray-200'}`}
        >
          <path d="M10 1.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L1.6 7.6l5.8-.8z" />
        </svg>
      ))}
    </div>
  )
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map(i => {
        const filled = (hover || value) >= i
        return (
          <button
            key={i}
            type="button"
            onMouseEnter={() => setHover(i)}
            onClick={() => onChange(i)}
            aria-label={`Rate ${i} star${i === 1 ? '' : 's'}`}
            className="p-0.5"
          >
            <svg viewBox="0 0 20 20" className={`h-7 w-7 transition-colors ${filled ? 'fill-amber-400' : 'fill-white/10 light:fill-gray-200'}`}>
              <path d="M10 1.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L1.6 7.6l5.8-.8z" />
            </svg>
          </button>
        )
      })}
    </div>
  )
}

function ReportFeedbackCard({ ideaId, initialFeedback }: { ideaId: string; initialFeedback: FeedbackData | null }) {
  const [rating, setRating] = useState(initialFeedback?.rating ?? 0)
  const [comment, setComment] = useState(initialFeedback?.comment ?? '')
  const [allowPublic, setAllowPublic] = useState(initialFeedback?.allow_public ?? false)
  const [saved, setSaved] = useState(!!initialFeedback)
  const [editing, setEditing] = useState(!initialFeedback)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (rating < 1) {
      setError('Pick a star rating first.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/ideas/${ideaId}/report/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment: comment.trim() || null, allow_public: allowPublic }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Could not save your feedback. Please try again.')
        return
      }
      setSaved(true)
      setEditing(false)
    } catch {
      setError('Could not save your feedback. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (saved && !editing) {
    return (
      <div className="max-w-3xl mx-auto px-6 print:hidden">
        <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/5 light:bg-emerald-50/50 light:border-emerald-200 light:shadow-sm px-5 py-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-emerald-200 light:text-emerald-800">Thanks for the feedback!</p>
            <div className="mt-1.5"><StaticStars rating={rating} /></div>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-slate-400 hover:text-white light:text-gray-500 light:hover:text-gray-900 underline underline-offset-2 flex-shrink-0"
          >
            Edit
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-6 print:hidden">
      <div className="rounded-2xl border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm px-5 py-5">
        <h2 className="font-semibold text-white light:text-gray-900 mb-1">How did we do?</h2>
        <p className="text-xs text-slate-500 light:text-gray-400 mb-4">Your rating helps us keep improving these reports.</p>

        <StarPicker value={rating} onChange={setRating} />

        <textarea
          value={comment ?? ''}
          onChange={e => setComment(e.target.value)}
          placeholder="Anything that stood out? (optional)"
          rows={3}
          className="mt-4 w-full rounded-lg border border-white/10 bg-white/5 light:bg-gray-50 light:border-gray-200 px-3 py-2 text-sm text-slate-200 light:text-gray-800 placeholder:text-slate-500 light:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />

        <label className="mt-3 flex items-start gap-2 text-xs text-slate-400 light:text-gray-500">
          <input
            type="checkbox"
            checked={allowPublic}
            onChange={e => setAllowPublic(e.target.checked)}
            className="mt-0.5"
          />
          You may quote my feedback publicly (first name and last initial only)
        </label>

        {error && <p className="mt-2 text-xs text-red-300 light:text-red-600">{error}</p>}

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-lg bg-indigo-500 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-400 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : saved ? 'Save changes' : 'Submit feedback'}
          </button>
          {saved && (
            <button
              onClick={() => setEditing(false)}
              className="text-xs text-slate-400 hover:text-white light:text-gray-500 light:hover:text-gray-900 underline underline-offset-2"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Action buttons ────────────────────────────────────────────

function DownloadPdfButton({ ideaId }: { ideaId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleClick() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/ideas/${ideaId}/report/pdf`)
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? 'Could not generate the PDF. Please try again.')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `idea-engine-report-${ideaId.slice(0, 8)}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setError('Could not generate the PDF. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
        {loading ? 'Preparing PDF…' : 'Download PDF'}
      </button>
      {error && <p className="text-xs text-red-300 light:text-red-600">{error}</p>}
    </div>
  )
}

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
      'Estimated cost: ~US$0.40–0.90 hybrid routing (more if a specific model is set in admin Settings)\n\nContinue?'
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
        Runs the full research pipeline. ~US$0.40–0.90 per run (hybrid routing).
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

// FTC/ASA affiliate disclosure — rendered unconditionally wherever report
// content (which may contain rewritten /go/ affiliate links) is shown.
function AffiliateDisclosure() {
  return (
    <p className="text-xs text-slate-500 light:text-gray-400 text-center max-w-3xl mx-auto px-6">
      Some links in this report may be affiliate links. They never affect our recommendations.
    </p>
  )
}

export default function ReportClient({ ideaId, restatement, initialReport, initialFeedback, isAdmin, promoStatus }: Props) {
  const [report, setReport] = useState<ReportData | null>(initialReport)
  const [regenerating, setRegenerating] = useState(false)

  const hasFullSections = report?.status === 'complete' && Object.keys(report.sections).length > 0
  const reportMeta = report?.sections?._meta as { cost_usd?: number; model?: string } | undefined
  const generationCost = reportMeta?.cost_usd
  const generationModel = reportMeta?.model

  if (hasFullSections && !regenerating) {
    return (
      <div>
        <FullReportViewer report={report!} />
        <div className="mb-8">
          <ReportFeedbackCard ideaId={ideaId} initialFeedback={initialFeedback} />
        </div>
        <div className="max-w-3xl mx-auto px-6 pb-8 flex flex-col items-center gap-3 print:hidden">
          <DownloadPdfButton ideaId={ideaId} />
          {isAdmin && generationCost !== undefined && (
            <p className="text-xs text-slate-500 light:text-gray-400">
              Generation cost: US${generationCost.toFixed(2)}
              {generationModel && <span> · {generationModel}</span>}
            </p>
          )}
          <RegenerateButton ideaId={ideaId} label="Regenerate initial report" onStart={() => { setRegenerating(true); setReport(null) }} />
          <Link
            href={`/app/ideas/${ideaId}/summary`}
            className="text-xs text-slate-400 hover:text-white light:text-gray-500 light:hover:text-gray-900 underline underline-offset-2"
          >
            Review / edit answers
          </Link>
          <AffiliateDisclosure />
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
          promoStatus={promoStatus}
          onGenerateFull={() => { setRegenerating(true); setReport(null) }}
        />
        <div className="max-w-3xl mx-auto px-6 pb-8 flex flex-col items-center gap-2 print:hidden">
          <RegenerateButton ideaId={ideaId} label="Regenerate initial report" onStart={() => { setRegenerating(true); setReport(null) }} />
          <Link
            href={`/app/ideas/${ideaId}/summary`}
            className="text-xs text-slate-400 hover:text-white light:text-gray-500 light:hover:text-gray-900 underline underline-offset-2"
          >
            Review / edit answers
          </Link>
          <AffiliateDisclosure />
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
