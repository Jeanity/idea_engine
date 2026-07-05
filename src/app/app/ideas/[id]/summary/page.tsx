import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createDbClient } from '@/lib/db'
import { AppHeader } from '@/components/app-header'

export const metadata = { title: 'Review Answers — Idea Engine' }

const ARCHETYPE_LABELS: Record<string, string> = {
  physical_product: 'Physical Product',
  local_service: 'Local Service',
  software_app: 'Software / App',
  ecommerce_brand: 'E-commerce Brand',
  content_education: 'Content / Education',
  marketplace: 'Marketplace',
  invention: 'Invention',
  other: 'Other',
}

function formatAnswer(text: string): string {
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) return parsed.join(', ')
  } catch {
    // not JSON, return as-is
  }
  return text
}

export default async function SummaryPage({ params }: { params: Promise<{ id: string }> }) {
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

  if (idea.status === 'draft') redirect(`/app/ideas/${id}/confirm`)

  const { data: answers } = await supabase
    .from('answers')
    .select('question_key, question_text, answer_text, position')
    .eq('idea_id', id)
    .order('position')

  const rows = answers ?? []

  return (
    <main className="min-h-screen bg-slate-950 light:bg-gray-50">
      <AppHeader email={user.email!} />
      <div className="max-w-2xl mx-auto px-6 py-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-400 mb-2">
          Step 3 of 3 — Review
        </p>
        <h1 className="text-2xl font-semibold text-white light:text-gray-900 mb-1">Your answers</h1>
        <p className="text-slate-400 light:text-gray-500 text-sm mb-8">
          {idea.restatement}
          <span className="ml-2 inline-flex items-center rounded-full bg-indigo-500/15 light:bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-300 light:text-indigo-700">
            {ARCHETYPE_LABELS[idea.archetype] ?? idea.archetype}
          </span>
        </p>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm p-8 text-center text-slate-500 light:text-gray-400 text-sm">
            No answers yet.{' '}
            <Link href={`/app/ideas/${id}/questions`} className="text-indigo-400 hover:underline">
              Start the questionnaire
            </Link>
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {rows.map(row => (
              <div key={row.question_key} className="rounded-2xl border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm px-5 py-4">
                <p className="text-xs text-slate-400 light:text-gray-500 mb-1">{row.question_text}</p>
                <p className="text-sm text-white light:text-gray-900 font-medium">{formatAnswer(row.answer_text)}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <Link
            href={`/app/ideas/${id}/questions`}
            className="text-sm text-slate-300 hover:text-white light:text-gray-700 light:hover:text-gray-900"
          >
            ← Edit answers
          </Link>
          {(idea.status === 'researching' || idea.status === 'ready') ? (
            <Link
              href={`/app/ideas/${id}/report`}
              className="inline-flex items-center rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-400 transition-colors"
            >
              View report →
            </Link>
          ) : (
            rows.length > 0 && (
              <Link
                href={`/app/ideas/${id}/report`}
                className="inline-flex items-center rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-400 transition-colors"
              >
                Generate report →
              </Link>
            )
          )}
        </div>
      </div>
    </main>
  )
}
