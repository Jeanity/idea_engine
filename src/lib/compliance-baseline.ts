// Deterministic, no-AI compliance baseline. This is the last-resort fallback:
// if BOTH live compliance search and the model-inferred fallback fail, the
// Legal & Compliance tab still shows a useful, non-empty checklist instead of
// "could not be completed". Items carry no official_source_url (we won't
// fabricate one) and are explicitly marked model_inferred.

export interface ComplianceItem {
  item: string
  jurisdiction: string
  severity: 'required' | 'recommended' | 'fyi'
  official_source_url?: string
  summary: string
  confidence?: 'model_inferred'
}

// Archetypes that ship software / run as a web or downloadable app.
const SOFTWARE_ARCHETYPES = new Set(['software_app', 'content_education'])

function isSoftware(archetype: string): boolean {
  return SOFTWARE_ARCHETYPES.has(archetype)
}

/**
 * Baseline legal/compliance checklist derived deterministically from the
 * jurisdiction + archetype. Country-specific wording is added for known
 * jurisdictions (currently AU); everything else gets the generic-but-useful
 * checklist. Always returns at least a handful of items.
 */
export function staticComplianceBaseline(
  archetype: string,
  countryCode: string,
): ComplianceItem[] {
  const country = (countryCode ?? '').toUpperCase()
  const jur = country || 'Your country'
  const items: ComplianceItem[] = []

  const software = isSoftware(archetype)

  // ── Universal commercial baseline ────────────────────────────
  items.push({
    item: 'Business / company registration',
    jurisdiction: jur,
    severity: 'required',
    summary: 'Register the business (sole trader/company as appropriate) before earning revenue, so income is declared correctly and you can invoice and open a business bank account.',
    confidence: 'model_inferred',
  })
  items.push({
    item: 'Terms of Use / Terms of Service',
    jurisdiction: jur,
    severity: 'required',
    summary: 'A written agreement governing how customers may use your product, limiting your liability and setting expectations. Essential once money changes hands or users create accounts.',
    confidence: 'model_inferred',
  })
  items.push({
    item: 'Privacy Policy & data-handling disclosure',
    jurisdiction: jur,
    severity: 'required',
    summary: 'Disclose what personal or device data you collect, why, where it is stored, and how users can request deletion. Required almost anywhere you collect user data.',
    confidence: 'model_inferred',
  })
  items.push({
    item: 'Consumer-law / refund positioning',
    jurisdiction: jur,
    severity: 'recommended',
    summary: 'Set a clear refund and support policy that complies with local consumer-protection law. Consumer guarantees usually cannot be disclaimed by fine print.',
    confidence: 'model_inferred',
  })

  // ── Software / app specifics ─────────────────────────────────
  if (software) {
    items.push({
      item: 'Affiliate / commission disclosure',
      jurisdiction: jur,
      severity: 'required',
      summary: 'If you earn commission on links or recommendations, disclose it plainly to users. Undisclosed affiliate earnings breach advertising/consumer rules in most markets.',
      confidence: 'model_inferred',
    })
    items.push({
      item: 'Liability disclaimer for automated recommendations',
      jurisdiction: jur,
      severity: 'recommended',
      summary: 'Where the product gives automated advice that could cause loss or damage if wrong (e.g. hardware compatibility), disclaim warranties for the guidance while still honouring consumer guarantees.',
      confidence: 'model_inferred',
    })
    items.push({
      item: 'Data collection, storage & security disclosure',
      jurisdiction: jur,
      severity: 'required',
      summary: 'If the app reads device/system data, tell users exactly what is read, whether it leaves their machine, and how it is secured. Minimise what you collect.',
      confidence: 'model_inferred',
    })
    items.push({
      item: 'Code signing / distribution trust',
      jurisdiction: jur,
      severity: 'recommended',
      summary: 'A downloadable desktop app should be code-signed (e.g. an EV certificate) or it will be flagged by OS SmartScreen/antivirus, hurting installs and trust.',
      confidence: 'model_inferred',
    })
    items.push({
      item: 'Third-party API / scraping / retailer terms',
      jurisdiction: jur,
      severity: 'required',
      summary: 'Review the terms of any retailer feeds, affiliate programs, or data sources you pull from — automated access and price scraping are often restricted and can get accounts terminated.',
      confidence: 'model_inferred',
    })
  }

  // ── Australia-specific notes ─────────────────────────────────
  if (country === 'AU') {
    items.push({
      item: 'Australian Consumer Law (ACL) compliance',
      jurisdiction: 'Federal, Australia',
      severity: 'required',
      summary: 'The ACL applies consumer guarantees that cannot be excluded — your refund/warranty terms must not misrepresent these rights. Misleading conduct is enforced by the ACCC.',
      confidence: 'model_inferred',
    })
    items.push({
      item: 'Privacy Act obligations (personal/device data)',
      jurisdiction: 'Federal, Australia',
      severity: 'required',
      summary: 'If you collect personal information (including some device data) and cross turnover thresholds or handle sensitive data, the Privacy Act and Australian Privacy Principles apply. Have a compliant privacy policy regardless.',
      confidence: 'model_inferred',
    })
    items.push({
      item: 'ABN / company registration (commercialising)',
      jurisdiction: 'Federal, Australia',
      severity: 'required',
      summary: 'Register for an ABN (and consider a Pty Ltd company once revenue or liability grows) before commercialising. Needed to invoice, register for GST if applicable, and operate lawfully.',
      confidence: 'model_inferred',
    })
  }

  items.push({
    item: 'This is not legal advice',
    jurisdiction: jur,
    severity: 'fyi',
    summary: 'These baseline items were generated automatically because live regulatory search was unavailable. Confirm each with an official source or a qualified professional before relying on it.',
    confidence: 'model_inferred',
  })

  return items
}
