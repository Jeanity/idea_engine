import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createDbClient } from '@/lib/db'
import { AppHeader } from '@/components/app-header'
import { formatAnswer } from '@/lib/format-answer'
import { StartOverButton } from '@/components/start-over-button'
import { loadQuestionBank, filterVisibleAnswers } from '@/lib/question-bank'

export const metadata = { title: 'Review Answers — HadIdea' }

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

  // Stale hidden-branch answers (show_if no longer matches after the founder
  // changed a controlling answer) are excluded from the review list — mirrors
  // the filtering applied before report generation (src/lib/question-bank.ts).
  const rows = filterVisibleAnswers(loadQuestionBank(idea.archetype), answers ?? [])

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
              <Link
                key={row.question_key}
                href={`/app/ideas/${id}/questions?edit=${encodeURIComponent(row.question_key)}`}
                className="group flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm px-5 py-4 hover:border-indigo-400/40 light:hover:border-indigo-300 transition-colors"
              >
                <div>
                  <p className="text-xs text-slate-400 light:text-gray-500 mb-1">{row.question_text}</p>
                  <p className="text-sm text-white light:text-gray-900 font-medium">{formatAnswer(row.answer_text, row.question_key)}</p>
                </div>
                <span className="shrink-0 mt-0.5 text-xs text-slate-500 group-hover:text-indigo-400 light:text-gray-400 light:group-hover:text-indigo-600 transition-colors">
                  Edit ✎
                </span>
              </Link>
            ))}
          </div>
        )}

        {/* Pre-generation only: the free-edit moment. Once a report exists the
            status is researching/ready and this nudge no longer applies. */}
        {idea.status !== 'researching' && idea.status !== 'ready' && rows.length > 0 && (
          <div className="rounded-2xl border border-indigo-400/30 bg-indigo-500/10 light:bg-indigo-50 light:border-indigo-200 light:shadow-sm px-5 py-4 mb-8">
            <p className="text-sm font-medium text-white light:text-gray-900 mb-1">
              Thought of something else? Change your answers now — it&apos;s free.
            </p>
            <p className="text-sm text-slate-300 light:text-gray-600">
              Your report is built entirely from these answers. Click any answer above to
              change it, or add detail you thought of while answering. After your report is
              generated, editing answers and regenerating counts as a new report.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          {/* The generic wizard link redirects to the report once one exists —
              past that point, per-card Edit links above are the edit path */}
          {(idea.status === 'researching' || idea.status === 'ready') ? (
            <span className="text-sm text-slate-500 light:text-gray-400">Click any answer to edit it</span>
          ) : (
            <Link
              href={`/app/ideas/${id}/questions`}
              className="text-sm text-slate-300 hover:text-white light:text-gray-700 light:hover:text-gray-900"
            >
              ← Edit answers
            </Link>
          )}
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

        <div className="flex justify-center pt-6">
          <StartOverButton ideaId={id} />
        </div>
      </div>
    </main>
  )
}
