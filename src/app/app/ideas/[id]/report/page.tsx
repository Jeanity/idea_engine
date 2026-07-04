import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createDbClient } from '@/lib/db'

export const metadata = { title: 'Report — Idea Engine' }

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const { data: idea } = await supabase
    .from('ideas')
    .select('id, restatement, archetype, status')
    .eq('id', id)
    .single()

  if (!idea) notFound()

  // Send back to questions if not yet complete
  if (idea.status === 'questioning' || idea.status === 'draft') {
    redirect(`/app/ideas/${id}/questions`)
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <span className="font-semibold text-gray-900">Idea Engine</span>
      </header>
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-indigo-100 mb-6">
          <svg className="w-7 h-7 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-3">
          {idea.status === 'ready' ? 'Your report is ready' : 'Generating your report…'}
        </h1>
        <p className="text-gray-500 text-sm mb-2 max-w-md mx-auto">
          {idea.restatement}
        </p>
        {idea.status !== 'ready' && (
          <p className="text-gray-400 text-xs mb-8">
            This usually takes under a minute. Report generation coming in Phase 4.
          </p>
        )}
        <Link
          href="/app"
          className="inline-block mt-6 text-sm text-indigo-600 hover:text-indigo-700 hover:underline"
        >
          ← Back to dashboard
        </Link>
      </div>
    </main>
  )
}
