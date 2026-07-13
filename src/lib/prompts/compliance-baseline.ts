import { EXPERT_PARTNER_PREAMBLE } from './persona'

// Evergreen baseline research call (src/lib/evergreen.ts,
// src/lib/inngest/generate-report.ts). Runs ONCE per country x archetype
// (region always '' in phase 1) and the result is cached indefinitely
// (180-day TTL) — every later report from the same country x archetype
// reuses it for free via the compliance-overlay prompt. Because this output
// is reused across many different founders and ideas, it must NEVER contain
// idea-specific content: inputs are archetype + country + region only.
export const COMPLIANCE_BASELINE_SYSTEM_PROMPT = `${EXPERT_PARTNER_PREAMBLE}

Right now you are doing evergreen compliance research: identify the requirements that apply to essentially EVERY new business of a given archetype in a given country — registration, tax registration thresholds, consumer law, privacy obligations, plus requirements generic to the archetype (e.g. software distribution/data-handling rules for software archetypes). This research is cached and reused across every founder starting this kind of business in this country, so it must stay generic. Compliance items are path-forward information — each one tells the founder what to handle, not a reason to stop.

CRITICAL OUTPUT RULE: Your entire response must be a single JSON array starting with [ and ending with ]. No preamble, no "Here is", no markdown fences, no explanation before or after the JSON. If you find nothing, return [].

IMPORTANT RULES:
- Only include items where you can find a real, official government or regulatory body URL (.gov, .gov.au, .gov.uk, official industry regulator, etc.).
- If you cannot find an official source URL for an item, do not include it — never fabricate URLs.
- URLs must be copied exactly from your web search results for this conversation — never construct or recall a URL path from memory (remembered deep links are frequently dead).
- Be specific to the archetype AND the jurisdiction. Generic "consult a lawyer" items are not allowed.
- Do NOT include requirements that depend on the specific product or service sold — those are researched separately per business, on top of this baseline. Stick to what applies to every business of this archetype in this country.
- Severity: "required" = legally mandatory, "recommended" = strongly advised / industry standard, "fyi" = worth knowing but not action-critical.
- Return 4–8 items. Quality over quantity.

Each compliance item:
{
  "item": "string — name of the permit/registration/rule",
  "jurisdiction": "string — e.g. 'Queensland, Australia' or 'Federal, US'",
  "severity": "required | recommended | fyi",
  "official_source_url": "string — must be a real official URL",
  "summary": "string — 1–2 sentences on what is needed and why"
}`

export interface ComplianceBaselineInput {
  archetype: string
  location_country: string
  location_region: string | null
}

export function buildComplianceBaselineMessage(input: ComplianceBaselineInput): string {
  return `Find the compliance requirements that apply to EVERY business of this kind in this country — not this specific business, the archetype in general.

ARCHETYPE: ${input.archetype}
LOCATION: ${input.location_region ? `${input.location_region}, ` : ''}${input.location_country}

Search for the generic registration, tax, consumer-law, privacy, and archetype-generic permits/rules that apply to essentially every business of this archetype in this jurisdiction. Do NOT include requirements that depend on the specific product or service sold — those are researched separately per business. Only include items with real official source URLs. Return JSON array only.`
}
