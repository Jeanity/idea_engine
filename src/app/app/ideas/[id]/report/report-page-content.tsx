import { redirect, notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { rewriteAffiliateUrls } from '@/lib/affiliate-rewrite'
import { resolveEssentialServices } from '@/lib/essential-services'
import { getPromoPublicStatus } from '@/lib/promo'
import { getSurveyCardData } from '@/lib/survey'
import ReportClient from './report-client'

// Shared data-fetch + render for a report — used by both the standalone
// report route (src/app/app/ideas/[id]/report/page.tsx) and the account-scoped
// in-place route (src/app/app/account/ideas/[id]/report/page.tsx). Callers own
// their own outer chrome (AppHeader vs. the account shell) — this component
// renders only the report body.
export async function ReportPageContent({ id }: { id: string }) {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const { data: idea } = await supabase
    .from('ideas')
    .select('id, restatement, archetype, status, location_country')
    .eq('id', id)
    .single()

  if (!idea) notFound()

  if (idea.status === 'questioning' || idea.status === 'draft') {
    redirect(`/app/ideas/${id}/questions`)
  }

  const { data: report } = await supabase
    .from('reports')
    .select('id, status, sections, preview_sections, error')
    .eq('idea_id', id)
    .single()

  // RLS ("report_feedback: select own") already scopes this to the caller's
  // own row — .maybeSingle() because a report may not have feedback yet.
  const { data: feedback } = report
    ? await supabase
        .from('report_feedback')
        .select('id, rating, comment, allow_public')
        .eq('report_id', report.id)
        .maybeSingle()
    : { data: null }

  // Replies (migration 019) — the owner always sees replies to their own
  // feedback (public or private), via RLS ("feedback_replies: select own via
  // feedback"). The table may not exist yet, so this fails gracefully.
  let feedbackReplies: { id: string; body: string; is_public: boolean; created_at: string; created_by: string }[] = []
  if (feedback) {
    const { data: replies, error: repliesError } = await supabase
      .from('feedback_replies')
      .select('id, body, is_public, created_at, created_by')
      .eq('feedback_id', feedback.id)
      .order('created_at', { ascending: true })
    if (!repliesError) feedbackReplies = replies ?? []
  }

  const isAdmin = isAdminEmail(user.email)

  // app_settings has no RLS policies at all (service-role only, see migration
  // 013), so this is the one place on this user page that reaches for the
  // service client — scoped to app-global config plus this user's own report
  // count, never another user's data. See getPromoPublicStatus for the
  // narrow, user-safe shape it returns.
  const promoStatus = await getPromoPublicStatus(createServiceClient(), user.id)
  const surveyData = await getSurveyCardData(createServiceClient(), supabase, user.id)

  // Render-time "Your support team" block (Legal & Compliance tab) — never
  // stored in report sections, never touched by the AI pipeline. Reads active
  // links via the same public RLS policy as the rewrite engine above, so this
  // is retroactive: a link added/removed in admin applies on next view.
  const essentialServices = await resolveEssentialServices(supabase, idea.location_country, idea.archetype)

  // Affiliate rewrite at DELIVERY time (never at generation): swap any report
  // URL on a partner's match_domain for a /go/<slug> tracking link. Active
  // links are readable via the "public select active" RLS policy, so the
  // ordinary (RLS) client above is enough — no service client needed here.
  let deliveredReport = report
  if (report) {
    const { data: affiliateLinks } = await supabase
      .from('affiliate_links')
      .select('slug, match_domains')
      .eq('active', true)

    if (affiliateLinks && affiliateLinks.length > 0) {
      const h = await headers()
      const host = h.get('x-forwarded-host') ?? h.get('host') ?? ''
      const proto = h.get('x-forwarded-proto') ?? 'https'
      const origin = host ? `${proto}://${host}` : ''
      deliveredReport = {
        ...report,
        sections: rewriteAffiliateUrls(
          (report.sections ?? {}) as Record<string, unknown>,
          affiliateLinks,
          origin,
          id
        ),
        preview_sections: rewriteAffiliateUrls(
          (report.preview_sections ?? {}) as Record<string, unknown>,
          affiliateLinks,
          origin,
          id
        ),
      } as typeof report
    }
  }

  return (
    <ReportClient
      ideaId={id}
      restatement={idea.restatement}
      archetype={idea.archetype}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialReport={deliveredReport ? (deliveredReport as any) : null}
      initialFeedback={feedback ?? null}
      feedbackReplies={feedbackReplies}
      isAdmin={isAdmin}
      promoStatus={promoStatus}
      surveyData={surveyData}
      essentialServices={essentialServices}
    />
  )
}
