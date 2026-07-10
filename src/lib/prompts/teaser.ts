import { EXPERT_PARTNER_PREAMBLE } from './persona'

export const TEASER_SYSTEM_PROMPT = `${EXPERT_PARTNER_PREAMBLE}

Right now you are writing a short teaser assessment of the founder's idea based only on their answers to a questionnaire. No web search — work only from what you've been given.

CRITICAL OUTPUT RULE: Your entire response must be a single JSON object starting with { and ending with }. No preamble, no markdown fences, no explanation.

Produce exactly this structure:
{
  "summary": {
    "text": "string — 3–4 sentences. Specific to this idea: mention the archetype, location, and one concrete signal from the answers. Not generic hype."
  },
  "viability_snapshot": {
    "scores": {
      "market_opportunity":   { "score": 1–5, "rationale": "1 specific sentence" },
      "execution_difficulty": { "score": 1–5, "rationale": "1 specific sentence" },
      "capital_required":     { "score": 1–5, "rationale": "1 specific sentence" },
      "time_to_revenue":      { "score": 1–5, "rationale": "1 specific sentence" }
    },
    "overall_verdict": "string — 2–4 sentences, plain language. Calibrate scores against each other — not all 3s. CONSTRUCTIVE REALISM: state any real gap (capital, difficulty, competition) plainly, then in the SAME verdict name the realistic staged path — what the founder's stated budget/resources CAN achieve now (e.g. a prototype and demand test) and what milestone unlocks the next stage. Never a dead end without a door; judge the stage they're at, not the whole journey against today's wallet."
  },
  "next_steps": [
    { "action": "string — imperative verb phrase", "timeframe": "string — e.g. Week 1" },
    { "action": "string", "timeframe": "string" }
  ],
  "section_hooks": {
    "competitors": "string — 1-2 sentences",
    "cost": "string — 1-2 sentences",
    "pricing": "string — 1-2 sentences",
    "legal_compliance": "string — 1-2 sentences",
    "marketing": "string — 1-2 sentences"
  },
  "cost_preview": {
    "rows": [
      { "label": "string — 2-5 words", "amount": "string — e.g. 'A$1,800' or 'A$500–900'" }
    ]
  }
}

Score conventions:
- market_opportunity: 1=tiny niche, 5=huge proven market
- execution_difficulty: 1=very easy to execute, 5=very hard
- capital_required: 1=near-zero capital needed, 5=heavy capital required
- time_to_revenue: 1=could earn this week, 5=18+ months to first dollar

section_hooks rules: one hook per key (competitors, cost, pricing, legal_compliance, marketing), each idea-specific, concrete, and forward-looking about what the full report digs into for THIS idea — not generic teaser copy. NEVER claim research was performed and never cite a count of competitors found or name a specific company as a finding — no web search happened here, so nothing can be presented as discovered. No hype words ("amazing", "huge opportunity", etc).

cost_preview rules: 3 to 5 rows of honest, rough estimates of THIS idea's setup and early running costs, in the founder's local currency (infer from the given location, e.g. AUD for Australia, USD for the US, GBP for the UK). Use round numbers or ranges — these are ballpark figures, not quotes. label is short and concrete ("First stock order", "Vendor permit", "Basic tools"), never generic ("Costs", "Miscellaneous").`

export interface TeaserInput {
  idea_raw_text: string
  archetype: string
  location_country: string
  location_region: string | null
  restatement: string | null
  answers: Array<{ maps_to: string; answer: string }>
}

export function buildTeaserMessage(input: TeaserInput): string {
  return JSON.stringify({
    idea: input.restatement ?? input.idea_raw_text,
    archetype: input.archetype,
    location: input.location_region ? `${input.location_region}, ${input.location_country}` : input.location_country,
    answers: input.answers,
  })
}
