import type { Metadata } from 'next'
import { StaticPageShell } from '@/components/static-page-shell'

export const metadata: Metadata = {
  title: 'Terms of Service — Idea Engine',
  description: 'The terms that govern use of Idea Engine.',
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
          Idea Engine turns a raw business idea into an AI-generated business research report:
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
          submit to Idea Engine. We don&apos;t claim ownership of your ideas, we don&apos;t use
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
          Pricing and refund terms are being finalised ahead of general availability and will be
          published here before payment is required. Nothing in this section should be relied on
          as final.
        </p>
      </section>

      <section>
        <H2>6. Limitation of liability</H2>
        <p className="mt-3">
          Idea Engine is provided &ldquo;as is&rdquo;. To the maximum extent permitted by law, we
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
