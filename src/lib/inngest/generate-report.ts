import { inngest } from '@/lib/inngest'
import { createServiceClient } from '@/lib/db'
import { callAI, HAIKU_MODEL, DEFAULT_MODEL, type AIResult } from '@/lib/ai'
import { providerOverrideForUser, reportModelForUser } from '@/lib/demo-mode'
import { calculateCosts, parseNumber, needsAiCostFallback } from '@/lib/cost-calculator'
import { parseCapitalRange } from '@/lib/derived-metrics'
import {
  COMPETITOR_RESEARCH_SYSTEM_PROMPT,
  buildCompetitorResearchMessage,
} from '@/lib/prompts/competitor-research'
import {
  COMPETITOR_FALLBACK_SYSTEM_PROMPT,
  buildCompetitorFallbackMessage,
} from '@/lib/prompts/competitor-fallback'
import { COMPLIANCE_SYSTEM_PROMPT, buildComplianceMessage } from '@/lib/prompts/compliance'
import {
  COMPLIANCE_FALLBACK_SYSTEM_PROMPT,
  buildComplianceFallbackMessage,
} from '@/lib/prompts/compliance-fallback'
import { staticComplianceBaseline } from '@/lib/compliance-baseline'
import { logError } from '@/lib/log-error'
import { buildBrandedEmail, getSiteUrl, sendMail } from '@/lib/mailer'
import {
  SYNTHESIS_SYSTEM_PROMPT,
  buildSynthesisMessage,
  type SynthesisOutput,
} from '@/lib/prompts/synthesis'
import {
  COST_ESTIMATION_SYSTEM_PROMPT,
  buildCostEstimationMessage,
} from '@/lib/prompts/cost-estimation'
import { FINANCING_SYSTEM_PROMPT, buildFinancingMessage } from '@/lib/prompts/financing'
import { MARKETING_SYSTEM_PROMPT, buildMarketingMessage } from '@/lib/prompts/marketing'
import { loadQuestionBank, filterVisibleAnswers } from '@/lib/question-bank'

// NOTE on <cite index="…">…</cite> markers: web-search responses interleave
// the model's citation tags into the text. The index is meaningless once
// stored (it points at that call's transient search results), but the tagged
// SPAN is a verbatim quote backed by a live source — so we deliberately keep
// the markers in the stored sections. The web UI renders them as highlighted
// "quoted from a source" spans (src/lib/cite.ts); the PDF strips them.

// Extracts the first JSON array or object from a string, tolerating prose preamble.
function extractJson(text: string): unknown {
  const arrayMatch = text.match(/\[[\s\S]*\]/)
  const objectMatch = text.match(/\{[\s\S]*\}/)
  const match = arrayMatch && objectMatch
    ? (text.indexOf('[') < text.indexOf('{') ? arrayMatch : objectMatch)
    : arrayMatch ?? objectMatch
  if (!match) throw new Error(`No JSON found in response: ${text.slice(0, 120)}`)
  return JSON.parse(match[0])
}

function parseJsonArray(r: AIResult): unknown[] {
  const parsed = extractJson(r.text)
  if (!Array.isArray(parsed)) throw new Error('Response not a JSON array')
  return parsed
}

function parseJsonObject(r: AIResult): Record<string, unknown> {
  const parsed = extractJson(r.text)
  if (Array.isArray(parsed) || typeof parsed !== 'object' || parsed === null) {
    throw new Error('Response not a JSON object')
  }
  return parsed as Record<string, unknown>
}

const UNAVAILABLE = (reason: string) => ({ status: 'unavailable', reason })

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

// ── Cost-accurate AI step ────────────────────────────────────
// How each upstream section was produced. Kept in _meta and passed to synthesis
// so the summary never implies live research when it actually fell back.
type SectionStatus = 'live_ok' | 'fallback_inferred' | 'failed'

// Per-call diagnostics stored under _meta.steps (admin-visible). One entry per
// callAI, so a section with a primary + fallback shows both.
interface StepMeta {
  status: 'ok' | 'failed'
  model?: string
  input_tokens: number
  output_tokens: number
  web_search_requests: number
  cost_usd: number
  error?: string
}

interface AiStepOutcome<T> {
  value: T | null
  status: 'ok' | 'failed'
  costUsd: number
  meta: StepMeta
}

// max_uses caps searches per call — search fees + result input tokens are the
// dominant report cost, so an uncapped call can multiply the price of a run.
const webSearchTool = (maxUses: number) =>
  [{ type: 'web_search_20250305' as const, name: 'web_search' as const, max_uses: maxUses }]

type StepRunner = { run: <T>(id: string, fn: () => Promise<T>) => Promise<T> }

// Runs an AI call up to `attempts` times and ALWAYS accounts for cost —
// including failed attempts and truncations. Anthropic bills every call it
// answers, so cost is banked before parsing and again from AICallError on the
// throw paths. This never throws for API/parse failures: it returns status
// 'failed' with value null so the caller can fall back, and the banked cost is
// memoised with the step. (Root cause of the old $0.22-vs-$1.13 undercount:
// cost was only taken from the successful attempt.)
//
// Truncation-aware retry: when an attempt fails because the output hit
// maxTokens (AICallError kind 'truncated'), retrying at the SAME cap is
// guaranteed to truncate again — so the next attempt runs with the cap
// doubled. Live incident 2026-07-08: marketing (3072×2) and synthesis
// (6144×2) both burned two identical truncated attempts and failed the
// section. Cost risk is bounded — you only pay for tokens actually
// generated, not the cap.
async function aiStep<T>(
  step: StepRunner,
  id: string,
  baseMaxTokens: number,
  makeCall: (maxTokens: number) => Promise<AIResult>,
  parse: (r: AIResult) => T,
  attempts = 2,
): Promise<AiStepOutcome<T>> {
  return step.run(id, async (): Promise<AiStepOutcome<T>> => {
    let costUsd = 0
    let inputTokens = 0
    let outputTokens = 0
    let webSearchRequests = 0
    let model: string | undefined
    let lastErr: unknown
    let cap = baseMaxTokens

    for (let i = 1; i <= attempts; i++) {
      try {
        const r = await makeCall(cap)
        // Bank cost BEFORE parsing — a parse failure must not discard a billed call.
        costUsd += r.costUsd
        inputTokens += r.inputTokens
        outputTokens += r.outputTokens
        webSearchRequests += r.webSearchRequests
        model = r.model
        const value = parse(r)
        return {
          value,
          status: 'ok',
          costUsd,
          meta: { status: 'ok', model, input_tokens: inputTokens, output_tokens: outputTokens, web_search_requests: webSearchRequests, cost_usd: round4(costUsd) },
        }
      } catch (err) {
        lastErr = err
        // AICallError (truncation / no text block) carries the billed cost of
        // the failed attempt so it still counts toward the total.
        const e = err as { costUsd?: number; inputTokens?: number; outputTokens?: number; webSearchRequests?: number; model?: string; kind?: string }
        if (typeof e.costUsd === 'number') {
          costUsd += e.costUsd
          inputTokens += e.inputTokens ?? 0
          outputTokens += e.outputTokens ?? 0
          webSearchRequests += e.webSearchRequests ?? 0
          model = e.model ?? model
        }
        // Same-cap retry after truncation is futile — double it.
        if (e.kind === 'truncated') cap *= 2
        console.warn(`${id}: attempt ${i}/${attempts} failed (next cap ${cap}):`, err instanceof Error ? err.message : err)
      }
    }

    return {
      value: null,
      status: 'failed',
      costUsd,
      meta: { status: 'failed', model, input_tokens: inputTokens, output_tokens: outputTokens, web_search_requests: webSearchRequests, cost_usd: round4(costUsd), error: lastErr instanceof Error ? lastErr.message : String(lastErr) },
    }
  })
}

// Required sections must never be blank in a completed report. If any is
// missing/empty/unavailable the report is flagged _meta.partial (a soft banner
// in the UI) rather than silently "complete".
const REQUIRED_SECTION_KEYS = [
  'summary',
  'viability_snapshot',
  'competitors',
  'cost_breakdown',
  'legal_compliance',
  'risks',
  'next_steps',
]

function isUnavailable(v: unknown): boolean {
  return typeof v === 'object' && v !== null && (v as Record<string, unknown>).status === 'unavailable'
}

function hasContent(v: unknown): boolean {
  if (v === null || v === undefined) return false
  if (isUnavailable(v)) return false
  if (Array.isArray(v)) return v.length > 0
  return true
}

function isNonEmptyArray(v: unknown): v is unknown[] {
  return Array.isArray(v) && v.length > 0
}

export const generateReport = inngest.createFunction(
  {
    id: 'generate-report',
    retries: 0,
    // Anthropic TPM is the real ceiling under burst load: each run makes ~6
    // calls, and the search-backed ones carry ~100k+ input tokens. Without a
    // cap, N simultaneous requests all hit the API at once and rate-limited
    // steps degrade to fallback/unavailable sections (PARTIAL reports).
    // With it, Inngest queues excess runs instead — queued users just wait
    // longer, which the progress screen + report-ready email already absorb.
    // Tune upward as the Anthropic tier's rate limits grow.
    concurrency: [{ limit: 8 }],
    triggers: [{ event: 'idea-engine/full-report.requested' }],
  },
  async ({ event, step }: { event: { data: { reportId: string; ideaId: string; userId: string } }; step: StepRunner }) => {
    const { reportId, ideaId, userId } = event.data
    const supabase = createServiceClient()
    const provider = await providerOverrideForUser(supabase, userId)

    // Per-step model routing (cheapest capable model per step):
    // search/extract steps run on Haiku — their cost is dominated by search-
    // result INPUT tokens (competitors alone was $0.94 of a $1.70 Sonnet run)
    // and Haiku's input rate is half Sonnet's, with quality holding up on
    // extractive work (validated on the 2026-07-08 Haiku full run). Judgment
    // steps (cost estimation, synthesis — the report's analytical voice,
    // honesty rules, calibrated scores) stay on the default Sonnet.
    // The admin's report_model (Settings page) overrides EVERY step for A/B
    // experiments; failure-fallback steps are always Haiku regardless.
    const STEP_MODELS = {
      competitors: HAIKU_MODEL,
      costs: DEFAULT_MODEL,
      financing: HAIKU_MODEL,
      compliance: HAIKU_MODEL,
      marketing: HAIKU_MODEL,
      synthesis: DEFAULT_MODEL,
    } as const
    const override = await reportModelForUser(supabase, userId)
    const stepModel = (step: keyof typeof STEP_MODELS) => override ?? STEP_MODELS[step]
    // Recorded in model_version + _meta.model (admin cost line). Per-call
    // models are in _meta.steps[].model either way.
    const effectiveModel = override ?? 'hybrid (haiku + sonnet-5)'

    // ── Fetch idea + answers ───────────────────────────────────
    const { data: idea } = await supabase
      .from('ideas')
      .select('id, raw_text, archetype, location_country, location_region, restatement')
      .eq('id', ideaId)
      .single()

    if (!idea) {
      await logError({
        source: 'inngest:generate-report',
        message: `Idea ${ideaId} not found — cannot generate report ${reportId}`,
        detail: { reportId, ideaId },
        path: 'generate-report',
        userId,
      })
      throw new Error(`Idea ${ideaId} not found`)
    }

    const { data: answersRows } = await supabase
      .from('answers')
      .select('question_key, answer_text')
      .eq('idea_id', ideaId)

    // Build maps_to → answer_text lookup from static bank. Stale hidden-
    // branch answers — rows left over from before the founder changed a
    // controlling answer, so their show_if no longer matches — are dropped
    // here before they can reach the report.
    const bank = loadQuestionBank(idea.archetype)
    const visibleAnswersRows = filterVisibleAnswers(bank, answersRows ?? [])
    const mapsTo: Record<string, string> = {}
    for (const row of visibleAnswersRows) {
      const bankQ = bank.find(q => q.key === row.question_key)
      if (bankQ) mapsTo[bankQ.maps_to] = row.answer_text
    }

    // Questions injected at request time (questions route) are not in the
    // static JSON banks, so map their answers explicitly or they never reach
    // the prompts.
    const INJECTED_QUESTION_MAPS: Record<string, string> = {
      success_definition: 'founder.success_definition',
      founder_location_country: 'founder.location_country',
      founder_location_region: 'founder.location_region',
    }
    for (const row of visibleAnswersRows) {
      const injected = INJECTED_QUESTION_MAPS[row.question_key]
      if (injected) mapsTo[injected] = row.answer_text
    }

    const answers = Object.entries(mapsTo).map(([maps_to, answer]) => ({ maps_to, answer }))

    // Read existing cost before this run so the new total is additive, not a
    // clobbering overwrite (a rerun of the full pipeline accumulates on top
    // of whatever teaser/prior-run cost was already recorded).
    const { data: existingReport } = await supabase
      .from('reports')
      .select('cost_usd')
      .eq('id', reportId)
      .single()

    // Mark running — MUST be a step. Inngest re-executes the whole function
    // body at every step boundary (memoizing completed steps), so any DB write
    // outside step.run re-fires on every replay — including the final replay
    // AFTER assemble has set status='complete', which flipped reports back to
    // 'running' and left the client polling forever (live incident 2026-07-08).
    await step.run('mark-running', async () => {
      await supabase
        .from('reports')
        .update({ status: 'running', generation_started_at: new Date().toISOString() })
        .eq('id', reportId)
    })

    const sections: Record<string, unknown> = {}
    let totalCostUsd = 0
    // Per-call diagnostics (admin) + section-level status (synthesis + UI banners).
    const stepMetas: Record<string, StepMeta> = {}
    const sectionStatus: Record<string, SectionStatus> = {}

    function bankStep(id: string, outcome: AiStepOutcome<unknown>) {
      stepMetas[id] = outcome.meta
      totalCostUsd += outcome.costUsd
    }

    // Progressive section writes drive the client progress screen. Each one is
    // its own memoized step (unique id) for the same replay-safety reason as
    // mark-running: a bare update here would re-run on the final replay and
    // overwrite the assemble step's finished sections (stripping _meta).
    async function persistSections(stepId: string) {
      await step.run(stepId, async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await supabase.from('reports').update({ sections: sections as any }).eq('id', reportId)
      })
    }

    // ── Step 1: Competitor research (live search, with inferred fallback) ──
    const compPrimary = await aiStep(
      step,
      'research-competitors',
      8192,
      (maxTokens) => callAI({
        messages: [{ role: 'user', content: buildCompetitorResearchMessage({
          idea_raw_text: idea.raw_text,
          archetype: idea.archetype,
          location_country: idea.location_country,
          location_region: idea.location_region,
          restatement: idea.restatement,
          target_customer: mapsTo['market.target_customer'] ?? null,
          differentiator: mapsTo['market.differentiator'] ?? null,
          geographic_scope: mapsTo['market.geographic_scope'] ?? null,
        }) }],
        system: COMPETITOR_RESEARCH_SYSTEM_PROMPT,
        maxTokens,
        tag: 'report:competitors',
        tools: webSearchTool(5),
        model: stepModel('competitors'),
        provider,
      }),
      parseJsonArray,
    )
    bankStep('research-competitors', compPrimary)

    let competitors: unknown
    if (compPrimary.status === 'ok' && isNonEmptyArray(compPrimary.value)) {
      competitors = compPrimary.value
      sectionStatus.competitors = 'live_ok'
    } else {
      // Live search failed or returned nothing — cheap no-search inferred pass.
      const compFallback = await aiStep(
        step,
        'research-competitors-fallback',
        4096,
        (maxTokens) => callAI({
          messages: [{ role: 'user', content: buildCompetitorFallbackMessage({
            idea_raw_text: idea.raw_text,
            archetype: idea.archetype,
            location_country: idea.location_country,
            location_region: idea.location_region,
            restatement: idea.restatement,
            target_customer: mapsTo['market.target_customer'] ?? null,
            differentiator: mapsTo['market.differentiator'] ?? null,
            geographic_scope: mapsTo['market.geographic_scope'] ?? null,
          }) }],
          system: COMPETITOR_FALLBACK_SYSTEM_PROMPT,
          maxTokens,
          tag: 'report:competitors-fallback',
          model: HAIKU_MODEL,
          provider,
        }),
        parseJsonArray,
      )
      bankStep('research-competitors-fallback', compFallback)
      if (compFallback.status === 'ok' && isNonEmptyArray(compFallback.value)) {
        competitors = compFallback.value
        sectionStatus.competitors = 'fallback_inferred'
      } else {
        competitors = UNAVAILABLE('Live competitor search could not be completed.')
        sectionStatus.competitors = 'failed'
      }
    }
    sections.competitors = competitors
    await persistSections('persist-competitors')

    // ── Step 2: Cost estimation ───────────────────────────────
    // Shared AI cost-estimation call. This is the ONLY cost path for
    // non-product archetypes, and it's also the fallback for product
    // archetypes below — kept in one place so the two callers can't drift.
    const estimateCostsViaAI = () => aiStep(
      step,
      'estimate-costs',
      4096,
      (maxTokens) => callAI({
        messages: [{ role: 'user', content: buildCostEstimationMessage({
          idea_raw_text: idea.raw_text,
          archetype: idea.archetype,
          location_country: idea.location_country,
          location_region: idea.location_region,
          restatement: idea.restatement,
          answers,
          competitors: Array.isArray(competitors) ? competitors : [],
        }) }],
        system: COST_ESTIMATION_SYSTEM_PROMPT,
        maxTokens,
        tag: 'report:costs',
        model: stepModel('costs'),
        provider,
      }),
      parseJsonObject,
    )

    const productArchetypes = ['physical_product', 'ecommerce_brand']
    let costBreakdown: unknown
    if (productArchetypes.includes(idea.archetype)) {
      // Deterministic calculator first — no AI call, no cost, and it's the
      // most precise source when the founder answered the batch/unit-cost
      // questions. Those questions are optional (product directive: never
      // require a cost founders can't know), so this can come back with
      // materials omitted.
      const deterministic = calculateCosts({
        location_country: idea.location_country,
        materials_batch_cost: parseNumber(mapsTo['cost.materials']),
        packaging_per_unit: parseNumber(mapsTo['cost.packaging_per_unit']),
        equipment_wattage: parseNumber(mapsTo['cost.equipment_wattage']),
        active_minutes_per_batch: parseNumber(mapsTo['cost.active_minutes_per_batch']),
        passive_minutes_per_batch: parseNumber(mapsTo['cost.passive_minutes_per_batch']),
        batch_yield: parseNumber(mapsTo['cost.batch_yield']),
        hourly_rate: parseNumber(mapsTo['cost.hourly_rate']),
        unit_cost_estimate: parseNumber(mapsTo['cost.unit_cost_estimate']),
      })

      if (!needsAiCostFallback(deterministic)) {
        costBreakdown = deterministic
        sectionStatus.cost_breakdown = 'live_ok'
      } else {
        // Founder left both materials and per-unit cost blank — the
        // deterministic breakdown would silently omit materials from the
        // total. Fall back to the same AI step non-product archetypes use;
        // it already reads the founder's raw materials/manufacturing
        // answers and the SPECIALIST-COST RULE covers manufacturing costs.
        // Model-economy note: this is the only case where a product
        // archetype spends an AI call on costs — it only fires when the
        // founder didn't already give us the numbers.
        const costOutcome = await estimateCostsViaAI()
        bankStep('estimate-costs', costOutcome)
        // If the AI call also fails, keep the deterministic (partial)
        // breakdown rather than losing the section entirely — it still has
        // whatever the founder did answer, honestly flagged as estimated.
        costBreakdown = costOutcome.status === 'ok' ? costOutcome.value : deterministic
        sectionStatus.cost_breakdown = 'fallback_inferred'
      }
    } else {
      const costOutcome = await estimateCostsViaAI()
      bankStep('estimate-costs', costOutcome)
      costBreakdown = costOutcome.status === 'ok'
        ? costOutcome.value
        : UNAVAILABLE('Cost estimation could not be completed.')
    }
    sections.cost_breakdown = costBreakdown
    await persistSections('persist-costs')

    // ── Step 2b: Financing bridge (conditional, optional) ──────
    // Only runs when the founder's stated available capital falls short of
    // the estimated startup cost range — otherwise there's no gap to bridge.
    // Most archetypes answer cost.startup_capital as a select BAND
    // ("$500–$2,000"), which parseNumber rejects — so this step never fired
    // for them until parseCapitalRange (2026-07-11). The gap test uses the
    // band's top: a shortfall is only certain when even the founder's
    // maximum stated capital can't reach the low startup estimate. An
    // open-ended band ("$10,000+", high: null) can never prove a gap.
    const statedCapital = parseCapitalRange(mapsTo['cost.startup_capital'])
    const cb = costBreakdown as { startup_costs?: Array<{ estimate_low: number; estimate_high: number }>; currency?: string } | null
    const startupLow = Array.isArray(cb?.startup_costs) && cb.startup_costs.length > 0
      ? cb.startup_costs.reduce((sum, item) => sum + item.estimate_low, 0)
      : null
    const startupHigh = Array.isArray(cb?.startup_costs) && cb.startup_costs.length > 0
      ? cb.startup_costs.reduce((sum, item) => sum + item.estimate_high, 0)
      : null

    if (statedCapital !== null && statedCapital.high !== null && startupLow !== null && statedCapital.high < startupLow) {
      const financingOutcome = await aiStep(
        step,
        'financing-bridge',
        8192,
        (maxTokens) => callAI({
          messages: [{ role: 'user', content: buildFinancingMessage({
            idea_raw_text: idea.raw_text,
            archetype: idea.archetype,
            location_country: idea.location_country,
            location_region: idea.location_region,
            restatement: idea.restatement,
            stated_capital: mapsTo['cost.startup_capital'] ?? null,
            estimated_startup_low: startupLow,
            estimated_startup_high: startupHigh,
            currency: cb?.currency ?? null,
          }) }],
          system: FINANCING_SYSTEM_PROMPT,
          // Search-enabled calls also spend output tokens on interim text
          // between searches — 2048 truncated in live testing.
          maxTokens,
          tag: 'report:financing',
          tools: webSearchTool(3),
          model: stepModel('financing'),
          provider,
        }),
        parseJsonArray,
      )
      bankStep('financing-bridge', financingOutcome)
      sections.funding_options = financingOutcome.status === 'ok'
        ? financingOutcome.value
        : UNAVAILABLE('Funding research could not be completed.')
      await persistSections('persist-funding')
    }

    // ── Step 3: Compliance check (live search → inferred → static) ──
    const compliancePrimary = await aiStep(
      step,
      'compliance-check',
      6144,
      (maxTokens) => callAI({
        messages: [{ role: 'user', content: buildComplianceMessage({
          archetype: idea.archetype,
          location_country: idea.location_country,
          location_region: idea.location_region,
          restatement: idea.restatement,
          sales_channel: mapsTo['idea.sales_channel'] ?? null,
          production_location: mapsTo['cost.production_location'] ?? null,
        }) }],
        system: COMPLIANCE_SYSTEM_PROMPT,
        maxTokens,
        tag: 'report:compliance',
        tools: webSearchTool(3),
        model: stepModel('compliance'),
        provider,
      }),
      parseJsonArray,
    )
    bankStep('compliance-check', compliancePrimary)

    let legalCompliance: unknown
    if (compliancePrimary.status === 'ok' && isNonEmptyArray(compliancePrimary.value)) {
      legalCompliance = compliancePrimary.value
      sectionStatus.legal_compliance = 'live_ok'
    } else {
      const complianceFallback = await aiStep(
        step,
        'compliance-check-fallback',
        4096,
        (maxTokens) => callAI({
          messages: [{ role: 'user', content: buildComplianceFallbackMessage({
            archetype: idea.archetype,
            location_country: idea.location_country,
            location_region: idea.location_region,
            restatement: idea.restatement,
            sales_channel: mapsTo['idea.sales_channel'] ?? null,
            business_model: mapsTo['idea.business_model'] ?? mapsTo['pricing.model'] ?? null,
          }) }],
          system: COMPLIANCE_FALLBACK_SYSTEM_PROMPT,
          maxTokens,
          tag: 'report:compliance-fallback',
          model: HAIKU_MODEL,
          provider,
        }),
        parseJsonArray,
      )
      bankStep('compliance-check-fallback', complianceFallback)
      if (complianceFallback.status === 'ok' && isNonEmptyArray(complianceFallback.value)) {
        legalCompliance = complianceFallback.value
      } else {
        // Deterministic last resort — never leaves the tab blank.
        legalCompliance = staticComplianceBaseline(idea.archetype, idea.location_country)
        stepMetas['compliance-check-static'] = { status: 'ok', input_tokens: 0, output_tokens: 0, web_search_requests: 0, cost_usd: 0 }
      }
      sectionStatus.legal_compliance = 'fallback_inferred'
    }
    sections.legal_compliance = legalCompliance
    await persistSections('persist-compliance')

    // ── Step 3.5: Marketing playbook (optional) ────────────────
    const marketingOutcome = await aiStep(
      step,
      'marketing-plan',
      // Live incident 2026-07-08: 3072 truncated twice (search interim text
      // counts against the cap; input was 119k tokens of search results).
      8192,
      (maxTokens) => callAI({
        messages: [{ role: 'user', content: buildMarketingMessage({
          idea_raw_text: idea.raw_text,
          archetype: idea.archetype,
          location_country: idea.location_country,
          location_region: idea.location_region,
          restatement: idea.restatement,
          target_customer: mapsTo['market.target_customer'] ?? null,
          geographic_scope: mapsTo['market.geographic_scope'] ?? null,
          sales_channel: mapsTo['idea.sales_channel'] ?? null,
          startup_capital: mapsTo['cost.startup_capital'] ?? null,
          success_definition: mapsTo['founder.success_definition'] ?? null,
        }) }],
        system: MARKETING_SYSTEM_PROMPT,
        maxTokens,
        tag: 'report:marketing',
        tools: webSearchTool(3),
        model: stepModel('marketing'),
        provider,
      }),
      parseJsonObject,
    )
    bankStep('marketing-plan', marketingOutcome)
    sections.marketing_plan = marketingOutcome.status === 'ok'
      ? marketingOutcome.value
      : UNAVAILABLE('Marketing playbook could not be completed.')
    await persistSections('persist-marketing')

    // ── Step 4: Synthesis ─────────────────────────────────────
    const synthOutcome = await aiStep(
      step,
      'synthesise',
      // The synthesis JSON (summary + 4 scored dimensions + why-this-can-work +
      // pricing + 3-5 risks + 3-5 next steps + one-thing-to-do + validation
      // copy) killed all eight sections at once when truncated — Sonnet 5
      // exceeded 6144 twice in live testing (2026-07-08), so the base is
      // generous and truncation retries double it. Cost only accrues for
      // tokens actually generated, not the cap.
      16384,
      (maxTokens) => callAI({
        messages: [{ role: 'user', content: buildSynthesisMessage({
          idea_raw_text: idea.raw_text,
          archetype: idea.archetype,
          location_country: idea.location_country,
          location_region: idea.location_region,
          restatement: idea.restatement,
          answers,
          competitors: Array.isArray(competitors) ? competitors : [],
          cost_breakdown: costBreakdown,
          funding_options: Array.isArray(sections.funding_options) ? sections.funding_options : undefined,
          section_status: {
            competitors: sectionStatus.competitors ?? 'failed',
            compliance: sectionStatus.legal_compliance ?? 'failed',
          },
        }) }],
        system: SYNTHESIS_SYSTEM_PROMPT,
        maxTokens,
        tag: 'report:synthesis',
        model: stepModel('synthesis'),
        provider,
      }),
      r => extractJson(r.text) as SynthesisOutput,
    )
    bankStep('synthesise', synthOutcome)

    const synthesis: Partial<SynthesisOutput> = synthOutcome.status === 'ok' && synthOutcome.value
      ? synthOutcome.value
      : {
        summary: UNAVAILABLE('Summary generation failed.') as unknown as SynthesisOutput['summary'],
        viability_snapshot: UNAVAILABLE('Viability analysis failed.') as unknown as SynthesisOutput['viability_snapshot'],
        why_this_can_work: UNAVAILABLE('Opportunity framing failed.') as unknown as SynthesisOutput['why_this_can_work'],
        pricing_recommendation: UNAVAILABLE('Pricing analysis failed.') as unknown as SynthesisOutput['pricing_recommendation'],
        risks: [],
        next_steps: [],
        one_thing_to_do: UNAVAILABLE('Priority action generation failed.') as unknown as SynthesisOutput['one_thing_to_do'],
        validation_copy: UNAVAILABLE('Validation copy generation failed.') as unknown as SynthesisOutput['validation_copy'],
      }
    Object.assign(sections, synthesis)
    await persistSections('persist-synthesis')

    // ── Step 5: Assemble preview sections + complete ──────────
    await step.run('assemble', async () => {
      const partial = REQUIRED_SECTION_KEYS.some(key => !hasContent(sections[key]))

      // Admin-visible generation cost (USD, incl. web-search fees AND failed/
      // fallback attempts) + per-step diagnostics + which required sections are
      // thin. Underscore-prefixed so viewers skip it.
      sections._meta = {
        cost_usd: round4(totalCostUsd),
        model: effectiveModel,
        partial,
        section_status: sectionStatus,
        steps: stepMetas,
      }

      const competitorList = Array.isArray(competitors) ? competitors as Array<Record<string, unknown>> : []
      const allNextSteps = Array.isArray(synthesis.next_steps) ? synthesis.next_steps as Array<Record<string, unknown>> : []

      const previewSections = {
        summary: sections.summary,
        viability_snapshot: sections.viability_snapshot,
        competitors: competitorList.slice(0, 2).map(c => ({
          name: c.name,
          url: c.url,
          location: c.location,
          pricing_summary: c.pricing_summary,
        })),
        next_steps: allNextSteps.slice(0, 2),
      }

      await supabase.from('reports').update({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sections: sections as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        preview_sections: previewSections as any,
        status: 'complete',
        generation_completed_at: new Date().toISOString(),
        model_version: effectiveModel,
        cost_usd: round4((existingReport?.cost_usd ?? 0) + totalCostUsd),
      }).eq('id', reportId)

      // Record any real AI-step failures (even when a fallback recovered the
      // section) and partial reports, so the admin Errors page surfaces exactly
      // the "section came back failed" cases without digging through logs.
      const failedStepIds = Object.entries(stepMetas)
        .filter(([, m]) => m.status === 'failed')
        .map(([id]) => id)
      if (partial || failedStepIds.length > 0) {
        await logError({
          source: 'inngest:generate-report',
          message: partial
            ? `Report ${reportId} completed PARTIAL (missing required section)${failedStepIds.length ? ` — failed steps: ${failedStepIds.join(', ')}` : ''}`
            : `Report ${reportId} recovered via fallback — failed AI step(s): ${failedStepIds.join(', ')}`,
          detail: { reportId, ideaId, partial, section_status: sectionStatus, steps: stepMetas },
          path: 'generate-report',
          userId,
        })
      }
    })

    // ── Step 6: Report-ready email ────────────────────────────
    // Full reports only — the initial (teaser) report completes in seconds
    // while the user is watching, so there's nothing to email them about.
    // Own memoized step so a replay of this function never re-sends (Inngest
    // re-executes the whole body on every step boundary) and so an SMTP
    // failure can NEVER fail the report run — it's caught and logged, not
    // rethrown.
    await step.run('send-ready-email', async () => {
      try {
        const { data: userData } = await supabase.auth.admin.getUserById(userId)
        const ownerEmail = userData?.user?.email
        if (!ownerEmail) return

        const reportUrl = `${getSiteUrl()}/app/ideas/${ideaId}/report`
        const ideaSummary = idea.restatement ?? idea.raw_text
        const { html, text } = await buildBrandedEmail({
          bodyHtml: `<p>Your full report is ready for:</p>
<p><strong>${ideaSummary}</strong></p>
<p><a href="${reportUrl}">View your report</a></p>
<p>You can download it as a PDF from that page too.</p>`,
          bodyText: `Your full report is ready for:\n\n${ideaSummary}\n\nView your report: ${reportUrl}\n\nYou can download it as a PDF from that page too.`,
        })

        await sendMail({
          to: ownerEmail,
          subject: 'Your full report is ready',
          html,
          text,
        })
      } catch (err) {
        await logError({
          source: 'mailer',
          message: `Failed to send report-ready email for report ${reportId}`,
          detail: err,
          path: 'generate-report:send-ready-email',
          userId,
        })
      }
    })
  }
)
