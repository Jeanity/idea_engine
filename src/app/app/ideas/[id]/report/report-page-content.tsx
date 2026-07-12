import { redirect, notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { rewriteAffiliateUrls } from '@/lib/affiliate-rewrite'
import { resolveEssentialServices } from '@/lib/essential-services'
import { getPromoPublicStatus, readPromoConfig } from '@/lib/promo'
import { pickSurveyFor, pickPromoGateSurveys } from '@/lib/survey'
import { maybeGateReport } from '@/lib/teaser-gating'
import { loadQuestionBank, filterVisibleAnswers } from '@/lib/question-bank'
import { parseCapitalRange } from '@/lib/derived-metrics'
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

  // "At a glance" budget-fit tile (src/lib/derived-metrics.ts) needs the
  // founder's stated capital band alongside the report — one extra query,
  // computed server-side so the client component stays free of
  // question-bank knowledge.
  const { data: answerRows } = await supabase
    .from('answers')
    .select('question_key, answer_text')
    .eq('idea_id', id)
  const questionBank = loadQuestionBank(idea.archetype)
  const visibleAnswerRows = filterVisibleAnswers(questionBank, answerRows ?? [])
  const capitalAnswer = visibleAnswerRows.find(
    a => questionBank.find(q => q.key === a.question_key)?.maps_to === 'cost.startup_capital'
  )
  const statedCapital = parseCapitalRange(capitalAnswer?.answer_text ?? null)

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

  // Which survey placement this page is: a report with populated `sections`
  // is the full report (mirrors hasFullSections in report-client.tsx);
  // anything else that renders a survey at all is the initial report.
  const hasFullSections =
    report?.status === 'complete' && Object.keys((report.sections as object | null) ?? {}).length > 0
  const surveyData = await pickSurveyFor(
    createServiceClient(),
    supabase,
    user.id,
    hasFullSections ? 'full_report_end' : 'initial_report_end'
  )

  // Promo overlay surveys (migration 028) — admins never see these; they
  // always have full access regardless of promo state, so gating them with
  // a blocking survey overlay would make no sense.
  const promoSurveys = isAdmin
    ? { initial: null, full: null }
    : await pickPromoGateSurveys(createServiceClient(), supabase, user.id, await readPromoConfig(createServiceClient()))

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

  // Teaser gating LAST, after the affiliate rewrite — it strips fields, so
  // anything it removes was rewritten in vain (harmless), but the reverse
  // order would rewrite links inside content that never ships.
  let gatedReport = deliveredReport
  if (deliveredReport) {
    gatedReport = await maybeGateReport(createServiceClient(), deliveredReport)
  }

  return (
    <ReportClient
      ideaId={id}
      restatement={idea.restatement}
      archetype={idea.archetype}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialReport={gatedReport ? (gatedReport as any) : null}
      initialFeedback={feedback ?? null}
      feedbackReplies={feedbackReplies}
      isAdmin={isAdmin}
      promoStatus={promoStatus}
      surveyData={surveyData}
      promoSurveys={promoSurveys}
      essentialServices={essentialServices}
      statedCapital={statedCapital}
    />
  )
}
