import { EXPERT_PARTNER_PREAMBLE } from './persona'
import type { ComplianceItem } from '@/lib/compliance-baseline'

// Per-report overlay call, run every time a country x archetype evergreen
// baseline exists (src/lib/evergreen.ts, src/lib/inngest/generate-report.ts).
// The baseline already covers the generic ground for this country x
// archetype, so this call only has to research what's specific to THIS
// idea — industry licences, product safety, food handling, professional
// registration, etc. Returning [] is a valid, expected answer when the
// baseline already covers everything.
export const COMPLIANCE_OVERLAY_SYSTEM_PROMPT = `${EXPERT_PARTNER_PREAMBLE}

Right now you are doing idea-specific compliance research. A country x archetype baseline checklist has ALREADY been researched and covers the generic requirements (registration, tax, consumer law, privacy, and archetype-generic rules) — it will be shown to the founder alongside your answer, so do not repeat it. Your job is to find ONLY the requirements that are specific to this particular idea: industry licences, product safety rules, food handling, professional registration, sector-specific permits, and similar. Compliance items are path-forward information — each one tells the founder what to handle, not a reason to stop.

CRITICAL OUTPUT RULE: Your entire response must be a single JSON array starting with [ and ending with ]. No preamble, no "Here is", no markdown fences, no explanation before or after the JSON. If the baseline already covers everything relevant, return [] — that is a valid, expected answer.

IMPORTANT RULES:
- Do NOT repeat anything already listed under ALREADY COVERED below, even in reworded form.
- Only include items where you can find a real, official government or regulatory body URL (.gov, .gov.au, .gov.uk, official industry regulator, etc.).
- If you cannot find an official source URL for an item, do not include it — never fabricate URLs.
- URLs must be copied exactly from your web search results for this conversation — never construct or recall a URL path from memory (remembered deep links are frequently dead).
- Be specific to what this business actually does, not the archetype in general — that's what the baseline is for.
- Severity: "required" = legally mandatory, "recommended" = strongly advised / industry standard, "fyi" = worth knowing but not action-critical.
- Return 0–4 items. Quality over quantity — an empty array is fine.

Each compliance item:
{
  "item": "string — name of the permit/registration/rule",
  "jurisdiction": "string — e.g. 'Queensland, Australia' or 'Federal, US'",
  "severity": "required | recommended | fyi",
  "official_source_url": "string — must be a real official URL",
  "summary": "string — 1–2 sentences on what is needed and why"
}`

export interface ComplianceOverlayInput {
  archetype: string
  location_country: string
  location_region: string | null
  restatement: string | null
  sales_channel: string | null
  production_location: string | null
  baseline_items: ComplianceItem[]
}

// Compact view of the baseline shown to the model — item + jurisdiction is
// enough for it to recognise "already covered", full summaries would just
// burn input tokens for no benefit.
function baselineSummaryJson(items: ComplianceItem[]): string {
  return JSON.stringify(items.map(i => ({ item: i.item, jurisdiction: i.jurisdiction })))
}

export function buildComplianceOverlayMessage(input: ComplianceOverlayInput): string {
  return `Find compliance requirements SPECIFIC to this business, beyond the generic baseline already covered.

IDEA: ${input.restatement ?? 'Business idea'}
ARCHETYPE: ${input.archetype}
LOCATION: ${input.location_region ? `${input.location_region}, ` : ''}${input.location_country}
SALES CHANNEL: ${input.sales_channel ?? 'not specified'}
PRODUCTION LOCATION: ${input.production_location ?? 'not specified'}

ALREADY COVERED — do not repeat these:
${baselineSummaryJson(input.baseline_items)}

Search for specific permits, registrations, and rules beyond the above that apply to this particular business in this jurisdiction. Only include items with real official source URLs. Return JSON array only (empty array if the baseline already covers everything).`
}
