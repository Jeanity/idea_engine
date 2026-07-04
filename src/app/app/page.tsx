import { createDbClient } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AppHeader } from '@/components/app-header'

export const metadata = { title: 'Dashboard — Idea Engine' }

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

const STATUS_LABELS: Record<string, string> = {
  draft: 'Classifying',
  questioning: 'In progress',
  researching: 'Researching',
  ready: 'Report ready',
}

const STATUS_COLOURS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  questioning: 'bg-yellow-100 text-yellow-700',
  researching: 'bg-blue-100 text-blue-700',
  ready: 'bg-green-100 text-green-700',
}

function ideaHref(id: string, status: string) {
  if (status === 'draft') return `/app/ideas/${id}/confirm`
  if (status === 'questioning') return `/app/ideas/${id}/questions`
  return `/app/ideas/${id}/report`
}

export default async function DashboardPage() {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const { data: ideas } = await supabase
    .from('ideas')
    .select('id, raw_text, archetype, status, created_at')
    .order('created_at', { ascending: false })

  return (
    <main className="min-h-screen bg-gray-50">
      <AppHeader email={user.email!} />

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Your ideas</h1>
          <Link
            href="/app/new"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white
                       hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            + New idea
          </Link>
        </div>

        {!ideas?.length ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
            <p className="text-gray-500 text-sm mb-4">You haven&apos;t added any ideas yet.</p>
            <Link
              href="/app/new"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              Describe your first idea →
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {ideas.map((idea) => (
              <li key={idea.id}>
                <Link
                  href={ideaHref(idea.id, idea.status)}
                  className="flex items-center justify-between gap-4 rounded-lg border border-gray-200
                             bg-white px-5 py-4 hover:border-indigo-200 hover:bg-indigo-50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{idea.raw_text}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {ARCHETYPE_LABELS[idea.archetype] ?? idea.archetype}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOURS[idea.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABELS[idea.status] ?? idea.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
