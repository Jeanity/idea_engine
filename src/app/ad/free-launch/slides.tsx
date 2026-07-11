import type { ReactNode } from 'react'
import { ScoreRing } from '@/components/score-ring'

// ── Ad-campaign slides: "first 1,000 plans free" ─────────────────────────
//
// Each slide is a fixed 1080×1920 (9:16) frame meant to be screenshotted and
// dropped into the slideshow video app. Copy rules: only claims the product
// actually delivers (live web search, competitors with prices, costs, legal,
// funding options, the 1,000-free launch offer) — no invented stats, no
// DEMO_STATS numbers. Visuals reuse the real product components (ScoreRing,
// report-card styling) so the video shows exactly what a buyer gets.

/** ScoreRing with a video-legible label (the component's own label is 10px —
 *  fine in-app, unreadable in a phone-width video frame). */
function AdRing({ score, label, size = 120 }: { score: number; label: string; size?: number }) {
  return (
    <div className="flex flex-col items-center gap-3" style={{ width: size + 40 }}>
      <ScoreRing score={score} label="" size={size} />
      <span className="text-center text-[26px] leading-tight text-slate-400">{label}</span>
    </div>
  )
}

function SlideShell({ children, footer = true }: { children: ReactNode; footer?: boolean }) {
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 dot-grid opacity-40" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-48 -top-48 h-[760px] w-[760px] rounded-full bg-indigo-600/30 blur-3xl" />
        <div className="absolute -bottom-48 -right-48 h-[760px] w-[760px] rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute right-[-200px] top-1/3 h-[500px] w-[500px] rounded-full bg-violet-600/20 blur-3xl" />
      </div>
      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-24 pt-32">{children}</div>
      {footer && (
        <div className="relative z-10 flex items-baseline justify-center gap-5 pb-24">
          <span className="text-[40px] font-bold tracking-tight">HadIdea</span>
          <span className="text-[32px] text-slate-400">hadidea.com</span>
        </div>
      )}
    </div>
  )
}

// ── Slide 4 building block: the report cards founders see on the site ────

interface AdCard {
  title: string
  location: string
  score: number
  success: number
  competitors: number
  cost: string
  rotate: string
}

const AD_CARDS: AdCard[] = [
  { title: 'Homemade pet treats', location: 'Brisbane, Australia', score: 78, success: 72, competitors: 14, cost: '$3,200', rotate: '-rotate-2' },
  { title: 'Meal-prep delivery', location: 'Denver, USA', score: 87, success: 83, competitors: 8, cost: '$8,400', rotate: 'rotate-1' },
  { title: 'Mobile car detailing', location: 'Austin, USA', score: 64, success: 58, competitors: 9, cost: '$6,800', rotate: '-rotate-1' },
]

function AdReportCard({ card }: { card: AdCard }) {
  return (
    <div className={`w-[620px] rounded-3xl border border-white/10 bg-slate-900/90 p-8 shadow-2xl shadow-black/40 backdrop-blur ${card.rotate}`}>
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

// ── Slide 5 building blocks: inside-the-report mocks ─────────────────────

function DimensionBar({ label, score, note }: { label: string; score: number; note: string }) {
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

function GlanceTile({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-6">
      {children}
      <span className="text-center text-[24px] leading-tight text-slate-400">{label}</span>
    </div>
  )
}

// ── Slide 3 / 6 building block: checklist row ────────────────────────────

function CheckRow({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="flex items-start gap-6">
      <svg className="mt-1.5 h-12 w-12 flex-shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
      <div>
        <p className="text-[36px] font-semibold leading-tight text-white">{title}</p>
        {detail && <p className="mt-1 text-[27px] leading-snug text-slate-400">{detail}</p>}
      </div>
    </div>
  )
}

// ── The slides ───────────────────────────────────────────────────────────

export const SLIDES: Array<{ title: string; node: ReactNode }> = [
  {
    title: 'Hook',
    node: (
      <SlideShell>
        <div className="flex flex-1 flex-col justify-center">
          <p className="text-[46px] font-medium text-slate-400">You know that business idea</p>
          <p className="mt-2 text-[46px] font-medium text-slate-400">you keep thinking about?</p>
          <h1 className="mt-16 text-[110px] font-bold leading-[1.05] tracking-tight">
            Find out if it{' '}
            <span className="gradient-text">actually works.</span>
          </h1>
          <p className="mt-16 text-[40px] leading-snug text-slate-300">
            Before you spend a dollar on it.
          </p>
        </div>
      </SlideShell>
    ),
  },
  {
    title: 'Describe it',
    node: (
      <SlideShell>
        <div className="flex flex-1 flex-col justify-center">
          <h2 className="text-[84px] font-bold leading-tight tracking-tight">
            Describe your idea in <span className="gradient-text">plain English.</span>
          </h2>
          <div className="mt-20 rounded-3xl border border-white/15 bg-slate-900/90 p-12 shadow-2xl shadow-black/40">
            <p className="text-[36px] leading-relaxed text-slate-200">
              &ldquo;I want to sell homemade pet treats at weekend markets in Brisbane&rdquo;
            </p>
            <div className="mt-10 flex justify-end">
              <span className="rounded-xl bg-indigo-500 px-10 py-5 text-[30px] font-semibold text-white shadow-lg shadow-indigo-500/40">
                Analyse my idea
              </span>
            </div>
          </div>
          <p className="mt-14 text-[36px] text-slate-400">No forms. No jargon. No pitch deck.</p>
        </div>
      </SlideShell>
    ),
  },
  {
    title: 'Real research',
    node: (
      <SlideShell>
        <div className="flex flex-1 flex-col justify-center">
          <h2 className="text-[84px] font-bold leading-tight tracking-tight">
            Then we research it. <span className="gradient-text">For real.</span>
          </h2>
          <div className="mt-20 space-y-12">
            <CheckRow title="Live web search" detail="Not a canned template — research runs when you ask." />
            <CheckRow title="Real competitors and their prices" detail="Who already does this near you, and what they charge." />
            <CheckRow title="Startup and running costs" detail="What it takes to open the doors, and to keep them open." />
            <CheckRow title="Legal for your country" detail="Permits, registrations, and rules that apply where you live." />
            <CheckRow title="Funding options" detail="If your budget falls short, we find the programs that bridge it." />
          </div>
        </div>
      </SlideShell>
    ),
  },
  {
    title: 'Scored cards',
    node: (
      <SlideShell>
        <div className="flex flex-1 flex-col justify-center">
          <h2 className="text-center text-[76px] font-bold leading-tight tracking-tight">
            Every idea gets <span className="gradient-text">scored.</span>
          </h2>
          <div className="mt-12 flex flex-col gap-7">
            <div className="self-start"><AdReportCard card={AD_CARDS[0]} /></div>
            <div className="self-end"><AdReportCard card={AD_CARDS[1]} /></div>
            <div className="self-start"><AdReportCard card={AD_CARDS[2]} /></div>
          </div>
        </div>
      </SlideShell>
    ),
  },
  {
    title: 'Inside the report',
    node: (
      <SlideShell>
        <div className="flex flex-1 flex-col justify-center">
          <h2 className="text-[76px] font-bold leading-tight tracking-tight">
            Inside your <span className="gradient-text">report.</span>
          </h2>
          <div className="mt-16 rounded-3xl border border-white/10 bg-slate-900/90 p-12">
            <div className="flex items-center gap-8">
              <div className="flex items-start gap-8">
                <AdRing score={78} label="Viability" size={140} />
                <AdRing score={72} label="Success outlook" size={140} />
              </div>
              <p className="text-[38px] font-semibold">Viability Snapshot</p>
            </div>
            <div className="mt-12 space-y-10">
              <DimensionBar label="Market opportunity" score={4} note="14 competitors selling out at Brisbane weekend markets proves people already pay for this." />
              <DimensionBar label="Time to revenue" score={2} note="With council registration done, first sales are weeks away — not months." />
            </div>
          </div>
          <div className="mt-10 grid grid-cols-4 gap-6">
            <GlanceTile label="Demand evidence"><ScoreRing score={84} label="" size={110} /></GlanceTile>
            <GlanceTile label="Edge strength"><ScoreRing score={68} label="" size={110} /></GlanceTile>
            <GlanceTile label="Gross margin"><ScoreRing score={73} label="" size={110} /></GlanceTile>
            <GlanceTile label="Budget fit">
              <div className="flex h-[110px] flex-col items-center justify-center gap-4">
                <span className="text-[30px] font-semibold text-amber-300">Partway there</span>
                <div className="flex w-[120px] gap-1.5">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className={`h-3 flex-1 rounded-full ${i <= 2 ? 'bg-amber-400' : 'bg-white/10'}`} />
                  ))}
                </div>
              </div>
            </GlanceTile>
          </div>
        </div>
      </SlideShell>
    ),
  },
  {
    title: 'Everything you get',
    node: (
      <SlideShell>
        <div className="flex flex-1 flex-col justify-center">
          <h2 className="text-[76px] font-bold leading-tight tracking-tight">
            One report. <span className="gradient-text">Everything you need.</span>
          </h2>
          <div className="mt-16 space-y-10">
            <CheckRow title="Competitor breakdown" detail="Real businesses, real prices, and the gap you can own." />
            <CheckRow title="Cost and margin math" detail="Startup costs, running costs, and what each sale really earns." />
            <CheckRow title="Legal and permit checklist" detail="Specific to your country — with links to official sources." />
            <CheckRow title="Pricing recommendation" detail="Anchored to what your competitors actually charge." />
            <CheckRow title="Risks with mitigations" detail="Facts to weigh and how to handle them — not vague warnings." />
            <CheckRow title="A week-one action plan" detail="Ordered next steps with honest timeframes." />
            <CheckRow title="Paste-ready demand tests" detail="Poll, ad line, and forum post written in your voice." />
          </div>
        </div>
      </SlideShell>
    ),
  },
  {
    title: 'The offer',
    node: (
      <SlideShell>
        <div className="flex flex-1 flex-col justify-center">
          <p className="text-[44px] font-medium text-slate-400">We just launched, so —</p>
          <h2 className="mt-12 text-[104px] font-bold leading-[1.08] tracking-tight">
            The first <span className="gradient-text">1,000 plans</span> are free.
          </h2>
          <div className="mt-20 space-y-8">
            <p className="text-[40px] leading-snug text-slate-300">No card. No catch.</p>
            <p className="text-[40px] leading-snug text-slate-300">
              Generate your plan, then tell us what we got wrong — your feedback shapes the product.
            </p>
          </div>
        </div>
      </SlideShell>
    ),
  },
  {
    title: 'CTA',
    node: (
      <SlideShell footer={false}>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-[64px] font-bold tracking-tight">HadIdea</p>
          <h2 className="mt-14 text-[92px] font-bold leading-[1.1] tracking-tight">
            From raw idea to <span className="gradient-text">real-world plan.</span>
          </h2>
          <span className="mt-24 rounded-2xl bg-indigo-500 px-16 py-8 text-[40px] font-semibold text-white shadow-2xl shadow-indigo-500/40">
            Get your free plan
          </span>
          <p className="mt-10 text-[34px] text-slate-400">Free for the first 1,000 founders</p>
          <p className="mt-24 text-[52px] font-semibold tracking-tight text-slate-200">hadidea.com</p>
        </div>
      </SlideShell>
    ),
  },
]
