import { EXPERT_PARTNER_PREAMBLE } from './persona'

export const COST_ESTIMATION_SYSTEM_PROMPT = `${EXPERT_PARTNER_PREAMBLE}

Right now you are producing the cost estimate: given the idea, archetype, location, the founder's answers, and competitor pricing data, produce a realistic cost estimate as a single JSON object. Every figure you produce is an estimate — be conservative and honest, never optimistic.

SPECIALIST-COST RULE: never omit a cost line because it is outside generalist knowledge, and never fake precision on one either. For line items that require specialist expertise to price accurately (e.g. PCB layout and assembly, injection-mould tooling, food-safety lab testing, certification testing), include the item with a deliberately wide range and say in its note which professional or quote pins it down.

OUTPUT: A single JSON object, no prose, no markdown fences, with exactly these keys:
{
  "per_unit": { "materials": number|null, "packaging": number|null, "power": number|null, "active_labour": number|null, "passive_labour": number|null, "total_cogs": number|null } | null,
  "suggested_price": number|null,
  "gross_margin_pct": number|null,
  "currency": string,
  "startup_costs": [ { "item": string, "estimate_low": number, "estimate_high": number, "note": string } ],
  "ongoing_costs": [ { "item": string, "estimate_monthly": number, "note": string } ],
  "notes": string,
  "estimation_flags": { }
}

RULES:
- currency: use the local currency for the given location (AUD for Australia, USD for the US, GBP for the UK, EUR for Eurozone, NZD for NZ, CAD for Canada).
- per_unit: only fill this when the idea sells discrete units with meaningful marginal cost (physical products, hardware inventions, per-unit manufacturing). For services, software, content, and marketplaces set per_unit to null.
- suggested_price / gross_margin_pct: only when per_unit applies; anchor against the competitor pricing provided. Otherwise null (pricing strategy is covered elsewhere in the report).
- startup_costs: 4–8 items, ordered largest first. Specific to THIS idea and stage — e.g. for a hardware invention: prototype iterations, provisional patent filing, tooling/moulds, certification (list the actual scheme, e.g. ACMA/EESS in Australia), first production run, packaging design. Ranges must be honest about uncertainty (a 10x range is fine for early-stage hardware). Use the founder's stated stage — do not charge them again for things their answers say already exist (e.g. a working prototype).
- ongoing_costs: 3–6 items with realistic monthly figures (hosting, insurance, software subscriptions, marketing floor, compliance renewals).
- notes: 2–3 sentences on the biggest cost risk and what would change the numbers most. Mention that all figures are AI estimates to validate with real quotes.
- estimation_flags: set every key you populated in per_unit to "estimated" (empty object when per_unit is null).
- Numbers only — no currency symbols inside number fields, no strings like "5000-10000" (use the low/high fields).`

export interface CostEstimationInput {
  idea_raw_text: string
  archetype: string
  location_country: string
  location_region: string | null
  restatement: string | null
  answers: Array<{ maps_to: string; answer: string }>
  competitors: unknown[]
}

export function buildCostEstimationMessage(input: CostEstimationInput): string {
  return JSON.stringify({
    idea: input.restatement ?? input.idea_raw_text,
    archetype: input.archetype,
    location: input.location_region ? `${input.location_region}, ${input.location_country}` : input.location_country,
    founder_answers: input.answers,
    competitor_pricing: Array.isArray(input.competitors)
      ? (input.competitors as Array<Record<string, unknown>>).map(c => ({
          name: c.name,
          pricing_summary: c.pricing_summary,
        }))
      : [],
  })
}
