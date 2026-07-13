import type { Metadata } from 'next'
import { StaticPageShell } from '@/components/static-page-shell'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'What HadIdea collects, how it is used, and how to request deletion.',
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold text-white light:text-gray-900">{children}</h2>
}

export default function PrivacyPage() {
  return (
    <StaticPageShell title="Privacy Policy" draftBanner>
      <section>
        <H2>1. What we collect</H2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          <li>Account information: your email address and any profile details you add (username, display name).</li>
          <li>Idea content: the ideas, answers, and reports you create.</li>
          <li>Basic analytics events (page views, session activity) to understand product usage, plus — only if you opt in — Google Analytics. No ad trackers.</li>
        </ul>
      </section>

      <section>
        <H2>2. Who processes it</H2>
        <p className="mt-3">
          Your data is processed by a small set of vetted, industry-standard cloud providers that
          run the service, covering:
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          <li>Secure application hosting and delivery.</li>
          <li>Database, authentication, and file storage.</li>
          <li>AI processing used to generate your report content.</li>
          <li>Background processing for report generation.</li>
        </ul>
        <p className="mt-3">
          Each provider processes only what&apos;s needed to run the service. We don&apos;t sell
          your data to anyone. If you need the specific processor list — for example for a
          compliance review — request it via the{' '}
          <a href="/contact" className="text-indigo-300 underline hover:text-indigo-200 light:text-indigo-600 light:hover:text-indigo-700">
            contact page
          </a>
          .
        </p>
      </section>

      <section>
        <H2>3. Why we collect it</H2>
        <p className="mt-3">
          To generate your reports, run your account, keep the service reliable, and understand
          how the product is used so we can improve it.
        </p>
      </section>

      <section>
        <H2>4. Deletion</H2>
        <p className="mt-3">
          You can delete your account at any time from account settings. Deletion is permanent —
          your ideas, answers, and reports are erased and cannot be recovered.
        </p>
      </section>

      <section>
        <H2>5. Your rights</H2>
        <p className="mt-3">
          For questions about what data we hold on you, or to request deletion outside of the
          self-service flow, reach out via the{' '}
          <a href="/contact" className="text-indigo-300 underline hover:text-indigo-200 light:text-indigo-600 light:hover:text-indigo-700">
            contact page
          </a>
          .
        </p>
      </section>

      <section>
        <H2>6. Cookies</H2>
        <p className="mt-3">We use three categories of cookies — all set on our own domain, and nothing from ad networks:</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          <li>
            <strong>Necessary</strong> — authentication cookies set by our sign-in service (they
            keep you signed in), <code>ie_consent</code> (remembers your cookie choice), and{' '}
            <code>ie_ab</code> (fraud prevention for free-report promotions). These are required
            for the site to function and are never gated behind a choice.
          </li>
          <li>
            <strong>Functional</strong> — your theme preference (light/dark), stored in your
            browser&apos;s local storage rather than a cookie. Disclosed here, not gated.
          </li>
          <li>
            <strong>Analytics</strong> — a session cookie and a persistent visitor cookie (
            <code>ie_vid</code>) we use to count page views and understand product usage, plus
            Google Analytics, which sets its own cookies (<code>_ga</code> and{' '}
            <code>_ga_*</code>) to tell visitors apart and measure usage on Google&apos;s side.
            All of it is off by default; you choose whether to allow it in the cookie banner or
            via &quot;Cookie preferences&quot; in the footer, and declining (or changing your
            mind later) also deletes the analytics cookies already set.
          </li>
        </ul>
        <p className="mt-3">
          If you decline analytics, we send a single anonymous page-view ping (no persistent
          identifier, no <code>ie_vid</code>) so we can still see that a visit happened — after
          that, nothing further is tracked for that visit. Accepting or declining never changes
          what the product itself can do.
        </p>
        <p className="mt-3">
          During promotional periods offering free reports, we also retain a hashed (not raw)
          version of your IP address to help prevent abuse of the offer.
        </p>
      </section>

      <section>
        <H2>7. Changes to this policy</H2>
        <p className="mt-3">
          We may update this policy as the product develops. Material changes will be reflected on
          this page with an updated review status.
        </p>
      </section>
    </StaticPageShell>
  )
}
