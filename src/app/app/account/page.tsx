import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createDbClient, createServiceClient } from '@/lib/db'
import { ScoreRing } from '@/components/score-ring'
import { OfferBanners, type BannerOffer } from '@/components/offer-banner'
import { ARCHETYPE_LABELS } from '@/lib/archetype-labels'
import { deriveHeadlineScore } from '@/lib/viability-score'
import { isNewUser } from '@/lib/offers'
import { getPromoPublicStatus } from '@/lib/promo'
import { pickSurveyFor } from '@/lib/survey'
import { SurveyCard } from '@/components/survey-card'

export const metadata = { title: 'My ideas — HadIdea' }

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

// Non-ready statuses stay outside the account shell (the confirm/questions
// flow) — only a finished report reads in-place, via the account-scoped
// report route.
function ideaHref(id: string, status: string) {
  if (status === 'draft') return `/app/ideas/${id}/confirm`
  if (status === 'questioning') return `/app/ideas/${id}/questions`
  return `/app/account/ideas/${id}/report`
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

/**
 * Fetches account-page-visible offers for a signed-in viewer.
 *
 * `supabase` here is the per-request client (respects RLS as the signed-in
 * user) — RLS ("offers: authenticated select account") already narrows this
 * to live rows with `show_in_account = true`, but does NOT filter by
 * audience (it can't see profile.created_at). The audience rule itself is
 * applied here: 'everyone' and 'account_holders' always show to a signed-in
 * viewer; 'new_users' only shows if the profile is within the new-user
 * window (see NEW_USER_WINDOW_DAYS in src/lib/offers.ts).
 */
async function getAccountOffers(
  supabase: Awaited<ReturnType<typeof createDbClient>>,
  profileCreatedAt: string
): Promise<BannerOffer[]> {
  const { data } = await supabase
    .from('offers')
    .select('id, code, description, percent_off, amount_off_cents, audience')
    .order('created_at', { ascending: false })

  const viewerIsNew = isNewUser(profileCreatedAt)

  return (data ?? []).filter(
    o => o.audience === 'everyone' || o.audience === 'account_holders' || (o.audience === 'new_users' && viewerIsNew)
  )
}

export default async function MyIdeasPage() {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, created_at')
    .eq('id', user.id)
    .single()

  const offers = await getAccountOffers(supabase, profile?.created_at ?? user.created_at)
  const promoStatus = await getPromoPublicStatus(createServiceClient(), user.id)
  const surveyData = await pickSurveyFor(createServiceClient(), supabase, user.id, 'account')

  const { data: ideas } = await supabase
    .from('ideas')
    .select('id, raw_text, archetype, status, created_at, reports(status, sections, preview_sections)')
    .order('created_at', { ascending: false })

  // Username-first public identity (src/lib/public-name.ts precedence).
  const identityName = profile?.username ?? profile?.display_name ?? user.email!
  const initial = identityName.trim().charAt(0).toUpperCase()

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-white light:text-gray-900 mb-1">My ideas</h1>
      <p className="text-sm text-slate-400 light:text-gray-500 mb-8">Your submitted ideas and their reports.</p>

      {offers.length > 0 && (
        <div className="mb-8">
          <OfferBanners offers={offers} />
        </div>
      )}

      <div className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-6 mb-8 flex items-center gap-4">
        <div className="flex-shrink-0 h-14 w-14 rounded-full bg-white/15 border border-white/30 flex items-center justify-center text-xl font-semibold text-white">
          {initial}
        </div>
        <div className="min-w-0">
          <p className="text-white font-semibold truncate">{identityName}</p>
          <p className="text-indigo-200 text-sm truncate">{user.email}</p>
        </div>
      </div>

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

                  <div className="flex w-28 shrink-0 flex-col items-end gap-1.5 text-right sm:w-auto">
                    {/* A finished report gets an action button, not a status badge —
                        ideas.status never advances past 'researching' when a report
                        completes, so canDownload (a finished report existing) is the
                        trustworthy signal. */}
                    {canDownload && !isGenerating && !isFailed ? (
                      <Link
                        href={`/app/account/ideas/${idea.id}/report`}
                        className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm
                                   hover:bg-emerald-400 transition-colors"
                      >
                        Read Report →
                      </Link>
                    ) : (
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        isFailed ? 'bg-red-500/15 text-red-300 light:bg-red-100 light:text-red-700'
                        : isGenerating ? 'bg-blue-500/15 text-blue-300 light:bg-blue-100 light:text-blue-700'
                        : STATUS_COLOURS[idea.status] ?? 'bg-slate-500/15 text-slate-300'
                      }`}>
                        {isFailed ? 'Failed' : isGenerating ? 'Generating…' : STATUS_LABELS[idea.status] ?? idea.status}
                      </span>
                    )}
                    {canDownload && (
                      <a
                        href={`/api/ideas/${idea.id}/report/pdf`}
                        className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline font-medium"
                      >
                        Download PDF
                      </a>
                    )}
                    {canDownload && kindLabel === 'Initial report' && (
                      promoStatus.active && promoStatus.perUserRemaining !== 0 ? (
                        // Promo mode is on and this user hasn't used their free
                        // report yet — send them to the report page, which has
                        // the real unlock button and the generation-progress flow.
                        <Link
                          href={`/app/account/ideas/${idea.id}/report`}
                          className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline font-medium"
                        >
                          Generate full report · free
                        </Link>
                      ) : promoStatus.active ? (
                        <button
                          type="button"
                          disabled
                          title="Free launch limit reached"
                          className="text-xs text-slate-500 light:text-gray-400 font-medium cursor-not-allowed"
                        >
                          Free limit reached
                        </button>
                      ) : (
                        // TODO(Phase 5): wire to Stripe checkout once the account is
                        // activated — inert on purpose until then, matching the report
                        // page's "Unlock full report — coming soon" button.
                        <button
                          type="button"
                          disabled
                          title="Coming soon"
                          className="text-xs text-slate-500 light:text-gray-400 font-medium cursor-not-allowed"
                        >
                          Purchase full report · coming soon
                        </button>
                      )
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {surveyData.show && (
        <div className="mt-8">
          <SurveyCard data={surveyData} className="" />
        </div>
      )}
    </div>
  )
}
