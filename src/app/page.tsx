import Link from 'next/link'
import { ScrollReveal } from '@/components/scroll-reveal'

// TODO: replace with real numbers before production launch
const DEMO_STATS = {
  ideasLast30Days: '1,200+',
  reportsGenerated: '4,800+',
  avgTimeToReport: '6 min',
}

interface ReportCardData {
  /** For redacted cards this is NONSENSE filler with title-like rhythm —
      CSS blur is trivially removable in devtools, so the underlying text
      must never be (or resemble) a real idea. */
  title: string
  /** Redacted cards show location separately and keep it visible, so
      visitors still see the engine is used worldwide. */
  location?: string
  score: number
  competitors: number
  cost: string
  rotate: string
  /** Presence makes this a redacted card; the label explains why. */
  redactedLabel?: string
}

const REPORT_CARDS: ReportCardData[] = [
  {
    title: 'Homemade pet treats — Brisbane',
    score: 78,
    competitors: 14,
    cost: '$3,200',
    rotate: '-rotate-1',
  },
  {
    title: 'Mobile car detailing — Austin',
    score: 64,
    competitors: 9,
    cost: '$6,800',
    rotate: 'rotate-1',
  },
  {
    title: 'Kids coding classes — Manchester',
    score: 82,
    competitors: 6,
    cost: '$2,150',
    rotate: '-rotate-1',
  },
  {
    title: 'Refillable cleaning co. — Portland',
    score: 71,
    competitors: 11,
    cost: '$4,900',
    rotate: 'rotate-1',
  },
  {
    title: 'Selvet marlin ratchet coil',
    location: 'Perth, Australia',
    score: 74,
    competitors: 12,
    cost: '$18,500',
    rotate: '-rotate-1',
    redactedLabel: 'Invention — details kept private',
  },
  {
    title: 'Vintage furniture flip — Leeds',
    score: 59,
    competitors: 17,
    cost: '$1,800',
    rotate: 'rotate-1',
  },
  {
    title: 'Meal-prep delivery — Denver',
    score: 87,
    competitors: 8,
    cost: '$8,400',
    rotate: 'rotate-1',
  },
  {
    title: 'Copper lantern biscuit fen',
    location: 'Oslo, Norway',
    score: 81,
    competitors: 7,
    cost: '$5,600',
    rotate: '-rotate-1',
    redactedLabel: "Details kept secret at user's request",
  },
]

const WHAT_WE_DO_STEPS = [
  {
    number: '01',
    title: 'Describe your idea',
    description: 'Type your raw business idea in plain English — no forms, no jargon required.',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
      />
    ),
  },
  {
    number: '02',
    title: 'Answer smart questions',
    description: 'We classify your idea and ask a handful of targeted follow-up questions to sharpen it.',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zM12 17.25h.007v.008H12v-.008z"
      />
    ),
  },
  {
    number: '03',
    title: 'We research the market',
    description: 'Real competitor research via live web search, cost estimates, and legal/compliance checks.',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
      />
    ),
  },
  {
    number: '04',
    title: 'Get your action plan',
    description: 'Receive a structured opportunity report with funding options and prioritised next steps.',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    ),
  },
]

const REPORT_FEATURES = [
  {
    title: 'Real competitors with links',
    description: 'Live web research surfaces actual businesses in your space, not guesses.',
  },
  {
    title: 'Cost & profit breakdown',
    description: 'Startup costs, ongoing expenses, and realistic margin estimates.',
  },
  {
    title: 'Legal & compliance checklist',
    description: 'Official links to licences, permits, and regulations that apply to you.',
  },
  {
    title: 'Funding options',
    description: 'Grants, loans, and financing paths matched to your idea and location.',
  },
  {
    title: 'Risk register',
    description: 'The failure points most likely to sink ideas like yours — named up front.',
  },
  {
    title: 'Prioritised next steps',
    description: 'A clear, ordered checklist so you know exactly what to do first.',
  },
]

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-white/10">
      <div
        className="h-1.5 rounded-full bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400"
        style={{ width: `${score}%` }}
      />
    </div>
  )
}

function ReportCard({ card }: { card: ReportCardData }) {
  return (
    <div
      className={`w-[280px] shrink-0 rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-xl shadow-black/30 backdrop-blur transition-transform duration-300 hover:-translate-y-1 hover:shadow-2xl ${card.rotate}`}
    >
      {card.redactedLabel ? (
        <div className="mb-3">
          <p className="select-none text-sm font-semibold text-white blur-[5px]" aria-hidden="true">
            {card.title}
          </p>
          <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-violet-300">
            <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
            {card.redactedLabel}
          </p>
          {card.location && (
            <p className="mt-0.5 text-[11px] text-slate-400">{card.location}</p>
          )}
        </div>
      ) : (
        <p className="mb-3 text-sm font-semibold text-white">{card.title}</p>
      )}

      <div className="mb-3 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>Viability score</span>
          <span className="font-medium text-slate-200">{card.score}/100</span>
        </div>
        <ScoreBar score={card.score} />
      </div>

      <div className="mb-3 space-y-1.5 select-none blur-[3px]" aria-hidden="true">
        <div className="h-2 w-full rounded bg-white/10" />
        <div className="h-2 w-5/6 rounded bg-white/10" />
        <div className="h-2 w-4/6 rounded bg-white/10" />
      </div>

      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-indigo-500/15 px-2.5 py-1 text-[11px] font-medium text-indigo-300">
          {card.competitors} competitors found
        </span>
        <span className="select-none blur-[3px] text-[11px] text-slate-400" aria-hidden="true">
          {card.cost} est.
        </span>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const year = new Date().getFullYear()

  return (
    <div className="flex flex-col min-h-screen bg-white text-gray-900">
      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                               */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden bg-slate-950">
        <div className="absolute inset-0 dot-grid opacity-40" aria-hidden="true" />

        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="animate-blob-1 absolute -top-32 -left-24 h-96 w-96 rounded-full bg-indigo-600/40 blur-3xl" />
          <div className="animate-blob-2 absolute top-1/3 -right-24 h-[28rem] w-[28rem] rounded-full bg-violet-600/30 blur-3xl" />
          <div className="animate-blob-3 absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-cyan-500/25 blur-3xl" />
        </div>

        <header className="relative z-10 px-6 py-5 flex items-center justify-between">
          <span className="font-semibold tracking-tight text-white">Idea Engine</span>
          <Link
            href="/sign-in"
            className="text-sm text-slate-200 hover:text-white font-medium transition-colors"
          >
            Sign in
          </Link>
        </header>

        <div className="relative z-10 flex flex-col items-center px-6 pt-16 pb-28 text-center sm:pt-20 sm:pb-36">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-slate-200 backdrop-blur">
            <span className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-indigo-400" aria-hidden="true" />
            {DEMO_STATS.ideasLast30Days} ideas became reality in the last 30 days
          </div>

          <h1 className="max-w-3xl text-4xl font-bold leading-tight text-white sm:text-6xl">
            From raw idea to{' '}
            <span className="gradient-text">real-world plan</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg text-slate-400">
            Describe your business idea. We classify it, ask the right questions, research your
            market with live web search, and deliver a structured report — competitors, costs,
            legal, and funding included.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
            <Link
              href="/sign-in"
              className="inline-block rounded-lg bg-indigo-500 px-7 py-3.5 text-sm font-semibold text-white
                         shadow-lg shadow-indigo-500/40 transition-all duration-200 hover:scale-105 hover:bg-indigo-400
                         focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              Get early access
            </Link>
            <a
              href="#how-it-works"
              className="inline-block rounded-lg border border-white/15 px-7 py-3.5 text-sm font-semibold text-slate-100
                         transition-colors hover:border-white/30 hover:bg-white/5"
            >
              See how it works
            </a>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Fuzzed report showcase                                             */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative -mt-16 bg-slate-950 pb-24 sm:-mt-20">
        <div className="marquee-group overflow-hidden py-4 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
          {/* One animated track holding two identical card sets. Each set
              carries its own internal gap AND trailing padding equal to that
              gap (pr-5), so translateX(-50%) lands exactly on the seam and
              the loop is continuous with no visible jump. */}
          <div className="marquee-track flex w-max">
            <div className="flex shrink-0 gap-5 pr-5">
              {REPORT_CARDS.map((card) => (
                <ReportCard key={card.title} card={card} />
              ))}
            </div>
            <div className="flex shrink-0 gap-5 pr-5" aria-hidden="true">
              {REPORT_CARDS.map((card) => (
                <ReportCard key={`${card.title}-dup`} card={card} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* What we do                                                         */}
      {/* ------------------------------------------------------------------ */}
      <section
        id="how-it-works"
        className="relative bg-gradient-to-b from-slate-950 via-slate-950 to-gray-50 px-6 pb-24 pt-4 sm:pt-8"
      >
        <div className="mx-auto max-w-6xl">
          <ScrollReveal className="mb-14 text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">What we do</h2>
            <p className="mt-3 text-slate-400">Four steps between a raw idea and a real plan.</p>
          </ScrollReveal>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {WHAT_WE_DO_STEPS.map((step, i) => (
              <ScrollReveal key={step.number} delayMs={i * 100}>
                <div className="group h-full rounded-2xl border border-slate-800 bg-slate-900/60 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-400/50 hover:shadow-lg hover:shadow-indigo-500/10">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-xs font-semibold text-indigo-400">{step.number}</span>
                    <svg
                      className="h-6 w-6 text-slate-400 transition-colors group-hover:text-indigo-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      {step.icon}
                    </svg>
                  </div>
                  <h3 className="mb-2 text-base font-semibold text-white">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-400">{step.description}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Report anatomy                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-gray-50 px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <ScrollReveal className="mb-14 text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Every report includes</h2>
            <p className="mt-3 text-gray-500">No fluff. Just what you need to decide and move.</p>
          </ScrollReveal>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {REPORT_FEATURES.map((feature, i) => (
              <ScrollReveal key={feature.title} delayMs={i * 60}>
                <div className="flex h-full items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{feature.title}</h3>
                    <p className="mt-1 text-sm text-gray-500">{feature.description}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Bottom CTA band                                                    */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden bg-slate-950 px-6 py-24 text-center">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="animate-blob-1 absolute -top-20 left-1/4 h-72 w-72 rounded-full bg-indigo-600/30 blur-3xl" />
          <div className="animate-blob-2 absolute -bottom-20 right-1/4 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-2xl">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Stop guessing. Start with a plan.
          </h2>
          <div className="mt-8 flex flex-col items-center gap-3">
            <Link
              href="/sign-in"
              className="inline-block rounded-lg bg-indigo-500 px-7 py-3.5 text-sm font-semibold text-white
                         shadow-lg shadow-indigo-500/40 transition-all duration-200 hover:scale-105 hover:bg-indigo-400
                         focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              Get early access
            </Link>
            <p className="text-xs text-slate-500">No credit card required — join the early list</p>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-100 bg-white px-6 py-5 text-center text-xs text-gray-400">
        © {year} Idea Engine. All rights reserved.
      </footer>
    </div>
  )
}
