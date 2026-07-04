import { inngest } from '@/lib/inngest'
import { createServiceClient } from '@/lib/db'
import { callAI } from '@/lib/ai'
import { calculateCosts, parseNumber, currencyFor } from '@/lib/cost-calculator'
import {
  COMPETITOR_RESEARCH_SYSTEM_PROMPT,
  buildCompetitorResearchMessage,
} from '@/lib/prompts/competitor-research'
import { COMPLIANCE_SYSTEM_PROMPT, buildComplianceMessage } from '@/lib/prompts/compliance'
import {
  SYNTHESIS_SYSTEM_PROMPT,
  buildSynthesisMessage,
  type SynthesisOutput,
} from '@/lib/prompts/synthesis'

interface Question {
  key: string
  maps_to: string
}

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

function loadBank(archetype: string): Question[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(`@/lib/questions/${archetype}.json`) as Question[]
  } catch {
    return []
  }
}

const UNAVAILABLE = (reason: string) => ({ status: 'unavailable', reason })

// One retry protects against transient failures (truncation, malformed JSON,
// API hiccups) without duplicating whole-step retries in Inngest.
async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 2): Promise<T> {
  let lastErr: unknown
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      console.warn(`${label}: attempt ${i}/${attempts} failed:`, err instanceof Error ? err.message : err)
    }
  }
  throw lastErr
}

const WEB_SEARCH_TOOL = [{ type: 'web_search_20250305' as const, name: 'web_search' as const }]

export const generateReport = inngest.createFunction(
  {
    id: 'generate-report',
    retries: 0,
    triggers: [{ event: 'idea-engine/full-report.requested' }],
  },
  async ({ event, step }: { event: { data: { reportId: string; ideaId: string; userId: string } }; step: { run: <T>(id: string, fn: () => Promise<T>) => Promise<T> } }) => {
    const { reportId, ideaId } = event.data
    const supabase = createServiceClient()

    // ── Fetch idea + answers ───────────────────────────────────
    const { data: idea } = await supabase
      .from('ideas')
      .select('id, raw_text, archetype, location_country, location_region, restatement')
      .eq('id', ideaId)
      .single()

    if (!idea) throw new Error(`Idea ${ideaId} not found`)

    const { data: answersRows } = await supabase
      .from('answers')
      .select('question_key, answer_text')
      .eq('idea_id', ideaId)

    // Build maps_to → answer_text lookup from static bank
    const bank = loadBank(idea.archetype)
    const mapsTo: Record<string, string> = {}
    for (const row of answersRows ?? []) {
      const bankQ = bank.find(q => q.key === row.question_key)
      if (bankQ) mapsTo[bankQ.maps_to] = row.answer_text
    }

    const answers = Object.entries(mapsTo).map(([maps_to, answer]) => ({ maps_to, answer }))

    // Mark running
    await supabase
      .from('reports')
      .update({ status: 'running', generation_started_at: new Date().toISOString() })
      .eq('id', reportId)

    const sections: Record<string, unknown> = {}

    // ── Step 1: Competitor research ───────────────────────────
    let competitors: unknown
    try {
      competitors = await step.run('research-competitors', () => withRetry('research-competitors', async () => {
        const { text } = await callAI({
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
          maxTokens: 4096,
          tag: 'report:competitors',
          tools: WEB_SEARCH_TOOL,
        })
        const parsed = extractJson(text)
        if (!Array.isArray(parsed)) throw new Error('Competitor response not an array')
        return parsed
      }))
    } catch (err) {
      console.error('research-competitors failed:', err)
      competitors = UNAVAILABLE('Competitor research could not be completed.')
    }
    sections.competitors = competitors
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from('reports').update({ sections: sections as any }).eq('id', reportId)

    // ── Step 2: Cost estimation ───────────────────────────────
    let costBreakdown: unknown
    try {
      costBreakdown = await step.run('estimate-costs', async () => {
        const productArchetypes = ['physical_product', 'ecommerce_brand']
        if (productArchetypes.includes(idea.archetype)) {
          return calculateCosts({
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
        }
        // Non-product archetypes: return a simplified cost object
        return {
          per_unit: null,
          currency: currencyFor(idea.location_country),
          notes: `Cost structure for ${idea.archetype} depends on specific business model. Key inputs: startup capital = ${mapsTo['cost.startup_capital'] ?? 'not provided'}.`,
          estimation_flags: {},
        }
      })
    } catch (err) {
      console.error('estimate-costs failed:', err)
      costBreakdown = UNAVAILABLE('Cost estimation could not be completed.')
    }
    sections.cost_breakdown = costBreakdown
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from('reports').update({ sections: sections as any }).eq('id', reportId)

    // ── Step 3: Compliance check ──────────────────────────────
    let legalCompliance: unknown
    try {
      legalCompliance = await step.run('compliance-check', () => withRetry('compliance-check', async () => {
        const { text } = await callAI({
          messages: [{ role: 'user', content: buildComplianceMessage({
            archetype: idea.archetype,
            location_country: idea.location_country,
            location_region: idea.location_region,
            restatement: idea.restatement,
            sales_channel: mapsTo['idea.sales_channel'] ?? null,
            production_location: mapsTo['cost.production_location'] ?? null,
          }) }],
          system: COMPLIANCE_SYSTEM_PROMPT,
          maxTokens: 3072,
          tag: 'report:compliance',
          tools: WEB_SEARCH_TOOL,
        })
        const parsed = extractJson(text)
        if (!Array.isArray(parsed)) throw new Error('Compliance response not an array')
        return parsed
      }))
    } catch (err) {
      console.error('compliance-check failed:', err)
      legalCompliance = UNAVAILABLE('Compliance check could not be completed.')
    }
    sections.legal_compliance = legalCompliance
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from('reports').update({ sections: sections as any }).eq('id', reportId)

    // ── Step 4: Synthesis ─────────────────────────────────────
    let synthesis: Partial<SynthesisOutput>
    try {
      synthesis = await step.run('synthesise', () => withRetry('synthesise', async () => {
        const { text } = await callAI({
          messages: [{ role: 'user', content: buildSynthesisMessage({
            idea_raw_text: idea.raw_text,
            archetype: idea.archetype,
            location_country: idea.location_country,
            location_region: idea.location_region,
            restatement: idea.restatement,
            answers,
            competitors: Array.isArray(competitors) ? competitors : [],
            cost_breakdown: costBreakdown,
          }) }],
          system: SYNTHESIS_SYSTEM_PROMPT,
          // The synthesis JSON (summary + 4 scored dimensions + pricing +
          // 3-5 risks + 3-5 next steps) regularly exceeds 2048 tokens —
          // that cap truncated the JSON and killed all five sections at once.
          maxTokens: 4096,
          tag: 'report:synthesis',
        })
        return extractJson(text) as SynthesisOutput
      }))
    } catch (err) {
      console.error('synthesise failed:', err)
      synthesis = {
        summary: UNAVAILABLE('Summary generation failed.') as unknown as SynthesisOutput['summary'],
        viability_snapshot: UNAVAILABLE('Viability analysis failed.') as unknown as SynthesisOutput['viability_snapshot'],
        pricing_recommendation: UNAVAILABLE('Pricing analysis failed.') as unknown as SynthesisOutput['pricing_recommendation'],
        risks: [],
        next_steps: [],
      }
    }
    Object.assign(sections, synthesis)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from('reports').update({ sections: sections as any }).eq('id', reportId)

    // ── Step 5: Assemble preview sections + complete ──────────
    await step.run('assemble', async () => {
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabase.from('reports').update({
        sections: sections as any,
        preview_sections: previewSections as any,
        status: 'complete',
        generation_completed_at: new Date().toISOString(),
        model_version: 'claude-sonnet-4-6',
      }).eq('id', reportId)
    })
  }
)
