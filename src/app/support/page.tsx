import type { Metadata } from 'next'
import Link from 'next/link'
import { StaticPageShell } from '@/components/static-page-shell'

export const metadata: Metadata = {
  title: 'Support',
  description:
    'Get help with HadIdea — problems with a purchase, refunds, report issues, or anything else. Real humans read every message.',
}

// Support hub (HANDOFF "TODO — Customer support feature", item 3). This is
// the page order-confirmation emails and Stripe receipts will point at once
// payments ship — keep the URL stable. Until then it's linked from the FAQ.

const linkCls =
  'text-indigo-400 hover:text-indigo-300 light:text-indigo-600 light:hover:text-indigo-700 underline underline-offset-2'

function HelpCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/80 light:border-gray-200 light:bg-white light:shadow-sm px-5 py-5">
      <h2 className="text-base font-semibold text-white light:text-gray-900 mb-2">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

export default function SupportPage() {
  return (
    <StaticPageShell
      title="Support"
      intro="Real humans read every message — most get a reply within a day."
    >
      <HelpCard title="A problem with a purchase or a refund">
        <p>
          Our refund policy is simple: full refund before your report is generated, and if a report is
          defective we&apos;ll regenerate it or refund it — your choice. The details are in the{' '}
          <Link href="/terms" className={linkCls}>Terms</Link> (section 5).
        </p>
        <p>
          To get help with a charge,{' '}
          <Link href="/contact?category=billing" className={linkCls}>
            contact us with the &ldquo;Billing &amp; refunds&rdquo; option
          </Link>{' '}
          and include the email you purchased with. Billing messages jump the queue — charge problems
          are time-sensitive and we treat them that way.
        </p>
      </HelpCard>

      <HelpCard title="A problem with a report">
        <p>
          Something broken, missing, or plain wrong in a report? Use the &ldquo;Report a bug&rdquo;
          button at the bottom of the report itself — it attaches the report context for us
          automatically. Or{' '}
          <Link href="/contact?category=complaint" className={linkCls}>send us a complaint</Link>{' '}
          and we&apos;ll dig in.
        </p>
      </HelpCard>

      <HelpCard title="Questions before you buy">
        <p>
          The <Link href="/faq" className={linkCls}>FAQ</Link> covers what reports include, how the
          research works, and what things cost. Anything else,{' '}
          <Link href="/contact" className={linkCls}>ask us directly</Link>.
        </p>
      </HelpCard>

      <p className="text-xs text-slate-500 light:text-gray-400">
        Prefer email? Write to{' '}
        <a href="mailto:hello@hadidea.com" className={linkCls}>hello@hadidea.com</a> — it lands in the
        same queue.
      </p>
    </StaticPageShell>
  )
}
