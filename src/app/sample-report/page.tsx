import Link from 'next/link'
import type { Metadata } from 'next'
import { HeaderAuthLink } from '@/components/header-auth-link'
import { SAMPLE_IDEA } from '@/lib/sample-report'
import { SampleReportClient } from './sample-report-client'

export const metadata: Metadata = {
  title: 'Sample report — Idea Engine',
  description:
    'See a full example Idea Engine report — viability score, competitors, cost breakdown, legal & compliance, and prioritised next steps.',
}

export default function SampleReportPage() {
  return (
    <main className="min-h-screen bg-slate-950 light:bg-gray-50">
      {/* Header */}
      <header className="relative z-10 px-6 py-5 flex items-center justify-between border-b border-white/10 light:border-gray-200">
        <Link href="/" className="font-semibold tracking-tight text-white light:text-gray-900">
          Idea Engine
        </Link>
        <HeaderAuthLink />
      </header>

      {/* Sample banner */}
      <div className="relative overflow-hidden bg-slate-950 light:bg-gray-50">
        <div className="absolute inset-0 dot-grid opacity-40 light:opacity-20" aria-hidden="true" />
        <div className="relative z-10 max-w-3xl mx-auto px-6 pt-10 pb-8">
          <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 light:bg-indigo-50 light:border-indigo-200 px-5 py-5 sm:px-6 sm:py-6">
            <span className="inline-flex items-center rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold tracking-wide text-indigo-200 light:bg-indigo-100 light:text-indigo-700">
              SAMPLE REPORT
            </span>
            <p className="mt-3 text-lg font-semibold text-white light:text-gray-900">
              {SAMPLE_IDEA.restatement}
            </p>
            <p className="mt-2 text-sm text-slate-300 light:text-gray-600">
              This is an example report with illustrative data — links are disabled in the sample.
              Real reports include live competitor, source, and funding links.
            </p>
            <Link
              href="/sign-in"
              className="mt-4 inline-block rounded-lg bg-indigo-500 px-6 py-2.5 text-sm font-semibold text-white
                         shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:scale-105 hover:bg-indigo-400
                         focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              Get this for your idea
            </Link>
          </div>
        </div>
      </div>

      {/* Report */}
      <SampleReportClient />

      {/* Bottom CTA band */}
      <section className="relative overflow-hidden bg-slate-950 light:bg-gray-50 px-6 py-24 text-center border-t border-white/10 light:border-gray-200">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="animate-blob-1 absolute -top-20 left-1/4 h-72 w-72 rounded-full bg-indigo-600/30 blur-3xl" />
          <div className="animate-blob-2 absolute -bottom-20 right-1/4 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
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
    </main>
  )
}
