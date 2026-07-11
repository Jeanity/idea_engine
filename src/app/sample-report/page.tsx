import Link from 'next/link'
import type { Metadata } from 'next'
import { HeaderAuthLink } from '@/components/header-auth-link'
import { ThemeToggle } from '@/components/theme-toggle'
import { SiteFooter } from '@/components/site-footer'
import { createPublicClient } from '@/lib/db'
import { deriveHeadlineScore } from '@/lib/viability-score'
import { SAMPLE_IDEA, SAMPLE_REPORT_SECTIONS } from '@/lib/sample-report'
import { SampleGallery, type GalleryCard, type FallbackCard } from './sample-gallery-client'

export const metadata: Metadata = {
  title: 'Sample reports — HadIdea',
  description:
    'Browse example HadIdea reports — viability score, competitors, cost breakdown, legal & compliance, and prioritised next steps.',
}

const FALLBACK_CARD: FallbackCard = {
  id: 'fallback-coffee-van',
  title: 'Weekend specialty coffee van',
  archetype: SAMPLE_IDEA.archetype,
  restatement: SAMPLE_IDEA.restatement,
  headlineScore: deriveHeadlineScore(
    (SAMPLE_REPORT_SECTIONS.viability_snapshot as { scores: Record<string, { score: number }> }).scores
  ),
  sections: SAMPLE_REPORT_SECTIONS,
  // "$10,000+" band — reads as "Partway there" against the sample's
  // $14,700–$63,000 startup range, consistent with its cart-first-pilot
  // narrative (the van comes later, funded by proven revenue).
  statedCapital: { low: 10_000, high: null },
}

// Server component: reads active samples with the per-request anon client so
// RLS ("sample_reports: public read active") — not app code — is what keeps
// inactive rows and the sections column (not selected here at all) out of
// this page's HTML. If the table doesn't exist yet (migration 011 not run)
// or the query errors for any other reason, `data` comes back null/empty and
// we fall through to the built-in coffee-van sample — this page must never
// crash because of that migration's status.
async function getActiveSamples(): Promise<GalleryCard[]> {
  const publicClient = createPublicClient()
  const { data } = await publicClient
    .from('sample_reports')
    .select('id, title, archetype, restatement, headline_score, sort_order')
    .order('sort_order', { ascending: true })

  return (data ?? []).map(row => ({
    id: row.id,
    title: row.title,
    archetype: row.archetype,
    restatement: row.restatement,
    headlineScore: row.headline_score,
  }))
}

export default async function SampleReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  const cards = await getActiveSamples()

  // "Back to where you came from" — only honour in-app paths so the param
  // can't be abused as an open redirect (must start with a single '/').
  const { from } = await searchParams
  const backHref = from && /^\/(?!\/)/.test(from) ? from : null

  return (
    <main className="min-h-screen bg-slate-950 light:bg-gray-50">
      {/* Header */}
      <header className="relative z-10 px-6 py-5 flex items-center justify-between border-b border-white/10 light:border-gray-200">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-semibold tracking-tight text-white light:text-gray-900">
            HadIdea
          </Link>
          {backHref && (
            <Link
              href={backHref}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-slate-300 hover:border-white/25 hover:text-white light:border-gray-200 light:text-gray-600 light:hover:border-gray-300 light:hover:text-gray-900 transition-colors"
            >
              ← Back to your report
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <HeaderAuthLink />
        </div>
      </header>

      {/* Gallery */}
      <div className="relative overflow-hidden bg-slate-950 light:bg-gray-50">
        <div className="absolute inset-0 dot-grid opacity-40 light:opacity-20" aria-hidden="true" />
        <div className="relative z-10 max-w-5xl mx-auto px-6 pt-10 pb-16">
          <div className="mb-8 max-w-2xl">
            <span className="inline-flex items-center rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold tracking-wide text-indigo-200 light:bg-indigo-100 light:text-indigo-700">
              SAMPLE REPORTS
            </span>
            <h1 className="mt-3 text-2xl font-semibold text-white light:text-gray-900 sm:text-3xl">
              See what a real report looks like
            </h1>
            <p className="mt-2 text-sm text-slate-300 light:text-gray-600">
              Pick any idea below to open the full example report — viability score, competitors,
              costs, legal, and next steps. These are illustrative reports with links disabled;
              real reports include live competitor, source, and funding links.
            </p>
          </div>

          <SampleGallery cards={cards} fallback={FALLBACK_CARD} />
        </div>
      </div>

      {/* Bottom CTA band */}
      <section className="relative overflow-hidden bg-slate-950 light:bg-gray-50 px-6 py-24 text-center border-t border-white/10 light:border-gray-200">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="animate-blob-1 absolute -top-20 left-1/4 h-72 w-72 rounded-full bg-indigo-600/30 blur-3xl light:opacity-50" />
          <div className="animate-blob-2 absolute -bottom-20 right-1/4 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl light:opacity-50" />
        </div>

        <div className="relative z-10 mx-auto max-w-2xl">
          <h2 className="text-2xl font-bold text-white light:text-gray-900 sm:text-3xl">
            Your idea deserves this treatment.
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
            <p className="text-xs text-slate-500 light:text-gray-400">
              Reports from US$19.95 — pricing may change at launch
            </p>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
