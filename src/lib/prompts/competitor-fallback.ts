import { EXPERT_PARTNER_PREAMBLE } from './persona'

// Used only when the live web-search competitor step fails. This is a cheap,
// NO-SEARCH call: the model answers purely from its training knowledge, so
// nothing external can fail. Everything it returns is explicitly labelled
// model-inferred so the UI and synthesis never imply live research succeeded.
export const COMPETITOR_FALLBACK_SYSTEM_PROMPT = `${EXPERT_PARTNER_PREAMBLE}

Live competitor web search was unavailable, so you are producing a BEST-EFFORT competitor picture from your own training knowledge — no web search. A crowded market is information, not a verdict.

CRITICAL OUTPUT RULE: Your entire response must be a single JSON array starting with [ and ending with ]. No preamble, no markdown fences, no explanation before or after.

RULES:
- Return 4–8 entries mixing these kinds where they exist: direct competitors, adjacent tools, substitute products/behaviours (e.g. "manual advice on Reddit"), and marketplace/platform alternatives.
- Use "kind" to say which each one is.
- Only include names you are genuinely confident are real. Do NOT fabricate a company that may not exist.
- NEVER output a url field — you have not verified any link. Omit url entirely.
- pricing_summary: a rough recollection is fine, but prefix uncertain figures with "approx." — never invent precise prices.
- gap_notes: what this player is genuinely weak at or does not do, relevant to the founder's angle.
- Every entry MUST include "confidence": "model_inferred".

Each entry:
{
  "name": "string",
  "kind": "direct | adjacent | substitute | marketplace",
  "location": "string — 'Online / global' if unsure",
  "pricing_summary": "string — approx., or 'Pricing not verified'",
  "positioning_angle": "string — what they are known for",
  "gap_notes": "string — where they are weak or absent",
  "confidence": "model_inferred"
}`

export interface CompetitorFallbackInput {
  idea_raw_text: string
  archetype: string
  location_country: string
  location_region: string | null
  restatement: string | null
  target_customer: string | null
  differentiator: string | null
  geographic_scope: string | null
}

export function buildCompetitorFallbackMessage(input: CompetitorFallbackInput): string {
  return `From your training knowledge only (no web search), list the players this founder is really up against.

IDEA: ${input.restatement ?? input.idea_raw_text}
ARCHETYPE: ${input.archetype}
LOCATION: ${input.location_region ? `${input.location_region}, ` : ''}${input.location_country}
MARKET SCOPE: ${input.geographic_scope ?? 'not specified'}
TARGET CUSTOMER: ${input.target_customer ?? 'not specified'}
DIFFERENTIATOR: ${input.differentiator ?? 'not specified'}

Include direct competitors, adjacent tools, substitutes, and marketplaces where relevant. Return JSON array only.`
}
