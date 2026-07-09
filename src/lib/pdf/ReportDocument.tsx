import { Document, Page, View, Text, Link } from '@react-pdf/renderer'
import { COLORS, styles } from './theme'
import {
  PageFooter,
  SectionHeading,
  Card,
  Callout,
  SeverityBadge,
  TypeBadge,
  ScoreBar,
  ScoreDonut,
  NumberedRow,
  KVRow,
  ExternalLink,
  QuoteBlock,
} from './components'
import { symbolForCurrency } from '@/lib/countries'
import { deriveHeadlineScore } from '@/lib/viability-score'
import type { ResolvedEssentialService } from '@/lib/essential-services'

// Duplicated from the three other copies in the app (confirm/summary/my-ideas
// pages) — no shared module for this yet, matching existing pattern.
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

function isUnavailable(v: unknown): v is { status: 'unavailable'; reason: string } {
  return typeof v === 'object' && v !== null && (v as Record<string, unknown>).status === 'unavailable'
}

function fmt(sym: string, n: number) {
  return `${sym}${n.toFixed(2)}`
}
function fmt0(sym: string, n: number) {
  return `${sym}${Math.round(n).toLocaleString()}`
}

export interface ReportPdfInput {
  reportTitle: string // used in the running footer
  restatement: string | null
  rawText: string
  archetype: string
  locationCountry: string
  locationRegion: string | null
  generatedAt: string // ISO date
  preparedFor: string // email or display name
  sections: Record<string, unknown>
  answers: { question: string; answer: string }[]
  editAnswersUrl: string
  essentialServices: ResolvedEssentialService[]
}

export function ReportDocument({ data }: { data: ReportPdfInput }) {
  const s = data.sections
  const summary = s.summary as { text: string } | undefined
  const vs = s.viability_snapshot as { scores: Record<string, { score: number; rationale: string }>; overall_verdict: string } | undefined
  const whyProceed = s.why_this_can_work as { market_proof: string; your_edge: string; upside: string } | undefined
  const competitors = s.competitors
  const costBreakdown = s.cost_breakdown as {
    per_unit: Record<string, number | null> | null
    suggested_price: number | null
    gross_margin_pct: number | null
    currency: string
    notes: string
    estimation_flags: Record<string, string>
    startup_costs?: Array<{ item: string; estimate_low: number; estimate_high: number; note: string }>
    ongoing_costs?: Array<{ item: string; estimate_monthly: number; note: string }>
  } | undefined
  const pricing = s.pricing_recommendation as { model: string; suggested_price_or_range: string; rationale: string; comparable_market_rates: string } | undefined
  const fundingOptions = s.funding_options
  const compliance = s.legal_compliance
  const marketing = s.marketing_plan as {
    strategy_summary: string
    free_first: string
    channels: Array<{ name: string; channel_type: string; priority: number; why_this_channel: string; how_to_start: string; est_cost: string; link: string | null }>
    starter_budget: { weekly_total: string; allocation: Array<{ channel: string; amount: string }>; note: string }
  } | undefined
  const risks = s.risks
  const nextSteps = s.next_steps
  const validationCopy = s.validation_copy as { poll_question: string; ad_line: string; forum_post: string } | undefined
  const oneThingToDo = s.one_thing_to_do as { action: string; why_first: string } | undefined

  const hasSummarySection = (summary?.text && !isUnavailable(summary)) || (vs?.scores && !isUnavailable(vs)) || (whyProceed?.market_proof && !isUnavailable(whyProceed))
  const competitorList = !isUnavailable(competitors) && Array.isArray(competitors) ? competitors as Array<Record<string, string>> : []
  const hasCosts = (costBreakdown && !isUnavailable(costBreakdown)) || (pricing && !isUnavailable(pricing)) || (!isUnavailable(fundingOptions) && Array.isArray(fundingOptions) && fundingOptions.length > 0)
  const complianceList = !isUnavailable(compliance) && Array.isArray(compliance) ? compliance as Array<Record<string, string>> : []
  const hasMarketing = marketing?.strategy_summary && !isUnavailable(marketing)
  const riskList = !isUnavailable(risks) && Array.isArray(risks) ? risks as Array<Record<string, string>> : []
  const stepList = !isUnavailable(nextSteps) && Array.isArray(nextSteps) ? nextSteps as Array<Record<string, string>> : []
  const hasNextSteps = riskList.length > 0 || stepList.length > 0 || (validationCopy?.poll_question && !isUnavailable(validationCopy)) || (oneThingToDo?.action && !isUnavailable(oneThingToDo))

  const locationLabel = data.locationRegion ? `${data.locationRegion}, ${data.locationCountry}` : data.locationCountry
  const generatedDate = new Date(data.generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const cb = costBreakdown
  const sym = cb ? symbolForCurrency(cb.currency ?? 'USD') : '$'

  const toc: Array<{ id: string; label: string; show: boolean }> = [
    { id: 'summary', label: 'Executive Summary', show: !!hasSummarySection },
    { id: 'competitors', label: 'Competitive Landscape', show: competitorList.length > 0 },
    { id: 'costs', label: 'Costs & Pricing', show: !!hasCosts },
    { id: 'legal', label: 'Legal & Compliance', show: complianceList.length > 0 },
    { id: 'marketing', label: 'Getting the Word Out', show: !!hasMarketing },
    { id: 'next-steps', label: 'Considerations & Next Steps', show: !!hasNextSteps },
  ].filter(t => t.show)

  return (
    <Document title={data.reportTitle} author="Idea Engine">
      {/* ── Cover page ─────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 90 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.accent, marginRight: 6 }} />
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: COLORS.ink, letterSpacing: 0.5 }}>IDEA ENGINE</Text>
        </View>

        <Text style={styles.eyebrow}>BUSINESS VIABILITY REPORT</Text>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 26, color: COLORS.ink, marginTop: 10, lineHeight: 1.3 }}>
          {data.restatement ?? data.rawText.slice(0, 140)}
        </Text>

        <View style={{ marginTop: 24, flexDirection: 'row', gap: 8 }}>
          <TypeBadge label={ARCHETYPE_LABELS[data.archetype] ?? data.archetype} tone="accent" />
        </View>

        <View style={[styles.divider, { marginTop: 28, marginBottom: 20 }]} />

        <KVRow label="Prepared for" value={data.preparedFor} />
        <KVRow label="Market" value={locationLabel || 'Not specified'} />
        <KVRow label="Report generated" value={generatedDate} />

        {vs?.overall_verdict && !isUnavailable(vs) && (
          <View style={{ marginTop: 40 }}>
            <Text style={[styles.eyebrow, { marginBottom: 8 }]}>THE HEADLINE</Text>
            <QuoteBlock>{vs.overall_verdict}</QuoteBlock>
          </View>
        )}

        <View style={{ position: 'absolute', bottom: 56, left: 48, right: 48 }}>
          <View style={styles.divider} />
          <Text style={styles.footerText}>
            Prepared by Idea Engine. This report contains AI-assisted research and estimates for planning purposes —
            it is not legal, financial, tax, or professional advice. Confidential — prepared solely for the person
            named above.
          </Text>
        </View>
      </Page>

      {/* ── Table of contents ─────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <Text style={[styles.h1, { fontSize: 17, marginBottom: 24 }]}>Contents</Text>
        {toc.map((t, i) => (
          <Link key={t.id} src={`#${t.id}`} style={{ textDecoration: 'none' }}>
            <View style={[styles.spaceBetween, { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 9, color: COLORS.faint, marginRight: 10, width: 16 }}>{String(i + 1).padStart(2, '0')}</Text>
                <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: COLORS.ink }}>{t.label}</Text>
              </View>
              {/* Helvetica's base-14 glyph set has no U+2192 arrow — falls back to a
                  tofu mark. ">" is guaranteed present in WinAnsiEncoding. */}
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: COLORS.accent }}>{'>'}</Text>
            </View>
          </Link>
        ))}
        <PageFooter reportTitle={data.reportTitle} />
      </Page>

      {/* ── Executive Summary ──────────────────────────────────── */}
      {hasSummarySection && (
        <Page size="A4" style={styles.page}>
          <SectionHeading eyebrow="01 — OVERVIEW" title="Executive Summary" id="summary" />

          {summary?.text && !isUnavailable(summary) && (
            <View style={{ marginBottom: 18 }}>
              <Text style={styles.body}>{summary.text}</Text>
            </View>
          )}

          {vs?.scores && !isUnavailable(vs) && (
            <View style={{ marginBottom: 18 }} wrap={false}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <ScoreDonut score={deriveHeadlineScore(vs.scores)} size={40} />
                <Text style={[styles.h3, { marginLeft: 10 }]}>Viability Snapshot</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                <View style={{ width: '46%' }}>
                  {vs.scores.market_opportunity && <ScoreBar label="Market Opportunity" score={vs.scores.market_opportunity.score} rationale={vs.scores.market_opportunity.rationale} />}
                  {vs.scores.capital_required && <ScoreBar label="Capital Required" score={vs.scores.capital_required.score} rationale={vs.scores.capital_required.rationale} />}
                </View>
                <View style={{ width: '46%' }}>
                  {vs.scores.execution_difficulty && <ScoreBar label="Execution Difficulty" score={vs.scores.execution_difficulty.score} rationale={vs.scores.execution_difficulty.rationale} />}
                  {vs.scores.time_to_revenue && <ScoreBar label="Time to Revenue" score={vs.scores.time_to_revenue.score} rationale={vs.scores.time_to_revenue.rationale} />}
                </View>
              </View>
            </View>
          )}

          {whyProceed?.market_proof && !isUnavailable(whyProceed) && (
            <View>
              <Text style={[styles.h3, { marginBottom: 10 }]}>Why This Is Worth Pursuing</Text>
              <Card>
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: COLORS.accent, letterSpacing: 0.5, marginBottom: 3 }}>WHAT THE MARKET IS TELLING YOU</Text>
                <Text style={[styles.body, { marginBottom: 10 }]}>{whyProceed.market_proof}</Text>
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: COLORS.accent, letterSpacing: 0.5, marginBottom: 3 }}>YOUR EDGE</Text>
                <Text style={[styles.body, { marginBottom: 10 }]}>{whyProceed.your_edge}</Text>
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: COLORS.accent, letterSpacing: 0.5, marginBottom: 3 }}>THE UPSIDE</Text>
                <Text style={styles.body}>{whyProceed.upside}</Text>
              </Card>
            </View>
          )}

          <PageFooter reportTitle={data.reportTitle} />
        </Page>
      )}

      {/* ── Competitors ─────────────────────────────────────────── */}
      {competitorList.length > 0 && (
        <Page size="A4" style={styles.page}>
          <SectionHeading eyebrow="02 — MARKET" title="Competitive Landscape" id="competitors" />
          <Text style={[styles.caption, { marginBottom: 14 }]}>{competitorList.length} competitor{competitorList.length === 1 ? '' : 's'} identified via live research</Text>

          {competitorList.map((c, i) => (
            <Card key={i}>
              {/* Stacked, not side-by-side: real pricing_summary values are
                  full sentences, not short price tags — a flex row here
                  starves the name column (react-pdf's Yoga layout doesn't
                  shrink an unconstrained long-text sibling the way CSS does),
                  wrapping the name one word per line and overflowing the row. */}
              {c.url ? (
                <ExternalLink href={c.url} iconSize={9}><Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: COLORS.accent, textDecoration: 'underline' }}>{c.name}</Text></ExternalLink>
              ) : (
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: COLORS.ink }}>{c.name}</Text>
              )}
              <Text style={[styles.caption, { marginTop: 2 }]}>{c.location}</Text>
              {c.pricing_summary && (
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: COLORS.ink, marginTop: 3 }}>{c.pricing_summary}</Text>
              )}
              {c.positioning_angle && (
                <Text style={[styles.body, { marginTop: 8 }]}>
                  <Text style={{ fontFamily: 'Helvetica-Bold', color: COLORS.ink }}>Positioning: </Text>{c.positioning_angle}
                </Text>
              )}
              {c.gap_notes && (
                <View style={{ marginTop: 8 }}>
                  <Callout tone="positive" label="Gap">
                    <Text style={{ fontSize: 9, color: COLORS.ink }}>{c.gap_notes}</Text>
                  </Callout>
                </View>
              )}
            </Card>
          ))}
          <PageFooter reportTitle={data.reportTitle} />
        </Page>
      )}

      {/* ── Costs & Pricing ─────────────────────────────────────── */}
      {hasCosts && (
        <Page size="A4" style={styles.page}>
          <SectionHeading eyebrow="03 — ECONOMICS" title="Costs & Pricing" id="costs" />

          {cb && !isUnavailable(cb) && (
            <Card>
              <View style={styles.spaceBetween}>
                <Text style={styles.h3}>Cost Breakdown</Text>
                <Text style={styles.caption}>{cb.currency}</Text>
              </View>
              {cb.per_unit && (
                <View style={{ marginTop: 8 }}>
                  {([
                    ['materials', 'Materials'],
                    ['packaging', 'Packaging'],
                    ['power', 'Power'],
                    ['active_labour', 'Active labour'],
                    ['passive_labour', 'Passive labour'],
                  ] as const).map(([key, label]) => {
                    const val = cb.per_unit![key]
                    const flag = cb.estimation_flags?.[key]
                    if (flag === 'not_applicable' || val === null || val === undefined) return null
                    return <KVRow key={key} label={flag === 'estimated' ? `${label} (est.)` : label} value={fmt(sym, val)} />
                  })}
                  {cb.per_unit.total_cogs != null && <KVRow label="Total COGS" value={fmt(sym, cb.per_unit.total_cogs as number)} bold />}
                </View>
              )}
              {(cb.suggested_price != null || cb.gross_margin_pct != null) && (
                <View style={{ marginTop: 10 }}>
                  <Callout tone="positive">
                    <View style={styles.spaceBetween}>
                      {cb.suggested_price != null && (
                        <View>
                          <Text style={{ fontSize: 8, color: COLORS.positive }}>Suggested price</Text>
                          <Text style={{ fontSize: 15, fontFamily: 'Helvetica-Bold', color: COLORS.positive }}>{fmt(sym, cb.suggested_price)}</Text>
                        </View>
                      )}
                      {cb.gross_margin_pct != null && (
                        <View>
                          <Text style={{ fontSize: 8, color: COLORS.positive }}>Gross margin</Text>
                          <Text style={{ fontSize: 15, fontFamily: 'Helvetica-Bold', color: COLORS.positive }}>{cb.gross_margin_pct}%</Text>
                        </View>
                      )}
                    </View>
                  </Callout>
                </View>
              )}
              {cb.startup_costs && cb.startup_costs.length > 0 && (
                <View style={{ marginTop: 12 }}>
                  <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: COLORS.ink, marginBottom: 4 }}>Estimated startup costs</Text>
                  {cb.startup_costs.map((item, i) => (
                    <KVRow key={i} label={item.item} value={`${fmt0(sym, item.estimate_low)}–${fmt0(sym, item.estimate_high)}`} />
                  ))}
                </View>
              )}
              {cb.ongoing_costs && cb.ongoing_costs.length > 0 && (
                <View style={{ marginTop: 12 }}>
                  <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: COLORS.ink, marginBottom: 4 }}>Estimated ongoing costs</Text>
                  {cb.ongoing_costs.map((item, i) => (
                    <KVRow key={i} label={item.item} value={`${fmt0(sym, item.estimate_monthly)}/mo`} />
                  ))}
                </View>
              )}
              {cb.notes && <Text style={[styles.caption, { marginTop: 10 }]}>{cb.notes}</Text>}
            </Card>
          )}

          {pricing && !isUnavailable(pricing) && (
            <Card>
              <Text style={styles.h3}>Pricing Recommendation</Text>
              <Text style={[styles.caption, { marginBottom: 8 }]}>{pricing.model}</Text>
              <Callout tone="accent">
                <Text style={{ fontSize: 8, color: COLORS.accent }}>Suggested price</Text>
                <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: COLORS.accent }}>{pricing.suggested_price_or_range}</Text>
              </Callout>
              <Text style={[styles.body, { marginTop: 8 }]}>{pricing.rationale}</Text>
              {pricing.comparable_market_rates && <Text style={[styles.caption, { marginTop: 6 }]}>{pricing.comparable_market_rates}</Text>}
            </Card>
          )}

          {!isUnavailable(fundingOptions) && Array.isArray(fundingOptions) && fundingOptions.length > 0 && (
            <Card>
              <Text style={styles.h3}>Funding Options</Text>
              <Text style={[styles.caption, { marginBottom: 8 }]}>Ways to bridge the gap between stated capital and estimated startup cost</Text>
              {(fundingOptions as Array<Record<string, string>>).map((item, i) => (
                <View key={i} style={{ marginBottom: 10 }} wrap={false}>
                  <View style={styles.spaceBetween}>
                    {/* flex:1 keeps a long program name from being starved by
                        the badge sibling — see the competitor-card fix above. */}
                    <View style={{ flex: 1, marginRight: 8 }}>
                      {item.url ? (
                        <ExternalLink href={item.url} iconSize={8}><Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: COLORS.accent, textDecoration: 'underline' }}>{item.name}</Text></ExternalLink>
                      ) : (
                        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10 }}>{item.name}</Text>
                      )}
                    </View>
                    {item.type && <TypeBadge label={item.type.replace(/_/g, ' ')} tone="accent" />}
                  </View>
                  <Text style={styles.caption}>{item.jurisdiction}</Text>
                  {item.summary && <Text style={[styles.body, { marginTop: 3 }]}>{item.summary}</Text>}
                </View>
              ))}
            </Card>
          )}
          <PageFooter reportTitle={data.reportTitle} />
        </Page>
      )}

      {/* ── Legal & Compliance ───────────────────────────────────── */}
      {complianceList.length > 0 && (
        <Page size="A4" style={styles.page}>
          <SectionHeading eyebrow="04 — COMPLIANCE" title="Legal & Compliance" id="legal" />
          {complianceList.map((item, i) => (
            <Card key={i}>
              <View style={styles.spaceBetween}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: COLORS.ink, flex: 1 }}>{item.item}</Text>
                <SeverityBadge severity={item.severity} />
              </View>
              <Text style={[styles.caption, { marginTop: 2, marginBottom: 6 }]}>{item.jurisdiction}</Text>
              <Text style={styles.body}>{item.summary}</Text>
              {item.official_source_url && (
                <View style={{ marginTop: 6 }}>
                  <ExternalLink href={item.official_source_url} iconSize={7.5}>{item.official_source_url}</ExternalLink>
                </View>
              )}
            </Card>
          ))}
          <Callout tone="warning" label="Not legal advice">
            <Text style={{ fontSize: 9, color: COLORS.warning, lineHeight: 1.4 }}>
              The items above are for informational purposes only. Requirements vary by location, business structure,
              and circumstances. Consult a qualified lawyer, accountant, or relevant government body before acting on
              any item listed here.
            </Text>
          </Callout>

          {/* "Your support team" — render-time only, never stored in report
              sections (see src/lib/essential-services.ts). Mirrors the web
              report page's block at the bottom of this same tab. */}
          {data.essentialServices.length > 0 && (
            <Card>
              <Text style={[styles.h3, { marginBottom: 2 }]}>Your support team</Text>
              <Text style={[styles.caption, { marginBottom: 10 }]}>
                Every business ends up needing most of these — a head start on where to look.
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {data.essentialServices.map(service => (
                  <View key={service.id} style={{ width: '46%', marginBottom: 10 }} wrap={false}>
                    <Text style={{ fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: COLORS.ink }}>{service.heading}</Text>
                    <Text style={[styles.caption, { marginTop: 1, marginBottom: 3 }]}>{service.blurb}</Text>
                    <ExternalLink href={service.href} iconSize={7.5}>
                      <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9, color: COLORS.accent, textDecoration: 'underline' }}>{service.name}</Text>
                    </ExternalLink>
                    {service.note && <Text style={[styles.caption, { marginTop: 2, fontStyle: 'italic' }]}>{service.note}</Text>}
                  </View>
                ))}
              </View>
              <Text style={[styles.caption, { marginTop: 6 }]}>
                Some links may earn Idea Engine a commission. This never changes what you pay, and never changes what we recommend.
              </Text>
            </Card>
          )}
          <PageFooter reportTitle={data.reportTitle} />
        </Page>
      )}

      {/* ── Marketing ────────────────────────────────────────────── */}
      {hasMarketing && marketing && (
        <Page size="A4" style={styles.page}>
          <SectionHeading eyebrow="05 — GO TO MARKET" title="Getting the Word Out" id="marketing" />

          <Card>
            <Text style={styles.body}>{marketing.strategy_summary}</Text>
            {marketing.free_first && (
              <View style={{ marginTop: 10 }}>
                <Callout tone="positive" label="Before you spend a dollar">
                  <Text style={{ fontSize: 9.5, color: COLORS.ink, lineHeight: 1.5 }}>{marketing.free_first}</Text>
                </Callout>
              </View>
            )}
          </Card>

          {Array.isArray(marketing.channels) && marketing.channels.length > 0 && (
            <Card>
              <Text style={[styles.h3, { marginBottom: 8 }]}>Channels</Text>
              {[...marketing.channels].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99)).map((ch, i) => (
                <NumberedRow key={i} n={ch.priority ?? i + 1}>
                  <View style={styles.spaceBetween}>
                    {/* flex:1 keeps a long channel name from being starved by
                        the badge sibling — see the competitor-card fix above. */}
                    <View style={{ flex: 1, marginRight: 8 }}>
                      {ch.link ? (
                        <ExternalLink href={ch.link} iconSize={7.5}><Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9.5, color: COLORS.accent, textDecoration: 'underline' }}>{ch.name}</Text></ExternalLink>
                      ) : (
                        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9.5, color: COLORS.ink }}>{ch.name}</Text>
                      )}
                    </View>
                    <TypeBadge label={ch.channel_type === 'free' ? 'Free' : 'Paid'} tone={ch.channel_type === 'free' ? 'positive' : 'accent'} />
                  </View>
                  <Text style={[styles.caption, { marginTop: 2 }]}>{ch.why_this_channel}</Text>
                  {ch.channel_type !== 'free' && ch.est_cost && (
                    <Text style={{ fontSize: 8.5, color: COLORS.ink, marginTop: 2 }}>
                      <Text style={{ fontFamily: 'Helvetica-Bold' }}>Cost: </Text>{ch.est_cost}
                    </Text>
                  )}
                  {ch.how_to_start && (
                    <Text style={{ fontSize: 8.5, color: COLORS.body, marginTop: 3 }}>
                      <Text style={{ fontFamily: 'Helvetica-Bold' }}>How to start: </Text>{ch.how_to_start}
                    </Text>
                  )}
                </NumberedRow>
              ))}
            </Card>
          )}

          {marketing.starter_budget?.weekly_total && (
            <Card>
              <Text style={[styles.h3, { marginBottom: 8 }]}>Starter Budget</Text>
              <Callout tone="positive">
                <Text style={{ fontSize: 8, color: COLORS.positive }}>Suggested starting spend</Text>
                <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: COLORS.positive }}>{marketing.starter_budget.weekly_total}</Text>
              </Callout>
              {Array.isArray(marketing.starter_budget.allocation) && marketing.starter_budget.allocation.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  {marketing.starter_budget.allocation.map((row, i) => (
                    <KVRow key={i} label={row.channel} value={row.amount} />
                  ))}
                </View>
              )}
              {marketing.starter_budget.note && <Text style={[styles.caption, { marginTop: 8 }]}>{marketing.starter_budget.note}</Text>}
            </Card>
          )}
          <PageFooter reportTitle={data.reportTitle} />
        </Page>
      )}

      {/* ── Considerations & Next Steps ─────────────────────────── */}
      {hasNextSteps && (
        <Page size="A4" style={styles.page}>
          <SectionHeading eyebrow="06 — ACTION PLAN" title="Considerations & Next Steps" id="next-steps" />

          {riskList.length > 0 && (
            <Card>
              <Text style={[styles.h3, { marginBottom: 8 }]}>Things to Consider</Text>
              {riskList.map((risk, i) => {
                const title = risk.title ?? risk.risk
                const description = risk.description ?? risk.detail
                return (
                  <View key={i} style={{ marginBottom: 10 }} wrap={false}>
                    {title && <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9.5, color: COLORS.ink }}>{title}</Text>}
                    {description && <Text style={[styles.caption, { marginTop: 2, marginBottom: 4 }]}>{description}</Text>}
                    {risk.mitigation && (
                      <Callout tone="accent">
                        <Text style={{ fontSize: 9, color: COLORS.ink }}>
                          <Text style={{ fontFamily: 'Helvetica-Bold' }}>How to handle it: </Text>{risk.mitigation}
                        </Text>
                      </Callout>
                    )}
                  </View>
                )
              })}
            </Card>
          )}

          {stepList.length > 0 && (
            <Card>
              <Text style={[styles.h3, { marginBottom: 8 }]}>Next Steps</Text>
              {stepList.map((step, i) => (
                <NumberedRow key={i} n={i + 1}>
                  <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: COLORS.accent }}>{step.timeframe}</Text>
                  <Text style={{ fontSize: 9.5, color: COLORS.ink, marginTop: 1 }}>{step.action}</Text>
                  {(step.rationale ?? step.detail) && <Text style={[styles.caption, { marginTop: 2 }]}>{step.rationale ?? step.detail}</Text>}
                </NumberedRow>
              ))}
            </Card>
          )}

          {validationCopy?.poll_question && !isUnavailable(validationCopy) && (
            <Card>
              <Text style={styles.h3}>Test the Demand — Copy, Paste, Post</Text>
              <Text style={[styles.caption, { marginBottom: 8 }]}>Ready to paste unchanged</Text>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: COLORS.accent, marginBottom: 3 }}>POLL QUESTION</Text>
              <QuoteBlock>&ldquo;{validationCopy.poll_question}&rdquo;</QuoteBlock>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: COLORS.accent, marginBottom: 3 }}>AD LINE</Text>
              <QuoteBlock>&ldquo;{validationCopy.ad_line}&rdquo;</QuoteBlock>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: COLORS.accent, marginBottom: 3 }}>FORUM POST</Text>
              <QuoteBlock>&ldquo;{validationCopy.forum_post}&rdquo;</QuoteBlock>
            </Card>
          )}

          {oneThingToDo?.action && !isUnavailable(oneThingToDo) && (
            <Callout tone="positive" label="If you do nothing else, do this">
              <Text style={{ fontSize: 10.5, fontFamily: 'Helvetica-Bold', color: COLORS.positive, marginBottom: 6 }}>{oneThingToDo.action}</Text>
              <Text style={{ fontSize: 9.5, color: COLORS.ink, lineHeight: 1.5 }}>{oneThingToDo.why_first}</Text>
            </Callout>
          )}
          <PageFooter reportTitle={data.reportTitle} />
        </Page>
      )}

      {/* ── Appendix — Questions & Answers ──────────────────────── */}
      {data.answers.length > 0 && (
        <Page size="A4" style={styles.page} wrap>
          <SectionHeading eyebrow="APPENDIX" title="Appendix — Your Questions & Answers" />
          <Text style={[styles.body, { marginBottom: 18 }]}>
            This report was generated from the answers below. Review them to decide
            whether the result reflects your idea the way you intended.
          </Text>

          {data.answers.map((qa, i) => (
            <View key={i} style={{ marginBottom: 12 }} wrap={false}>
              <Text style={[styles.caption, { marginBottom: 3 }]}>{qa.question}</Text>
              <Text style={styles.body}>{qa.answer}</Text>
            </View>
          ))}

          <View style={{ marginTop: 8 }}>
            <Callout tone="accent" label="Want a different result?">
              <Text style={[styles.body, { marginBottom: 8 }]}>
                Your report is only as good as the answers behind it. If something is
                missing, has changed, or you want to explore a different angle for your
                idea, you can edit your answers and generate a fresh report. Editing
                answers is free — generating a new report is a new report purchase,
                charged at the normal price.
              </Text>
              <Link src={data.editAnswersUrl} style={styles.link}>Edit your answers</Link>
              <Text style={[styles.caption, { marginTop: 2 }]}>{data.editAnswersUrl}</Text>
            </Callout>
          </View>

          <Text style={[styles.caption, { marginTop: 10 }]}>
            Tell us how we did — leave a rating on your report page.
          </Text>

          <PageFooter reportTitle={data.reportTitle} />
        </Page>
      )}
    </Document>
  )
}
