import { redirect, notFound } from 'next/navigation'
import { createDbClient } from '@/lib/db'
import { AppHeader } from '@/components/app-header'
import QuestionsWizard from './questions-wizard'

export const metadata = { title: 'Questions — Idea Engine' }

export default async function QuestionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const { data: idea } = await supabase
    .from('ideas')
    .select('id, restatement, status')
    .eq('id', id)
    .single()

  if (!idea) notFound()

  // Already past questioning — go to report
  if (idea.status === 'researching' || idea.status === 'ready') {
    redirect(`/app/ideas/${id}/report`)
  }

  return (
    <main className="min-h-screen bg-slate-950 light:bg-gray-50">
      <AppHeader email={user.email!} />
      <div className="max-w-2xl mx-auto px-6 py-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-400 mb-2">
          Step 2 of 3 — Tell us more
        </p>
        <h1 className="text-2xl font-semibold text-white light:text-gray-900 mb-2">A few quick questions</h1>
        {idea.restatement && (
          <p className="text-slate-400 light:text-gray-500 text-sm mb-8">{idea.restatement}</p>
        )}
        <QuestionsWizard ideaId={id} />
      </div>
    </main>
  )
}
