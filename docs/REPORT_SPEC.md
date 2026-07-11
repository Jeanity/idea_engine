# Report Specification

_This is the authoritative contract for Phase 4. All prompts, pipeline steps, and the report viewer are built against this document._

---

## 1. JSONB Section Schema

All sections are stored in the `reports.sections` JSONB column. The `reports.preview_sections` column contains the free-preview subset (see §3).

### 1.1 `summary`
```jsonc
{
  "text": "string — 3–5 sentences covering what the idea is, who it serves, and the headline viability signal."
}
```

### 1.2 `viability_snapshot`
```jsonc
{
  "scores": {
    "market_opportunity":    { "score": 1–5, "rationale": "string — 1 sentence" },
    "execution_difficulty":  { "score": 1–5, "rationale": "string — 1 sentence" },
    "capital_required":      { "score": 1–5, "rationale": "string — 1 sentence" },
    "time_to_revenue":       { "score": 1–5, "rationale": "string — 1 sentence" }
  },
  "overall_verdict": "string — 2–3 sentences synthesising the four scores into a plain-language verdict.",
  "success_outlook": { "score": "0–100 integer", "rationale": "string — 1 sentence" }
}
```
Score conventions: 1 = very low / very easy, 5 = very high / very hard. `capital_required` 1 = minimal capital needed, 5 = heavy capital required.

`success_outlook` is the founder-specific outlook that THIS founder makes the idea work in THEIR market (0–100, distinct from the four 1–5 dimensions above) — it folds in factors the four dimensions don't capture: available capital vs estimated startup costs, the founder's own answers, competitive saturation, and risk severity. Added 2026-07-11 — reports generated before this date lack the field; consumers must guard for its absence and render unchanged when missing.

### 1.3 `competitors`
```jsonc
[
  {
    "name":               "string",
    "url":                "string — full https:// URL, must be real and verifiable",
    "location":           "string — city/country or 'Online / global'",
    "pricing_summary":    "string — e.g. '$8–14 per bag, 200g' or 'Subscription from $29/mo'",
    "positioning_angle":  "string — what makes this competitor distinctive",
    "gap_notes":          "string — what they don't serve or where the user could differentiate"
  }
]
```
Minimum 3, target 5–8. At least 1 must be local/national to the user's location. URLs are validated (well-formed, https://). If a URL cannot be verified, omit the competitor rather than fabricate.

### 1.4 `cost_breakdown`
```jsonc
{
  "per_unit": {
    "materials":       "number | null",
    "packaging":       "number | null",
    "power":           "number | null",
    "active_labour":   "number | null",
    "passive_labour":  "number | null",
    "total_cogs":      "number | null"
  },
  "suggested_price":    "number | null",
  "gross_margin_pct":   "number | null",
  "currency":           "string — ISO 4217, e.g. AUD",
  "notes":              "string — assumptions made, which fields are estimates vs user-provided",
  "estimation_flags": {
    "materials":     "user_provided | estimated | not_applicable",
    "packaging":     "user_provided | estimated | not_applicable",
    "power":         "user_provided | estimated | not_applicable",
    "active_labour": "user_provided | estimated | not_applicable",
    "passive_labour":"user_provided | estimated | not_applicable"
  }
}
```
For non-product archetypes (software, content, service, marketplace), most `per_unit` fields will be `null` with `estimation_flags` set to `not_applicable`. The engine falls back to a startup-cost + pricing-benchmark narrative in `notes`.

**Power formula (deterministic):** `(equipment_wattage / 1000) × (passive_minutes_per_batch / 60) × local_kwh_rate × (1 / batch_yield)`

**Active labour formula (deterministic):** `(active_minutes_per_batch / 60) × hourly_rate / batch_yield`

**Passive labour formula:** tracked separately as `(passive_minutes_per_batch / 60) × hourly_rate / batch_yield` — shown distinct from active so the user understands their true time cost.

### 1.5 `pricing_recommendation`
```jsonc
{
  "model":                    "string — e.g. 'Per-unit retail', 'Subscription', 'Commission'",
  "suggested_price_or_range": "string — e.g. '$12–16 per bag' or '$29–49/mo'",
  "rationale":                "string — 2–3 sentences referencing competitor data and margin targets",
  "comparable_market_rates":  "string — 1–2 sentences on what comparable products/services sell for"
}
```

### 1.6 `legal_compliance`
```jsonc
[
  {
    "item":                "string — name of the permit, registration, or rule",
    "jurisdiction":        "string — e.g. 'Queensland, Australia' or 'Federal, US'",
    "severity":            "required | recommended | fyi",
    "official_source_url": "string — must be a .gov, .gov.au, or recognised official body URL",
    "summary":             "string — 1–2 sentences on what is needed and why"
  }
]
```
Only items with a verified `official_source_url` are included. Items where no official source is found are silently dropped (never fabricated). The disclaimer block (§6) is always appended to this section in the UI.

### 1.7 `risks`
```jsonc
[
  {
    "title":       "string — 3–7 words",
    "description": "string — 1–2 sentences",
    "mitigation":  "string — 1 sentence on how to reduce the risk"
  }
]
```
3–5 risks, ordered by severity (most severe first).

### 1.8 `next_steps`
```jsonc
[
  {
    "action":    "string — imperative verb phrase, e.g. 'Register a food business with Brisbane City Council'",
    "timeframe": "string — e.g. 'Week 1', 'Month 1–2', 'Before first sale'",
    "rationale": "string — 1 sentence on why this step is sequenced here"
  }
]
```
3–5 steps, ordered by priority (do-first first).

### 1.9 Partial failure marker
When a pipeline step fails after all retries, the section is written as:
```jsonc
{ "status": "unavailable", "reason": "string — terse description for the UI" }
```
The report still completes with `status = 'complete'`. The viewer renders an "unavailable" card for that section. The report is never left in a permanently broken state.

---

## 2. Pipeline Status Flow

```
queued → running → complete
                 ↘ failed   (only if the assembly step itself fails)
```

Individual section failures write the partial-failure marker (§1.9) and do NOT set the report to `failed`. Only a catastrophic error in the final assembly step sets `status = 'failed'`.

---

## 3. Preview vs Paid Split

### `preview_sections` (free — shown without payment)
| Section | What's included |
|---------|----------------|
| `summary` | Full text |
| `viability_snapshot` | Full scores + verdict |
| `competitors` | First 2 competitors only (name, url, location, pricing_summary) — `positioning_angle` and `gap_notes` locked |
| `next_steps` | First 2 steps only |

### `sections` (full — unlocked on payment)
All sections in full: complete competitor list with gap notes, `cost_breakdown`, `pricing_recommendation`, `legal_compliance`, `risks`, all `next_steps`.

The preview must demonstrate genuine value — a user should understand whether the idea is viable and see real competitors — but the actionable detail (cost numbers, pricing model, compliance checklist, risk mitigations) is behind the paywall.

---

## 4. Pipeline Steps (Inngest)

The Inngest function runs these steps in order. Each step is independently retryable (idempotent — re-running a step overwrites its section with the same or better result).

| Step | Name | What it produces | Max tokens | Web searches |
|------|------|-----------------|------------|--------------|
| 1 | `research-competitors` | `sections.competitors` | 2048 | 3 |
| 2 | `estimate-costs` | `sections.cost_breakdown` | 1024 | 0 |
| 3 | `compliance-check` | `sections.legal_compliance` | 1024 | 2 |
| 4 | `synthesise` | `summary`, `viability_snapshot`, `pricing_recommendation`, `risks`, `next_steps` | 2048 | 0 |
| 5 | `assemble` | writes `preview_sections`, sets `status = 'complete'` | — | — |

**Total cost budget per report:** ≤5 web search calls, ≤8192 tokens across all steps. All steps use `claude-sonnet-4-6`.

After each step, the report row is updated with the partial `sections` result so the progress screen can show real-time status.

---

## 5. Step Progress Signals

The `reports` row carries step progress via the `sections` field during generation. The progress screen reads partial `sections` to determine which steps are done:

| What's present in `sections` | Progress label shown to user |
|-------------------------------|------------------------------|
| row exists, `status = 'running'`, no sections yet | "Starting research…" |
| `competitors` key present | "Researching competitors…" |
| `cost_breakdown` key present | "Crunching your numbers…" |
| `legal_compliance` key present | "Checking compliance…" |
| `summary` key present | "Writing your report…" |
| `status = 'complete'` | redirect to report viewer |
| `status = 'failed'` | error state with retry button |

---

## 6. Standard Disclaimer Block

The following text is appended verbatim to the `legal_compliance` section in the UI (not stored in the DB — rendered client-side):

> **Not legal advice.** The compliance items above are provided for informational purposes only and do not constitute legal advice. Requirements vary by location, business structure, and specific circumstances. Consult a qualified lawyer, accountant, or relevant government body before acting on any item listed here. Links to official sources were correct at the time of report generation but may change.

---

## 7. Section Quality Bar

| Section | "Good" looks like |
|---------|-------------------|
| `summary` | Reads like a smart friend who read your answers — not generic filler. Mentions the specific archetype, location, and one concrete market signal. |
| `viability_snapshot` | Scores are calibrated against each other (not all 3s). Rationale sentences are specific, not "this could be challenging." |
| `competitors` | Real businesses a user could actually visit/click. At least one is clearly local/national. Pricing numbers are specific. Gap notes point to genuine whitespace, not wishful thinking. |
| `cost_breakdown` | Deterministic fields (power, labour) show the formula inputs, not just a number. Estimates are labelled as estimates. Margin is calculated correctly from COGS and suggested price. |
| `pricing_recommendation` | References actual competitor prices from §1.3. Suggests a range, not a single number. Explains the positioning rationale (premium vs volume). |
| `legal_compliance` | Every link opens a real government page. Items are specific to archetype + jurisdiction, not generic "check local laws." |
| `risks` | Risks are specific to this idea, not boilerplate startup risks. Mitigations are actionable, not "do more research." |
| `next_steps` | Ordered — things that block other things come first. Timeframes are honest (week 1 should be achievable in week 1). |

---

## 8. Worked Example: Pet Treats (Brisbane, AU)

**Idea:** Homemade dog treats sold at local markets and online. Physical product archetype.

**Wizard inputs (representative):**
- `idea.sales_channel` → "Farmers markets + online (own website)"
- `market.target_customer` → "Dog owners in Brisbane suburbs who want natural, preservative-free treats"
- `cost.materials` → "$15 per batch"
- `cost.packaging_per_unit` → "$0.80"
- `cost.equipment_wattage` → "1800" (oven)
- `cost.active_minutes_per_batch` → "30"
- `cost.passive_minutes_per_batch` → "25"
- `cost.batch_yield` → "20"
- `cost.hourly_rate` → "$30"
- `market.geographic_scope` → "One city"

**Expected `cost_breakdown`:**
```jsonc
{
  "per_unit": {
    "materials":      0.75,   // $15 / 20
    "packaging":      0.80,
    "power":          0.06,   // (1800/1000) × (25/60) × $0.30/kWh / 20 ≈ $0.056
    "active_labour":  0.75,   // (30/60) × $30 / 20
    "passive_labour": 0.63,   // (25/60) × $30 / 20
    "total_cogs":     2.99
  },
  "suggested_price":  11.00,
  "gross_margin_pct": 73,
  "currency": "AUD",
  "notes": "Power cost uses $0.30/kWh (SE Queensland average). Active and passive labour shown separately — passive time is oven-on time where other tasks are possible.",
  "estimation_flags": { "materials": "user_provided", "packaging": "user_provided", "power": "user_provided", "active_labour": "user_provided", "passive_labour": "user_provided" }
}
```

**Expected `competitors` (sample):**
```jsonc
[
  { "name": "Paw Natural", "url": "https://pawnaturaltreats.com.au", "location": "Brisbane, QLD", "pricing_summary": "$9–13 per 150g bag", "positioning_angle": "Vet-endorsed, grain-free range", "gap_notes": "No market-stall presence; premium price point may exclude budget shoppers" },
  { "name": "The Barkery", "url": "https://thebarkery.com.au", "location": "Online, Australia-wide", "pricing_summary": "$12–18 per bag", "positioning_angle": "Gourmet gifting focus, premium packaging", "gap_notes": "No local/fresh angle; ships nationally — local freshness is a differentiator" }
]
```

**Expected `legal_compliance` (sample):**
```jsonc
[
  { "item": "Home-based food business registration", "jurisdiction": "Queensland, Australia", "severity": "required", "official_source_url": "https://www.qld.gov.au/law/food-safety", "summary": "Businesses producing food for sale in QLD must register with their local council under the Food Act 2006 and comply with Food Safety Standards." },
  { "item": "Pet food labelling — AAFCO / PFIAA standards", "jurisdiction": "Australia (Federal)", "severity": "recommended", "official_source_url": "https://www.agriculture.gov.au/agriculture-land/farm-food-drought/food/labelling/pet-food", "summary": "Pet food sold commercially should comply with the Model Code of Practice for the Production and Sale of Pet Meat and Australian Standard AS 5812." }
]
```
