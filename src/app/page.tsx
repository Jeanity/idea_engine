import Link from 'next/link'
import { HeaderAuthLink } from '@/components/header-auth-link'
import { ScrollReveal } from '@/components/scroll-reveal'
import { ThemeToggle } from '@/components/theme-toggle'
import { ScoreRing } from '@/components/score-ring'
import { SiteFooter } from '@/components/site-footer'
import { OfferBanners, type BannerOffer } from '@/components/offer-banner'
import { DEMO_STATS } from '@/lib/demo-stats'
import { createPublicClient, createServiceClient } from '@/lib/db'
import { ARCHETYPE_LABELS } from '@/lib/archetype-labels'
import { toPublicDisplayName } from '@/lib/public-name'

// Revalidate periodically (ISR) rather than once at build time — otherwise an
// admin featuring/unfeaturing testimonials wouldn't show up until the next
// deploy.
export const revalidate = 60

interface ReportCardData {
  /** For redacted cards this is NONSENSE filler with title-like rhythm —
      CSS blur is trivially removable in devtools, so the underlying text
      must never be (or resemble) a real idea. */
  title: string
  /** Rendered on its own line under the title on every card; stays
      visible even on redacted cards so visitors see worldwide usage. */
  location: string
  score: number
  /** Secondary "Success outlook" ring — a demo value, plausibly near
      (above or below) the viability score. */
  success: number
  competitors: number
  cost: string
  rotate: string
  /** Presence makes this a redacted card; the label explains why. */
  redactedLabel?: string
}

const REPORT_CARDS: ReportCardData[] = [
  {
    title: 'Homemade pet treats',
    location: 'Brisbane, Australia',
    score: 78,
    success: 72,
    competitors: 14,
    cost: '$3,200',
    rotate: '-rotate-1',
  },
  {
    title: 'Mobile car detailing',
    location: 'Austin, USA',
    score: 64,
    success: 58,
    competitors: 9,
    cost: '$6,800',
    rotate: 'rotate-1',
  },
  {
    title: 'Kids coding classes',
    location: 'Manchester, UK',
    score: 82,
    success: 79,
    competitors: 6,
    cost: '$2,150',
    rotate: '-rotate-1',
  },
  {
    title: 'Refillable cleaning co.',
    location: 'Portland, USA',
    score: 71,
    success: 63,
    competitors: 11,
    cost: '$4,900',
    rotate: 'rotate-1',
  },
  {
    title: 'Selvet marlin ratchet coil',
    location: 'Perth, Australia',
    score: 74,
    success: 68,
    competitors: 12,
    cost: '$18,500',
    rotate: '-rotate-1',
    redactedLabel: 'Invention — details kept private',
  },
  {
    title: 'Vintage furniture flip',
    location: 'Leeds, UK',
    score: 59,
    success: 61,
    competitors: 17,
    cost: '$1,800',
    rotate: 'rotate-1',
  },
  {
    title: 'Meal-prep delivery',
    location: 'Denver, USA',
    score: 87,
    success: 83,
    competitors: 8,
    cost: '$8,400',
    rotate: 'rotate-1',
  },
  {
    title: 'Copper lantern biscuit fen',
    location: 'Oslo, Norway',
    score: 81,
    success: 77,
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
    title: 'Things to consider',
    description: 'Competitor density, costs, and effort factors named up front — each with how to handle it.',
  },
  {
    title: 'Prioritised next steps',
    description: 'A clear, ordered checklist so you know exactly what to do first.',
  },
]


interface Testimonial {
  id: string
  rating: number
  comment: string | null
  displayName: string
  archetypeLabel: string | null
}

/**
 * Fetches homepage testimonials.
 *
 * The `createPublicClient()` (anon) query below is the actual security
 * boundary: RLS ("report_feedback: public select featured") only lets it see
 * rows that are BOTH admin-featured AND user-consented — exactly the rows
 * that are safe to show anyone. `profiles`/`ideas` have no public RLS policy
 * (owner-only, by design), so display_name/archetype for these
 * already-approved rows are looked up afterwards with the service client.
 * That lookup never expands which feedback is visible — it only decorates
 * rows the anon query already proved are public.
 */
async function getTestimonials(): Promise<Testimonial[]> {
  const publicClient = createPublicClient()
  const { data: rows } = await publicClient
    .from('report_feedback')
    .select('id, report_id, user_id, rating, comment')
    .eq('featured', true)
    .eq('allow_public', true)
    .order('created_at', { ascending: false })
    .limit(9)

  if (!rows || rows.length === 0) return []

  const service = createServiceClient()
  const reportIds = [...new Set(rows.map(r => r.report_id))]
  const userIds = [...new Set(rows.map(r => r.user_id))]

  const [{ data: reports }, { data: profiles }] = await Promise.all([
    service.from('reports').select('id, idea_id').in('id', reportIds),
    service.from('profiles').select('id, username, display_name').in('id', userIds),
  ])

  const ideaIds = [...new Set((reports ?? []).map(r => r.idea_id))]
  const { data: ideas } = ideaIds.length
    ? await service.from('ideas').select('id, archetype').in('id', ideaIds)
    : { data: [] as { id: string; archetype: string }[] }

  const reportToIdea = new Map((reports ?? []).map(r => [r.id, r.idea_id]))
  const ideaToArchetype = new Map((ideas ?? []).map(i => [i.id, i.archetype]))
  const profileById = new Map((profiles ?? []).map(p => [p.id, p]))

  return rows.map(r => {
    const ideaId = reportToIdea.get(r.report_id)
    const archetype = ideaId ? ideaToArchetype.get(ideaId) : undefined
    const profile = profileById.get(r.user_id)
    return {
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      displayName: toPublicDisplayName(profile?.username, profile?.display_name),
      archetypeLabel: archetype ? (ARCHETYPE_LABELS[archetype] ?? archetype) : null,
    }
  })
}

/**
 * Fetches homepage-visible offers. The `createPublicClient()` (anon) query is
 * the actual security boundary — RLS ("offers: public select homepage") only
 * returns rows that are live, `show_on_homepage = true`, AND audience is
 * 'new_users' or 'everyone', which is exactly what a signed-out visitor
 * should see. No further filtering is needed here.
 */
async function getHomepageOffers(): Promise<BannerOffer[]> {
  const publicClient = createPublicClient()
  const { data } = await publicClient
    .from('offers')
    .select('id, code, description, percent_off, amount_off_cents')
    .order('created_at', { ascending: false })

  return data ?? []
}

function TestimonialStars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(i => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          className={`h-4 w-4 ${i <= rating ? 'fill-amber-400' : 'fill-white/10 light:fill-gray-200'}`}
        >
          <path d="M10 1.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L1.6 7.6l5.8-.8z" />
        </svg>
      ))}
    </div>
  )
}

function TestimonialCard({ t }: { t: Testimonial }) {
  return (
    <div className="h-full rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/30 backdrop-blur light:border-gray-200 light:bg-white light:shadow-md light:shadow-black/5">
      <TestimonialStars rating={t.rating} />
      {t.comment && (
        <p className="mt-4 text-sm leading-relaxed text-slate-300 light:text-gray-700">&ldquo;{t.comment}&rdquo;</p>
      )}
      <div className="mt-5 flex items-center gap-2">
        <span className="text-sm font-medium text-white light:text-gray-900">{t.displayName}</span>
        {t.archetypeLabel && (
          <span className="inline-flex items-center rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-[11px] font-medium text-indigo-300 light:bg-indigo-100 light:border light:border-indigo-200 light:text-indigo-700">
            {t.archetypeLabel}
          </span>
        )}
      </div>
    </div>
  )
}

function ReportCard({ card }: { card: ReportCardData }) {
  return (
    <div
      className={`w-[280px] shrink-0 rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-xl shadow-black/30 backdrop-blur transition-transform duration-300 hover:-translate-y-1 hover:shadow-2xl light:border-gray-200 light:bg-white light:shadow-md light:shadow-black/5 ${card.rotate}`}
    >
      <div className="mb-3">
        {card.redactedLabel ? (
          <>
            <p className="select-none text-sm font-semibold text-white blur-[5px] light:text-gray-900" aria-hidden="true">
              {card.title}
            </p>
            <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-violet-300 light:text-violet-700">
              <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
              {card.redactedLabel}
            </p>
          </>
        ) : (
          <p className="text-sm font-semibold text-white light:text-gray-900">{card.title}</p>
        )}
        <p className="mt-0.5 text-[11px] text-slate-400 light:text-gray-500">{card.location}</p>
      </div>

      <div className="mb-3 flex items-center justify-around gap-2">
        <ScoreRing score={card.score} label="Viability" size={60} />
        <ScoreRing score={card.success} label="Success outlook" size={60} />
      </div>

      <div className="mb-3 space-y-1.5 select-none blur-[3px]" aria-hidden="true">
        <div className="h-2 w-full rounded bg-white/10 light:bg-gray-200" />
        <div className="h-2 w-5/6 rounded bg-white/10 light:bg-gray-200" />
        <div className="h-2 w-4/6 rounded bg-white/10 light:bg-gray-200" />
      </div>

      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-indigo-500/15 px-2.5 py-1 text-[11px] font-medium text-indigo-300 light:bg-indigo-100 light:border light:border-indigo-200 light:text-indigo-700">
          {card.competitors} competitors found
        </span>
        <span className="select-none blur-[3px] text-[11px] text-slate-400 light:text-gray-500" aria-hidden="true">
          {card.cost} est.
        </span>
      </div>
    </div>
  )
}

export default async function LandingPage() {
  const [testimonials, offers] = await Promise.all([getTestimonials(), getHomepageOffers()])

  return (
    <div className="flex flex-col min-h-screen bg-white text-gray-900">
      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                               */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden bg-slate-950 light:bg-gray-100">
        <div className="absolute inset-0 dot-grid opacity-40 light:opacity-40" aria-hidden="true" />

        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="animate-blob-1 absolute -top-32 -left-24 h-96 w-96 rounded-full bg-indigo-600/40 blur-3xl light:opacity-50" />
          <div className="animate-blob-2 absolute top-1/3 -right-24 h-[28rem] w-[28rem] rounded-full bg-violet-600/30 blur-3xl light:opacity-50" />
          <div className="animate-blob-3 absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-cyan-500/25 blur-3xl light:opacity-50" />
        </div>

        <header className="relative z-10 px-6 py-5 flex items-center justify-between">
          <span className="font-semibold tracking-tight text-white light:text-gray-900">HadIdea</span>
          <div className="flex items-center gap-4">
            <nav className="hidden sm:flex items-center gap-4">
              <Link href="/faq" className="text-sm text-slate-200 hover:text-white font-medium transition-colors light:text-gray-600 light:hover:text-gray-900">
                FAQ
              </Link>
              <Link href="/contact" className="text-sm text-slate-200 hover:text-white font-medium transition-colors light:text-gray-600 light:hover:text-gray-900">
                Contact
              </Link>
            </nav>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <HeaderAuthLink />
            </div>
          </div>
        </header>

        <div className="relative z-10 flex flex-col items-center px-6 pt-16 pb-28 text-center sm:pt-20 sm:pb-36">
          {offers.length > 0 && (
            <div className="mb-8 w-full max-w-xl">
              <OfferBanners offers={offers} />
            </div>
          )}

          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-slate-200 backdrop-blur light:border-gray-200 light:bg-white light:text-gray-700 light:shadow-sm">
            <span className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-indigo-400" aria-hidden="true" />
            {DEMO_STATS.ideasLast30Days} ideas became reality in the last 30 days
          </div>

          <h1 className="max-w-3xl text-4xl font-bold leading-tight text-white sm:text-6xl light:text-gray-900">
            From raw idea to{' '}
            <span className="gradient-text">real-world plan</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg text-slate-400 light:text-gray-500">
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
                         transition-colors hover:border-white/30 hover:bg-white/5 light:border-gray-300 light:text-gray-700 light:hover:border-gray-400 light:hover:bg-gray-100"
            >
              See how it works
            </a>
          </div>

          <Link
            href="/sample-report"
            className="mt-6 text-sm text-slate-300 hover:text-white transition-colors light:text-gray-600 light:hover:text-gray-900"
          >
            or see a sample report →
          </Link>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Fuzzed report showcase                                             */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative -mt-16 bg-slate-950 pb-24 sm:-mt-20 light:bg-gray-100">
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
        className="relative bg-gradient-to-b from-slate-950 via-slate-950 to-gray-50 px-6 pb-24 pt-4 sm:pt-8 light:from-gray-100 light:via-gray-100"
      >
        <div className="mx-auto max-w-6xl">
          <ScrollReveal className="mb-14 text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl light:text-gray-900">What we do</h2>
            <p className="mt-3 text-slate-400 light:text-gray-500">Four steps between a raw idea and a real plan.</p>
          </ScrollReveal>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {WHAT_WE_DO_STEPS.map((step, i) => (
              <ScrollReveal key={step.number} delayMs={i * 100}>
                <div className="group h-full rounded-2xl border border-slate-800 bg-slate-900/60 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-400/50 hover:shadow-lg hover:shadow-indigo-500/10 light:border-gray-200 light:bg-white light:shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-xs font-semibold text-indigo-400">{step.number}</span>
                    <svg
                      className="h-6 w-6 text-slate-400 transition-colors group-hover:text-indigo-400 light:text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      {step.icon}
                    </svg>
                  </div>
                  <h3 className="mb-2 text-base font-semibold text-white light:text-gray-900">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-400 light:text-gray-500">{step.description}</p>
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

          <div className="mt-10 text-center">
            <Link
              href="/sample-report"
              className="inline-block rounded-lg border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700
                         transition-colors hover:border-gray-400 hover:bg-gray-100"
            >
              Read a full sample report →
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Testimonials — never fabricated; hidden entirely when none featured */}
      {/* ------------------------------------------------------------------ */}
      {testimonials.length > 0 && (
        <section className="relative overflow-hidden bg-slate-950 px-6 py-24 light:bg-gray-100">
          <div className="absolute inset-0 dot-grid opacity-40 light:opacity-40" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <div className="animate-blob-1 absolute -top-24 -right-16 h-96 w-96 rounded-full bg-indigo-600/30 blur-3xl light:opacity-50" />
            <div className="animate-blob-3 absolute bottom-0 left-1/4 h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl light:opacity-50" />
          </div>

          <div className="relative z-10 mx-auto max-w-6xl">
            <ScrollReveal className="mb-14 text-center">
              <h2 className="text-3xl font-bold text-white sm:text-4xl light:text-gray-900">What founders are saying</h2>
              <p className="mt-3 text-slate-400 light:text-gray-500">Real ratings from real reports.</p>
            </ScrollReveal>

            {testimonials.length >= 4 ? (
              <div className="marquee-group overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
                <div className="marquee-track-reverse flex w-max">
                  <div className="flex shrink-0 gap-6 pr-6">
                    {testimonials.map(t => (
                      <div key={t.id} className="w-[320px] shrink-0">
                        <TestimonialCard t={t} />
                      </div>
                    ))}
                  </div>
                  <div className="flex shrink-0 gap-6 pr-6" aria-hidden="true">
                    {testimonials.map(t => (
                      <div key={`${t.id}-dup`} className="w-[320px] shrink-0">
                        <TestimonialCard t={t} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {testimonials.map((t, i) => (
                  <ScrollReveal key={t.id} delayMs={i * 80}>
                    <TestimonialCard t={t} />
                  </ScrollReveal>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Bottom CTA band                                                    */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden bg-slate-950 px-6 py-24 text-center light:bg-gray-100">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="animate-blob-1 absolute -top-20 left-1/4 h-72 w-72 rounded-full bg-indigo-600/30 blur-3xl light:opacity-50" />
          <div className="animate-blob-2 absolute -bottom-20 right-1/4 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl light:opacity-50" />
        </div>

        <div className="relative z-10 mx-auto max-w-2xl">
          <h2 className="text-2xl font-bold text-white sm:text-3xl light:text-gray-900">
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
            <p className="text-xs text-slate-500 light:text-gray-400">No credit card required — join the early list</p>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
