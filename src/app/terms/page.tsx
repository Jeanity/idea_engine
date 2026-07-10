import type { Metadata } from 'next'
import { StaticPageShell } from '@/components/static-page-shell'

export const metadata: Metadata = {
  title: 'Terms of Service — HadIdea',
  description: 'The terms that govern use of HadIdea.',
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold text-white light:text-gray-900">{children}</h2>
}

export default function TermsPage() {
  return (
    <StaticPageShell title="Terms of Service" draftBanner>
      <section>
        <H2>1. The service</H2>
        <p className="mt-3">
          HadIdea turns a raw business idea into an AI-generated business research report:
          market context, competitor research, cost estimates, legal and compliance pointers, and
          suggested next steps. Reports are generated with the help of AI language models and live
          web search.
        </p>
      </section>

      <section>
        <H2>2. Not professional advice</H2>
        <p className="mt-3">
          Reports are informational only. They are not legal, financial, tax, or other
          professional advice, and nothing in a report should be relied on as a substitute for
          advice from a qualified professional. Where a report flags that a figure or claim needs
          specialist verification, treat that as a direction to seek one out, not a completed
          answer.
        </p>
      </section>

      <section>
        <H2>3. Your idea, your IP</H2>
        <p className="mt-3">
          You retain all intellectual property rights in the ideas, answers, and other content you
          submit to HadIdea. We don&apos;t claim ownership of your ideas, we don&apos;t use
          them to train models beyond generating your own report, and we don&apos;t share them
          with other users.
        </p>
      </section>

      <section>
        <H2>4. Accounts</H2>
        <p className="mt-3">
          You&apos;re responsible for the accuracy of information you provide and for keeping
          access to your account secure. You may delete your account at any time from account
          settings; deletion is permanent and erases your ideas, answers, and reports — see our{' '}
          <a href="/privacy" className="text-indigo-300 underline hover:text-indigo-200 light:text-indigo-600 light:hover:text-indigo-700">
            Privacy Policy
          </a>
          .
        </p>
      </section>

      <section>
        <H2>5. Payment and refunds</H2>
        <p className="mt-3">
          Paid reports are one-off purchases (final pricing will be shown at checkout before you
          pay). Because a full report is researched and generated specifically for your idea, the
          work is delivered — and its cost incurred — the moment the report is produced. Our
          refund policy reflects that:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            <strong>Before generation:</strong> if you&apos;ve paid but your full report has not
            yet been generated, you can request a full refund — no questions asked.
          </li>
          <li>
            <strong>Failed or defective reports:</strong> if generation fails, or your report
            arrives with missing or clearly broken sections, we&apos;ll regenerate it free or
            refund you in full — your choice.
          </li>
          <li>
            <strong>After delivery:</strong> once a complete report has been generated, we
            don&apos;t offer change-of-mind refunds. A report&apos;s value is the research it
            contains, and that&apos;s delivered in full the moment you can read it.
          </li>
        </ul>
        <p className="mt-3">
          Refunds go back to the original payment method. To request one,{' '}
          <a href="/contact" className="text-indigo-300 underline hover:text-indigo-200 light:text-indigo-600 light:hover:text-indigo-700">
            contact us
          </a>
          . Nothing in this policy limits or excludes your rights under the Australian Consumer
          Law or any other consumer protection law that applies to you — where those laws entitle
          you to a remedy, they prevail over this section.
        </p>
      </section>

      <section>
        <H2>6. Limitation of liability</H2>
        <p className="mt-3">
          HadIdea is provided &ldquo;as is&rdquo;. To the maximum extent permitted by law, we
          are not liable for business decisions made on the basis of a report, or for losses
          arising from inaccuracies, omissions, or downtime in the service.
        </p>
      </section>

      <section>
        <H2>7. Changes to these terms</H2>
        <p className="mt-3">
          We may update these terms as the product develops. Material changes will be reflected on
          this page with an updated review status.
        </p>
      </section>

      <section>
        <H2>8. Governing law</H2>
        <p className="mt-3">
          These terms are governed by the laws of Queensland, Australia, without regard to
          conflict-of-law principles.
        </p>
      </section>

      <section>
        <H2>9. Contact</H2>
        <p className="mt-3">
          Questions about these terms can be sent via the{' '}
          <a href="/contact" className="text-indigo-300 underline hover:text-indigo-200 light:text-indigo-600 light:hover:text-indigo-700">
            contact page
          </a>
          .
        </p>
      </section>
    </StaticPageShell>
  )
}
