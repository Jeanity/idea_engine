import { redirect, notFound } from 'next/navigation'
import { createDbClient } from '@/lib/db'

export const metadata = { title: 'Questions — Idea Engine' }

export default async function QuestionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const { data: idea } = await supabase
    .from('ideas')
    .select('id, archetype, restatement, status')
    .eq('id', id)
    .single()

  if (!idea) notFound()

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <span className="font-semibold text-gray-900">Idea Engine</span>
      </header>
      <div className="max-w-2xl mx-auto px-6 py-12">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 mb-2">
          Step 2 of 3 — Tell us more
        </p>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">A few quick questions</h1>
        <p className="text-gray-500 text-sm mb-8">
          {idea.restatement}
        </p>
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-gray-400 text-sm">
          Guided questions wizard coming in Phase 3.
        </div>
      </div>
    </main>
  )
}
