import { createDbClient } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AppHeader } from '@/components/app-header'
import NewIdeaForm from '@/components/new-idea-form'
import { DEMO_STATS } from '@/lib/demo-stats'

export const metadata = { title: 'New idea — HadIdea' }

export default async function DashboardPage() {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  return (
    <main className="relative min-h-screen bg-slate-950 light:bg-gray-50 overflow-hidden">
      <div className="absolute inset-0 dot-grid opacity-40 light:hidden" aria-hidden="true" />
      <div
        className="pointer-events-none absolute -top-32 left-1/3 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl light:hidden"
        aria-hidden="true"
      />

      <div className="relative z-10">
        <AppHeader email={user.email!} />

        <div className="max-w-2xl mx-auto px-6 py-12">
          <div className="rounded-2xl border border-white/10 bg-white/5 light:border-gray-200 light:bg-white light:shadow-sm px-6 py-5 mb-6">
            <div className="grid grid-cols-3 gap-4 text-center mb-4">
              <div>
                <p className="text-lg font-semibold text-white light:text-gray-900">{DEMO_STATS.ideasLast30Days}</p>
                <p className="text-xs text-slate-500 light:text-gray-400 mt-0.5">ideas, last 30 days</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-white light:text-gray-900">{DEMO_STATS.reportsGenerated}</p>
                <p className="text-xs text-slate-500 light:text-gray-400 mt-0.5">reports generated</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-white light:text-gray-900">{DEMO_STATS.avgTimeToReport}</p>
                <p className="text-xs text-slate-500 light:text-gray-400 mt-0.5">avg. time to report</p>
              </div>
            </div>
            <div className="border-t border-white/10 light:border-gray-200 pt-4 text-center">
              <Link href="/sample-report" className="text-sm text-indigo-400 hover:text-indigo-300 font-medium hover:underline">
                See a sample report →
              </Link>
            </div>
          </div>

          <div className="relative z-10 rounded-2xl border border-white/10 bg-slate-900/80 light:border-gray-200 light:bg-white light:shadow-sm p-8">
            <h1 className="text-2xl font-semibold text-white light:text-gray-900 mb-1">What&apos;s the idea?</h1>
            <p className="text-sm text-slate-400 light:text-gray-500 mb-6">
              Describe it in plain English — rough is fine. The engine turns it into a researched, costed plan.
            </p>
            <NewIdeaForm />
          </div>

          {/* What happens after submitting — expectations set honestly:
              the initial report completes while the user watches; only the
              full report takes minutes and sends the email link. */}
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 light:border-gray-200 light:bg-white light:shadow-sm px-6 py-5">
            <h2 className="text-sm font-semibold text-white light:text-gray-900">What happens next</h2>
            <ol className="mt-4 space-y-4">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-semibold text-indigo-300 light:bg-indigo-100 light:text-indigo-700">1</span>
                <p className="text-sm text-slate-400 light:text-gray-600">
                  <span className="font-medium text-slate-200 light:text-gray-900">A few quick questions.</span>{' '}
                  We ask a handful of targeted follow-ups — your budget, your time, what makes your
                  version different — because they change the answer.
                </p>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-semibold text-indigo-300 light:bg-indigo-100 light:text-indigo-700">2</span>
                <p className="text-sm text-slate-400 light:text-gray-600">
                  <span className="font-medium text-slate-200 light:text-gray-900">Your initial report.</span>{' '}
                  Generated while you watch — viability scores and the shape of the opportunity.
                  Enough to know whether your idea is worth the full deep-dive before you commit to
                  anything.
                </p>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-semibold text-indigo-300 light:bg-indigo-100 light:text-indigo-700">3</span>
                <p className="text-sm text-slate-400 light:text-gray-600">
                  <span className="font-medium text-slate-200 light:text-gray-900">The full report.</span>{' '}
                  Live web research takes a few minutes, so feel free to close the tab — we email
                  you a link the moment it&apos;s ready. Competitors with real prices, costs and
                  margins, legal for your country, funding options, and a week-one action plan.
                </p>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </main>
  )
}
