import { EXPERT_PARTNER_PREAMBLE } from './persona'

// Used only when the live web-search compliance step fails. Cheap, NO-SEARCH
// call: the model produces a baseline legal/compliance checklist from its own
// training knowledge. Every item is labelled model_inferred and carries no
// fabricated source URL, so the UI and synthesis never imply live research ran.
export const COMPLIANCE_FALLBACK_SYSTEM_PROMPT = `${EXPERT_PARTNER_PREAMBLE}

Live regulatory web search was unavailable, so you are producing a BEST-EFFORT baseline compliance checklist from your own training knowledge — no web search. Each item is path-forward information, not a reason to stop.

CRITICAL OUTPUT RULE: Your entire response must be a single JSON array starting with [ and ending with ]. No preamble, no markdown fences, no explanation before or after.

RULES:
- Tailor items to the archetype, jurisdiction, and business model given.
- NEVER output an official_source_url field — you have not verified any link this session. Omit it entirely.
- For software / app / web / downloadable products, always cover the applicable baseline: Terms of Use, Privacy Policy, affiliate/commission disclosure, liability disclaimer, data collection/storage disclosure, security/code-signing, refund/consumer-law positioning, third-party API/scraping/retailer terms, and a "not legal advice" note.
- Add jurisdiction-specific items where you know them (e.g. for Australia: Australian Consumer Law, Privacy Act obligations, ABN/company registration).
- Severity: "required" = legally mandatory, "recommended" = strongly advised, "fyi" = worth knowing.
- Return 5–10 items. Every item MUST include "confidence": "model_inferred".

Each item:
{
  "item": "string",
  "jurisdiction": "string",
  "severity": "required | recommended | fyi",
  "summary": "string — 1–2 sentences on what is needed and why",
  "confidence": "model_inferred"
}`

export interface ComplianceFallbackInput {
  archetype: string
  location_country: string
  location_region: string | null
  restatement: string | null
  sales_channel: string | null
  business_model: string | null
}

export function buildComplianceFallbackMessage(input: ComplianceFallbackInput): string {
  return `From your training knowledge only (no web search), produce a baseline legal/compliance checklist.

IDEA: ${input.restatement ?? 'Business idea'}
ARCHETYPE: ${input.archetype}
LOCATION: ${input.location_region ? `${input.location_region}, ` : ''}${input.location_country}
SALES CHANNEL: ${input.sales_channel ?? 'not specified'}
BUSINESS MODEL: ${input.business_model ?? 'not specified'}

Cover the baseline for this type of business in this jurisdiction. Return JSON array only.`
}
