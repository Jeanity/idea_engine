import { createDbClient } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AppHeader } from '@/components/app-header'
import NewIdeaForm from '@/components/new-idea-form'

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
    .select('id, raw_text, archetype, status, created_at, location_country, location_region')
    .order('created_at', { ascending: false })

  const mostRecent = ideas?.[0]

  return (
    <main className="min-h-screen bg-gray-50">
      <AppHeader email={user.email!} />

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div id="new" className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm mb-12 scroll-mt-6">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">What&apos;s the idea?</h1>
          <p className="text-sm text-gray-500 mb-6">
            Describe it in plain English — rough is fine. The engine turns it into a researched, costed plan.
          </p>
          <NewIdeaForm
            defaultCountry={mostRecent?.location_country ?? ''}
            defaultRegion={mostRecent?.location_region ?? ''}
          />
        </div>

        <h2 className="text-lg font-semibold text-gray-900 mb-4">Your ideas</h2>

        {!ideas?.length ? (
          <p className="text-sm text-gray-500">Your ideas will appear here.</p>
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
