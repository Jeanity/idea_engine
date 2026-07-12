import type { Metadata } from 'next'
import { StaticPageShell } from '@/components/static-page-shell'

export const metadata: Metadata = {
  title: { absolute: 'About HadIdea — From Raw Idea to Real-World Plan' },
  description:
    'Most business ideas die as a thought — not because they were bad, but because nobody checked. HadIdea turns raw ideas into researched, scored business plans.',
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold text-white light:text-gray-900">{children}</h2>
}

export default function AboutPage() {
  return (
    <StaticPageShell
      title="About HadIdea"
      intro="What we do, and why we built it this way."
    >
      <section>
        <H2>What HadIdea does</H2>
        <p className="mt-3">
          You describe a raw business idea in plain English. We ask a handful of targeted
          follow-up questions to sharpen it, then research your market with live web search —
          real competitors, realistic costs, the legal and compliance requirements that apply to
          you, and funding options. The result is a structured report with prioritised next
          steps: something you can act on, not just read.
        </p>
      </section>

      <section>
        <H2>The philosophy</H2>
        <p className="mt-3">
          No idea is dismissed. Every idea either works or it doesn&apos;t, succeeds or it
          doesn&apos;t — our job is to lay out the steps and the facts so you can make an informed
          decision, not to hand down a verdict from a distance.
        </p>
        <p className="mt-3">
          Competition is treated as demand evidence, not a warning sign. If competitors exist,
          that proves real people already pay for something like this — the report tells you what
          that means for you, not just that it&apos;s crowded.
        </p>
        <p className="mt-3">
          Success is defined by you, not by a generic startup benchmark. Some people want a bit of
          side income, others want to replace a salary, others want to build something big. A
          report frames its findings against your own goal, whatever that is.
        </p>
        <p className="mt-3">
          When something is genuinely hard — expensive to start, a crowded market, a long path to
          profitability — the report says so plainly, as information, and shows the realistic way
          through it (staged approaches, financing routes, niches). Facts, not verdicts.
        </p>
      </section>

      <section>
        <H2>Who&apos;s behind it</H2>
        <p className="mt-3">
          HadIdea is built by a small independent team based in Australia. We&apos;re early —
          the product is under active development, and we&apos;d rather tell you that plainly than
          dress it up with numbers we don&apos;t have yet.
        </p>
      </section>

      <section>
        <H2>Questions?</H2>
        <p className="mt-3">
          Get in touch on the{' '}
          <a href="/contact" className="text-indigo-300 underline hover:text-indigo-200 light:text-indigo-600 light:hover:text-indigo-700">
            contact page
          </a>
          .
        </p>
      </section>
    </StaticPageShell>
  )
}
