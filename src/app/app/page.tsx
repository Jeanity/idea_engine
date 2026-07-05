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
  draft: 'bg-slate-500/15 text-slate-300',
  questioning: 'bg-yellow-500/15 text-yellow-300',
  researching: 'bg-blue-500/15 text-blue-300',
  ready: 'bg-emerald-500/15 text-emerald-300',
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
    <main className="relative min-h-screen bg-slate-950 overflow-hidden">
      <div className="absolute inset-0 dot-grid opacity-40" aria-hidden="true" />
      <div
        className="pointer-events-none absolute -top-32 left-1/3 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative z-10">
        <AppHeader email={user.email!} />

        <div className="max-w-4xl mx-auto px-6 py-12">
          <div id="new" className="relative z-10 rounded-2xl border border-white/10 bg-slate-900/80 p-8 mb-12 scroll-mt-6">
            <h1 className="text-2xl font-semibold text-white mb-1">What&apos;s the idea?</h1>
            <p className="text-sm text-slate-400 mb-6">
              Describe it in plain English — rough is fine. The engine turns it into a researched, costed plan.
            </p>
            <NewIdeaForm
              defaultCountry={mostRecent?.location_country ?? ''}
              defaultRegion={mostRecent?.location_region ?? ''}
            />
          </div>

          <h2 className="text-lg font-semibold text-white mb-4">Your ideas</h2>

          {!ideas?.length ? (
            <p className="text-sm text-slate-400">Your ideas will appear here.</p>
          ) : (
            <ul className="space-y-3">
              {ideas.map((idea) => (
                <li key={idea.id}>
                  <Link
                    href={ideaHref(idea.id, idea.status)}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-white/10
                               bg-slate-900/80 px-5 py-4 hover:border-indigo-400/50 hover:bg-white/5 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{idea.raw_text}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {ARCHETYPE_LABELS[idea.archetype] ?? idea.archetype}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOURS[idea.status] ?? 'bg-slate-500/15 text-slate-300'}`}>
                      {STATUS_LABELS[idea.status] ?? idea.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  )
}
