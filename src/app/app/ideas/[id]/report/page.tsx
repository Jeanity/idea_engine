import { redirect, notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { createDbClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { rewriteAffiliateUrls } from '@/lib/affiliate-rewrite'
import { AppHeader } from '@/components/app-header'
import ReportClient from './report-client'

export const metadata = { title: 'Report — Idea Engine' }

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
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
        .select('rating, comment, allow_public')
        .eq('report_id', report.id)
        .maybeSingle()
    : { data: null }

  const isAdmin = isAdminEmail(user.email)

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
    <main className="min-h-screen bg-slate-950 light:bg-gray-50">
      <AppHeader email={user.email!} />
      <ReportClient
        ideaId={id}
        restatement={idea.restatement}
        archetype={idea.archetype}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        initialReport={deliveredReport ? (deliveredReport as any) : null}
        initialFeedback={feedback ?? null}
        isAdmin={isAdmin}
      />
    </main>
  )
}
