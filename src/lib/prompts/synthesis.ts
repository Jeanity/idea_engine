export const SYNTHESIS_SYSTEM_PROMPT = `You are a business analyst writing structured sections of an opportunity report. You will be given a business idea, the user's answers, competitor data, and cost data — then produce four report sections as a single JSON object.

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
- risks: 3–5 items, ordered most-severe first. Specific to this idea — not generic startup advice.
- next_steps: 3–5 items, ordered do-first first. Timeframes are honest (week 1 must be achievable in week 1).`

export interface SynthesisInput {
  idea_raw_text: string
  archetype: string
  location_country: string
  location_region: string | null
  restatement: string | null
  answers: Array<{ maps_to: string; answer: string }>
  competitors: unknown[]
  cost_breakdown: unknown
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
  })
}
