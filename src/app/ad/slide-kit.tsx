import type { ReactNode } from 'react'
import { ScoreRing } from '@/components/score-ring'

// ── Shared building blocks for ad-campaign slides ────────────────────────
//
// Every campaign under src/app/ad/campaigns/*.tsx assembles its 1080×1920
// (9:16) frames from these pieces. Copy rules apply to ALL campaigns: only
// claims the product actually delivers, no invented stats, no DEMO_STATS
// numbers. Visuals reuse the real product components (ScoreRing, report-card
// styling) so the videos show exactly what a buyer gets.

/** ScoreRing with a video-legible label (the component's own label is 10px —
 *  fine in-app, unreadable in a phone-width video frame). */
export function AdRing({ score, label, size = 120 }: { score: number; label: string; size?: number }) {
  return (
    <div className="flex flex-col items-center gap-3" style={{ width: size + 40 }}>
      <ScoreRing score={score} label="" size={size} />
      <span className="text-center text-[26px] leading-tight text-slate-400">{label}</span>
    </div>
  )
}

export function SlideShell({ children, footer = true }: { children: ReactNode; footer?: boolean }) {
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 dot-grid opacity-40" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-48 -top-48 h-[760px] w-[760px] rounded-full bg-indigo-600/30 blur-3xl" />
        <div className="absolute -bottom-48 -right-48 h-[760px] w-[760px] rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute right-[-200px] top-1/3 h-[500px] w-[500px] rounded-full bg-violet-600/20 blur-3xl" />
      </div>
      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-24 pt-32 wide:px-32 short:pt-14">{children}</div>
      {footer && (
        <div className="relative z-10 flex items-baseline justify-center gap-5 pb-24 short:pb-10">
          <span className="text-[40px] font-bold tracking-tight">HadIdea</span>
          <span className="text-[32px] text-slate-400">hadidea.com</span>
        </div>
      )}
    </div>
  )
}

// ── Report cards (mirror the homepage marquee card) ──────────────────────

export interface AdCard {
  title: string
  location: string
  score: number
  success: number
  competitors: number
  cost: string
  rotate: string
}

export function AdReportCard({ card }: { card: AdCard }) {
  return (
    <div className={`w-[620px] wide:w-[520px] rounded-3xl border border-white/10 bg-slate-900/90 p-8 short:p-7 shadow-2xl shadow-black/40 backdrop-blur ${card.rotate}`}>
      <p className="text-[32px] font-semibold leading-tight text-white">{card.title}</p>
      <p className="mt-1 text-[23px] text-slate-400">{card.location}</p>
      <div className="mt-5 flex items-start justify-around gap-4">
        <AdRing score={card.score} label="Viability" size={110} />
        <AdRing score={card.success} label="Success outlook" size={110} />
      </div>
      <div className="mt-5 flex items-center gap-4">
        <span className="inline-flex items-center rounded-full bg-indigo-500/15 px-5 py-2 text-[22px] font-medium text-indigo-300">
          {card.competitors} competitors found
        </span>
        <span className="text-[22px] text-slate-400">{card.cost} startup est.</span>
      </div>
    </div>
  )
}

/** Three staggered cards — the "every idea gets scored" visual. Portrait
 *  stacks them; wide puts them in a row with alternating vertical offsets. */
export function StaggeredCards({ cards }: { cards: [AdCard, AdCard, AdCard] }) {
  return (
    <div className="mt-12 flex flex-col gap-7 short:mt-8 square:gap-5 wide:flex-row wide:items-center wide:justify-center wide:gap-8">
      <div className="self-start wide:self-auto wide:-translate-y-4"><AdReportCard card={cards[0]} /></div>
      <div className="self-end wide:self-auto wide:translate-y-4"><AdReportCard card={cards[1]} /></div>
      {/* Square (1080×1080) only has room for two cards — the third hides. */}
      <div className="self-start wide:self-auto wide:-translate-y-4 square:hidden"><AdReportCard card={cards[2]} /></div>
    </div>
  )
}

/** Shared closing slide — brand, headline, button, url. Both orientations. */
export function CtaSlide({ headline, button, sub }: { headline: ReactNode; button: string; sub?: string }) {
  return (
    <SlideShell footer={false}>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="text-[64px] font-bold tracking-tight short:text-[54px]">HadIdea</p>
        <h2 className="mt-14 text-[92px] font-bold leading-[1.1] tracking-tight short:mt-8 short:text-[84px]">
          {headline}
        </h2>
        <span className="mt-24 rounded-2xl bg-indigo-500 px-16 py-8 text-[40px] font-semibold text-white shadow-2xl shadow-indigo-500/40 short:mt-12 wide:px-14 wide:py-6">
          {button}
        </span>
        {sub && <p className="mt-10 text-[34px] text-slate-400 short:mt-6">{sub}</p>}
        <p className="mt-24 text-[52px] font-semibold tracking-tight text-slate-200 short:mt-10">hadidea.com</p>
      </div>
    </SlideShell>
  )
}

// ── Inside-the-report mocks ──────────────────────────────────────────────

export function DimensionBar({ label, score, note }: { label: string; score: number; note: string }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[28px] text-slate-300">{label}</span>
        <span className="text-[28px] font-semibold text-slate-200">{score}/5</span>
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className={`h-4 flex-1 rounded-full ${i <= score ? 'bg-indigo-400' : 'bg-white/10'}`} />
        ))}
      </div>
      <p className="mt-2 text-[23px] leading-snug text-slate-500">{note}</p>
    </div>
  )
}

export function GlanceTile({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-6">
      {children}
      <span className="text-center text-[24px] leading-tight text-slate-400">{label}</span>
    </div>
  )
}

export function CheckRow({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="flex items-start gap-6">
      <svg className="mt-1.5 h-12 w-12 flex-shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
      <div>
        <p className="text-[36px] font-semibold leading-tight text-white">{title}</p>
        {/* Square keeps titles only — detail lines don't fit 1080px of height,
            and a 1:1 feed ad reads better with less text anyway. */}
        {detail && <p className="mt-1 text-[27px] leading-snug text-slate-400 square:hidden">{detail}</p>}
      </div>
    </div>
  )
}

/** A competitor row with the NAME deliberately redacted (blurred skeleton) —
 *  ad frames must never show real or realistic business names, only the
 *  structure of what a report row contains. Same policy as the homepage's
 *  redacted marquee cards. */
export function RedactedCompetitorRow({ price, gap }: { price: string; gap: string }) {
  return (
    <div className="flex items-center gap-6 rounded-2xl border border-white/10 bg-slate-900/80 px-8 py-6">
      <div className="h-7 w-[200px] rounded-full bg-white/15 blur-[3px]" aria-hidden="true" />
      <span className="text-[28px] font-semibold text-slate-200">{price}</span>
      <span className="ml-auto inline-flex items-center rounded-full bg-emerald-500/15 px-5 py-2 text-[23px] font-medium text-emerald-300">
        gap: {gap}
      </span>
    </div>
  )
}

export type Slide = { title: string; node: ReactNode }
