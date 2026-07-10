import { redirect, notFound } from 'next/navigation'
import { createDbClient } from '@/lib/db'
import { AppHeader } from '@/components/app-header'
import ConfirmForm from './confirm-form'

export const metadata = { title: 'Confirm your idea — HadIdea' }

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
    <main className="min-h-screen bg-slate-950 light:bg-gray-50">
      <AppHeader email={user.email!} />
      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold text-white light:text-gray-900 mb-2">Does this sound right?</h1>
        <p className="text-slate-400 light:text-gray-500 text-sm mb-8">
          We read your idea and classified it. Confirm or adjust before we continue.
        </p>

        <div className="rounded-2xl border border-white/10 bg-slate-900/80 light:border-gray-200 light:bg-white light:shadow-sm p-6 mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 light:text-gray-400 mb-1">Your idea</p>
          <p className="text-slate-300 light:text-gray-700 text-sm">{idea.raw_text}</p>
        </div>

        <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 light:bg-indigo-50 light:border-indigo-100 p-6 mb-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300 light:text-indigo-900 mb-1">
            We read this as
          </p>
          <p className="text-white font-medium mb-3 light:text-indigo-900">{idea.restatement}</p>
          <span className="inline-block rounded-full bg-indigo-500/15 text-indigo-300 light:bg-indigo-100 light:text-indigo-700 text-xs font-semibold px-3 py-1">
            {ARCHETYPE_LABELS[idea.archetype] ?? idea.archetype}
          </span>
        </div>

        <ConfirmForm ideaId={idea.id} currentArchetype={idea.archetype} archetypeLabels={ARCHETYPE_LABELS} />
      </div>
    </main>
  )
}
