import { renderToBuffer } from '@react-pdf/renderer'
import { createDbClient, createServiceClient } from '@/lib/db'
import { readTeaserGatingConfig, gatePreviewSections } from '@/lib/teaser-gating'
import { ReportDocument, type ReportPdfInput } from '@/lib/pdf/ReportDocument'
import { rewriteAffiliateUrls } from '@/lib/affiliate-rewrite'
import { resolveEssentialServices, absolutizeEssentialServices } from '@/lib/essential-services'
import { deepStripCites } from '@/lib/cite'
import { formatAnswer } from '@/lib/format-answer'
import { loadQuestionBank, filterVisibleAnswers } from '@/lib/question-bank'
import { NextResponse, type NextRequest } from 'next/server'

// react-pdf renders via a Node canvas/font pipeline that the Edge runtime
// cannot run — this route must stay on the Node.js runtime.
export const runtime = 'nodejs'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  // createDbClient respects RLS ("ideas: select own" / "reports: select own"),
  // so a non-owner's request simply finds no row here — no manual owner_id check needed.
  const { data: idea } = await supabase
    .from('ideas')
    .select('id, raw_text, restatement, archetype, location_country, location_region')
    .eq('id', id)
    .single()
  if (!idea) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: report } = await supabase
    .from('reports')
    .select('status, sections, preview_sections, generation_completed_at')
    .eq('idea_id', id)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fullSections = (report?.sections as any) ?? {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const previewSections = (report?.preview_sections as any) ?? {}
  const hasFullSections = Object.keys(fullSections).length > 0 && fullSections.competitors !== undefined
  const hasTeaserOnly = !hasFullSections && Object.keys(previewSections).length > 0

  // A report that's only reached the teaser stage (see generate-teaser.ts)
  // stores its content in preview_sections, not sections — ReportDocument
  // already hides any key it doesn't find, so handing it the teaser's
  // summary/viability_snapshot renders a shorter, but real, PDF rather than
  // refusing the download entirely.
  if (report?.status !== 'complete' || (!hasFullSections && !hasTeaserOnly)) {
    return NextResponse.json({ error: 'Nothing has been generated for this idea yet.' }, { status: 409 })
  }
  let rawSections = hasFullSections ? fullSections : previewSections

  // Teaser gating (src/lib/teaser-gating.ts) applies to the PDF too — the
  // download must not hand out the sub-scores the web page just redacted.
  // The gated snapshot shape isn't a renderable PDF section (and the locked
  // skeletons are a web-only treatment), so the teaser PDF becomes summary +
  // first next step; ReportDocument already hides keys it doesn't find.
  if (hasTeaserOnly) {
    const gatingConfig = await readTeaserGatingConfig(createServiceClient())
    if (gatingConfig.enabled) {
      const gated = gatePreviewSections(previewSections)
      delete gated.viability_snapshot
      delete gated.locked_next_steps
      rawSections = gated
    }
  }

  // Affiliate rewrite at DELIVERY time (mirrors the web report page): swap any
  // report URL on a partner's match_domain for a /go/<slug> tracking link.
  // Active links come via the "public select active" RLS policy.
  const { data: affiliateLinks } = await supabase
    .from('affiliate_links')
    .select('slug, match_domains')
    .eq('active', true)
  // Strip <cite …> web-search markers for print — the web UI renders them as
  // highlighted quoted-from-source spans, but the PDF has no equivalent
  // treatment, so the quoted text is kept and the tags dropped.
  const sections = deepStripCites(
    affiliateLinks && affiliateLinks.length > 0
      ? rewriteAffiliateUrls(rawSections as Record<string, unknown>, affiliateLinks, request.nextUrl.origin, id)
      : rawSections
  )

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  const { data: answers } = await supabase
    .from('answers')
    .select('question_key, question_text, answer_text, position')
    .eq('idea_id', id)
    .order('position')

  // Stale hidden-branch answers (show_if no longer matches after the founder
  // changed a controlling answer) are excluded from the appendix — mirrors
  // the filtering applied before report generation (src/lib/question-bank.ts).
  const visibleAnswers = filterVisibleAnswers(loadQuestionBank(idea.archetype), answers ?? [])

  // Render-time "Your support team" block, mirroring the web report page.
  // PDF hrefs must be absolute — the affiliate /go/ hop only works against
  // this request's origin, so absolutize after resolving.
  const essentialServices = absolutizeEssentialServices(
    await resolveEssentialServices(supabase, idea.location_country, idea.archetype),
    request.nextUrl.origin
  )

  const reportTitle = `HadIdea — ${idea.restatement ?? 'Business Viability Report'}`

  const data: ReportPdfInput = {
    reportTitle,
    restatement: idea.restatement,
    rawText: idea.raw_text,
    archetype: idea.archetype,
    locationCountry: idea.location_country,
    locationRegion: idea.location_region,
    generatedAt: report?.generation_completed_at ?? new Date().toISOString(),
    preparedFor: profile?.display_name || user.email || 'Founder',
    sections,
    answers: visibleAnswers.map(a => ({ question: a.question_text, answer: formatAnswer(a.answer_text, a.question_key) })),
    editAnswersUrl: `${request.nextUrl.origin}/app/ideas/${id}/summary`,
    essentialServices,
  }

  const buffer = await renderToBuffer(<ReportDocument data={data} />)

  const filename = `hadidea-report-${id.slice(0, 8)}.pdf`
  // Buffer's TS type doesn't structurally satisfy BodyInit in this Node/lib.dom
  // combination — a plain Uint8Array copy does.
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
