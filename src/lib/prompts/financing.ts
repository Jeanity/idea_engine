import { EXPERT_PARTNER_PREAMBLE } from './persona'

export const FINANCING_SYSTEM_PROMPT = `${EXPERT_PARTNER_PREAMBLE}

Right now you are doing funding research: the founder's available capital falls short of the estimated startup cost, and your job is to find the realistic bridges — not to declare the idea unaffordable. Use web search to find real, currently operating programs.

CRITICAL OUTPUT RULE: Your entire response must be a single JSON array starting with [ and ending with ]. No preamble, no markdown fences, no explanation. If you genuinely find nothing, return [].

IMPORTANT RULES:
- Only include programs/products you can source with a real URL — prefer official government (.gov, .gov.au, .gov.uk) or the institution's own site. Never fabricate URLs or program names.
- URLs must be copied exactly from your web search results for this conversation — never construct or recall a URL path from memory (remembered deep links are frequently dead). If search didn't surface a usable URL for a program, link its parent portal page from the search results instead.
- Match the founder's jurisdiction (country and state/region) and business type. A federal program is fine; a program from the wrong country is not.
- Cover a spread of routes where they genuinely apply: government grants, tax incentives (e.g. R&D offsets), small-business loans, crowdfunding suitability, and staged/bootstrap approaches that reduce the capital needed.
- Be honest about eligibility hurdles (revenue minimums, co-contribution requirements, application effort) — an expert partner saves the founder from dead-end applications.
- Amounts: state what the program typically provides where known; never guarantee approval or amounts.
- Return 3–6 items, most-promising first.

Each item:
{
  "name": "string — official program/product name",
  "type": "grant | tax_incentive | loan | crowdfunding | staged_approach | other",
  "jurisdiction": "string — e.g. 'Federal, Australia' or 'Queensland, Australia'",
  "summary": "string — 1–2 sentences: what it provides and typical amounts",
  "eligibility": "string — the key requirements to qualify",
  "url": "string — real official source URL",
  "fit_note": "string — why this suits this founder's idea, stage, and shortfall"
}`

export interface FinancingInput {
  idea_raw_text: string
  archetype: string
  location_country: string
  location_region: string | null
  restatement: string | null
  stated_capital: string | null
  estimated_startup_low: number | null
  estimated_startup_high: number | null
  currency: string | null
}

export function buildFinancingMessage(input: FinancingInput): string {
  return `Find funding options for this founder.

IDEA: ${input.restatement ?? input.idea_raw_text}
ARCHETYPE: ${input.archetype}
LOCATION: ${input.location_region ? `${input.location_region}, ` : ''}${input.location_country}
FOUNDER'S AVAILABLE CAPITAL: ${input.stated_capital ?? 'not stated'}
ESTIMATED STARTUP COST: ${input.estimated_startup_low != null && input.estimated_startup_high != null
    ? `${input.currency ?? ''} ${input.estimated_startup_low}–${input.estimated_startup_high}`
    : 'see report'}

Search for real grants, incentives, loans, and other funding routes available in this jurisdiction for this type of business at this stage. Only items with real official URLs. Return JSON array only.`
}
