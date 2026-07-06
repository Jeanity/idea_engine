import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createDbClient } from '@/lib/db'
import { AppHeader } from '@/components/app-header'
import { ScoreRing } from '@/components/score-ring'
import { ARCHETYPE_LABELS } from '@/lib/archetype-labels'
import { deriveHeadlineScore } from '@/lib/viability-score'
import AccountForm from './account-form'

export const metadata = { title: 'Account — Idea Engine' }

const STATUS_LABELS: Record<string, string> = {
  draft: 'Classifying',
  questioning: 'In progress',
  researching: 'Researching',
  ready: 'Report ready',
}

const STATUS_COLOURS: Record<string, string> = {
  draft: 'bg-slate-500/15 text-slate-300 light:bg-slate-100 light:text-slate-700',
  questioning: 'bg-yellow-500/15 text-yellow-300 light:bg-yellow-100 light:text-yellow-700',
  researching: 'bg-blue-500/15 text-blue-300 light:bg-blue-100 light:text-blue-700',
  ready: 'bg-emerald-500/15 text-emerald-300 light:bg-emerald-100 light:text-emerald-700',
}

function ideaHref(id: string, status: string) {
  if (status === 'draft') return `/app/ideas/${id}/confirm`
  if (status === 'questioning') return `/app/ideas/${id}/questions`
  return `/app/ideas/${id}/report`
}

function isUnavailable(v: unknown): boolean {
  return typeof v === 'object' && v !== null && (v as Record<string, unknown>).status === 'unavailable'
}

interface ReportRow {
  status: string
  sections: Record<string, unknown> | null
  preview_sections: Record<string, unknown> | null
}

// One idea's report can be in three meaningfully different places for this
// list: no report content yet, a teaser only (sections empty, sections live
// in preview_sections — see generate-teaser.ts), or a full report (sections
// populated with competitors/costs/etc — see generate-report.ts's assemble
// step). The score donut and "Download PDF" link both need to know which.
function reportDisplayState(report: ReportRow | null) {
  const sections = report?.sections ?? {}
  const preview = report?.preview_sections ?? {}
  const hasFullSections = Object.keys(sections).length > 0 && sections.competitors !== undefined
  const hasTeaserOnly = !hasFullSections && Object.keys(preview).length > 0
  const vs = hasFullSections ? sections.viability_snapshot : preview.viability_snapshot
  const scores = !isUnavailable(vs) && vs && typeof vs === 'object' ? (vs as { scores?: unknown }).scores : undefined

  return {
    isGenerating: report?.status === 'running' || report?.status === 'queued',
    isFailed: report?.status === 'failed',
    canDownload: report?.status === 'complete' && (hasFullSections || hasTeaserOnly),
    // Product voice: never "teaser" in user-facing copy — "initial report".
    kindLabel: hasFullSections ? 'Full report' : hasTeaserOnly ? 'Initial report' : null,
    headlineScore: scores && typeof scores === 'object' ? deriveHeadlineScore(scores as Parameters<typeof deriveHeadlineScore>[0]) : null,
  }
}

export default async function AccountPage() {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, default_country, default_region, marketing_opt_in')
    .eq('id', user.id)
    .single()

  const { data: ideas } = await supabase
    .from('ideas')
    .select('id, raw_text, archetype, status, created_at, reports(status, sections, preview_sections)')
    .order('created_at', { ascending: false })

  const initialSource = profile?.display_name ?? profile?.username ?? user.email!
  const initial = initialSource.trim().charAt(0).toUpperCase()
  const identityName = profile?.display_name ?? profile?.username ?? user.email!

  return (
    <main className="min-h-screen bg-slate-950 light:bg-gray-50">
      <AppHeader email={user.email!} />
      <div className="max-w-2xl mx-auto px-6 py-12">
        <Link href="/app" className="inline-flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 font-medium mb-6">
          ← New idea
        </Link>
        <h1 className="text-2xl font-semibold text-white light:text-gray-900 mb-1">Account</h1>
        <p className="text-sm text-slate-400 light:text-gray-500 mb-8">Manage your profile and preferences.</p>

        <div className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-6 mb-10 flex items-center gap-4">
          <div className="flex-shrink-0 h-14 w-14 rounded-full bg-white/15 border border-white/30 flex items-center justify-center text-xl font-semibold text-white">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold truncate">{identityName}</p>
            <p className="text-indigo-200 text-sm truncate">{user.email}</p>
          </div>
        </div>

        <div id="your-ideas" className="scroll-mt-6 mb-10">
          <h2 className="text-lg font-semibold text-white light:text-gray-900 mb-4">Your ideas</h2>

          {!ideas?.length ? (
            <p className="text-sm text-slate-400 light:text-gray-500">
              No ideas yet — <Link href="/app" className="text-indigo-400 hover:underline">start one</Link>.
            </p>
          ) : (
            <ul className="space-y-3">
              {ideas.map((idea) => {
                // Supabase returns the to-one embed as an object, but its
                // inferred type is loose here — narrow it defensively.
                const report = (Array.isArray(idea.reports) ? idea.reports[0] : idea.reports) as ReportRow | null
                const { isGenerating, isFailed, canDownload, kindLabel, headlineScore } = reportDisplayState(report)

                return (
                  <li key={idea.id} className="rounded-2xl border border-white/10 bg-slate-900/80 light:border-gray-200 light:bg-white light:shadow-sm px-5 py-4">
                    <div className="flex items-center gap-4">
                      {headlineScore !== null ? (
                        <ScoreRing score={headlineScore} label="" size={44} />
                      ) : (
                        <div className="shrink-0 h-11 w-11 rounded-full border-2 border-dashed border-white/15 light:border-gray-300" aria-hidden="true" />
                      )}

                      <Link href={ideaHref(idea.id, idea.status)} className="min-w-0 flex-1 group">
                        <p className="text-sm font-medium text-white light:text-gray-900 truncate group-hover:text-indigo-300 light:group-hover:text-indigo-600 transition-colors">
                          {idea.raw_text}
                        </p>
                        <p className="text-xs text-slate-500 light:text-gray-400 mt-0.5">
                          {ARCHETYPE_LABELS[idea.archetype] ?? idea.archetype}
                          {kindLabel && <span className="mx-1.5">·</span>}
                          {kindLabel}
                        </p>
                      </Link>

                      <div className="shrink-0 flex flex-col items-end gap-1.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          isFailed ? 'bg-red-500/15 text-red-300 light:bg-red-100 light:text-red-700'
                          : isGenerating ? 'bg-blue-500/15 text-blue-300 light:bg-blue-100 light:text-blue-700'
                          // The pipeline never flips ideas.status past 'researching' when a
                          // report completes — a finished report is what canDownload detects,
                          // so trust that over the stale idea status.
                          : canDownload ? 'bg-emerald-500/15 text-emerald-300 light:bg-emerald-100 light:text-emerald-700'
                          : STATUS_COLOURS[idea.status] ?? 'bg-slate-500/15 text-slate-300'
                        }`}>
                          {isFailed ? 'Failed' : isGenerating ? 'Generating…' : canDownload ? 'Report ready' : STATUS_LABELS[idea.status] ?? idea.status}
                        </span>
                        {canDownload && (
                          <a
                            href={`/api/ideas/${idea.id}/report/pdf`}
                            className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline font-medium"
                          >
                            Download PDF
                          </a>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/80 light:border-gray-200 light:bg-white light:shadow-sm px-6 py-6">
          <AccountForm
            email={user.email!}
            profile={{
              username: profile?.username ?? null,
              display_name: profile?.display_name ?? null,
              default_country: profile?.default_country ?? null,
              default_region: profile?.default_region ?? null,
              marketing_opt_in: profile?.marketing_opt_in ?? false,
            }}
          />
        </div>
      </div>
    </main>
  )
}
