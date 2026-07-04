import { redirect, notFound } from 'next/navigation'
import { createDbClient } from '@/lib/db'
import ConfirmForm from './confirm-form'

export const metadata = { title: 'Confirm your idea — Idea Engine' }

const ARCHETYPE_LABELS: Record<string, string> = {
  physical_product: 'Physical product',
  local_service: 'Local service',
  software_app: 'Software / app',
  ecommerce_brand: 'E-commerce brand',
  content_education: 'Content / education',
  marketplace: 'Marketplace',
  invention: 'Invention',
  other: 'Other',
}

export default async function ConfirmPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const { data: idea } = await supabase
    .from('ideas')
    .select('id, raw_text, archetype, restatement, status')
    .eq('id', id)
    .single()

  if (!idea) notFound()
  if (idea.status !== 'draft') redirect(`/app/ideas/${id}/questions`)

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <span className="font-semibold text-gray-900">Idea Engine</span>
      </header>
      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Does this sound right?</h1>
        <p className="text-gray-500 text-sm mb-8">
          We read your idea and classified it. Confirm or adjust before we continue.
        </p>

        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Your idea</p>
          <p className="text-gray-700 text-sm">{idea.raw_text}</p>
        </div>

        <div className="bg-indigo-50 rounded-lg border border-indigo-100 p-6 mb-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-400 mb-1">
            We read this as
          </p>
          <p className="text-gray-900 font-medium mb-3">{idea.restatement}</p>
          <span className="inline-block rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold px-3 py-1">
            {ARCHETYPE_LABELS[idea.archetype] ?? idea.archetype}
          </span>
        </div>

        <ConfirmForm ideaId={idea.id} currentArchetype={idea.archetype} archetypeLabels={ARCHETYPE_LABELS} />
      </div>
    </main>
  )
}
