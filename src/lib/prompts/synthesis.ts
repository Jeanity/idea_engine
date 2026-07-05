import { EXPERT_PARTNER_PREAMBLE } from './persona'

export const SYNTHESIS_SYSTEM_PROMPT = `${EXPERT_PARTNER_PREAMBLE}

Right now you are writing the structured sections of the founder's opportunity report. You will be given the idea, the founder's answers, competitor data, cost data, and (when available) funding options research — then produce the report sections as a single JSON object.

OUTPUT: A single JSON object with exactly these keys: summary, viability_snapshot, pricing_recommendation, risks, next_steps. No prose, no markdown fences, no explanation.

RULES:
- summary.text: 3–5 sentences. Specific to this idea — mentions archetype, location, and one concrete market signal. Not generic.
- viability_snapshot.scores: four dimensions, each scored 1–5.
  - market_opportunity: 1=tiny niche, 5=huge proven market
  - execution_difficulty: 1=very easy, 5=very hard
  - capital_required: 1=near zero, 5=heavy capital needed
  - time_to_revenue: 1=could earn this week, 5=18+ months to first dollar
  - Scores must be calibrated against each other (not all 3s). Rationale is 1 specific sentence.
  - overall_verdict: 2–3 sentences synthesising the scores in plain language.
- pricing_recommendation: reference actual competitor prices in the rationale if available. Suggest a range, not a single number.
- risks (shown to the founder as "Things to consider"): 3–5 items, ordered most-consequential first. Each item is a concrete fact to weigh (e.g. "17 direct competitors within delivery range", "tooling runs $8k–$25k before first unit"), specific to this idea — not generic startup advice. The mitigation field is the practical way to handle it. Facts and handling, never verdicts — do not tell the founder the idea is too hard or not worth trying. Where an item hinges on specialist knowledge (engineering, chemistry, IP law), the mitigation names the professional or quote that resolves it.
- next_steps: 3–5 items, ordered do-first first. Timeframes are honest (week 1 must be achievable in week 1).
- BUDGET GAP RULE: compare the founder's stated available capital (answers) against the estimated startup costs (cost_data). If capital falls short, you MUST address the gap constructively: at least one risk covers the shortfall with a financing mitigation, and at least one next_step is a concrete funding action. Use the funding_options data when provided (name the actual programs); never conclude the idea is unviable purely because current capital is short.

EXACT JSON SHAPES (use these key names and no others):
- summary: { "text": string }
- viability_snapshot: { "scores": { "market_opportunity": { "score": number, "rationale": string }, "execution_difficulty": { "score": number, "rationale": string }, "capital_required": { "score": number, "rationale": string }, "time_to_revenue": { "score": number, "rationale": string } }, "overall_verdict": string }
- pricing_recommendation: { "model": string, "suggested_price_or_range": string, "rationale": string, "comparable_market_rates": string }
- risks: [ { "title": string, "description": string, "mitigation": string } ] — every risk MUST include a concrete mitigation
- next_steps: [ { "action": string, "timeframe": string, "rationale": string } ]`

export interface SynthesisInput {
  idea_raw_text: string
  archetype: string
  location_country: string
  location_region: string | null
  restatement: string | null
  answers: Array<{ maps_to: string; answer: string }>
  competitors: unknown[]
  cost_breakdown: unknown
  /** Output of the financing-bridge step, when it ran (budget shortfall detected). */
  funding_options?: unknown[]
}

export interface SynthesisOutput {
  summary: { text: string }
  viability_snapshot: {
    scores: {
      market_opportunity: { score: number; rationale: string }
      execution_difficulty: { score: number; rationale: string }
      capital_required: { score: number; rationale: string }
      time_to_revenue: { score: number; rationale: string }
    }
    overall_verdict: string
  }
  pricing_recommendation: {
    model: string
    suggested_price_or_range: string
    rationale: string
    comparable_market_rates: string
  }
  risks: Array<{ title: string; description: string; mitigation: string }>
  next_steps: Array<{ action: string; timeframe: string; rationale: string }>
}

export function buildSynthesisMessage(input: SynthesisInput): string {
  return JSON.stringify({
    idea: input.restatement ?? input.idea_raw_text,
    archetype: input.archetype,
    location: input.location_region ? `${input.location_region}, ${input.location_country}` : input.location_country,
    answers: input.answers,
    competitors_found: input.competitors,
    cost_data: input.cost_breakdown,
    ...(input.funding_options && input.funding_options.length > 0
      ? { funding_options: input.funding_options }
      : {}),
  })
}
