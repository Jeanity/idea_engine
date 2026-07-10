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
          <div className="relative z-10 rounded-2xl border border-white/10 bg-slate-900/80 light:border-gray-200 light:bg-white light:shadow-sm p-8">
            <h1 className="text-2xl font-semibold text-white light:text-gray-900 mb-1">What&apos;s the idea?</h1>
            <p className="text-sm text-slate-400 light:text-gray-500 mb-6">
              Describe it in plain English — rough is fine. The engine turns it into a researched, costed plan.
            </p>
            <NewIdeaForm />
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 light:border-gray-200 light:bg-white light:shadow-sm px-6 py-5">
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
        </div>
      </div>
    </main>
  )
}
