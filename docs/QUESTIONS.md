# QUESTIONS — Guided Follow-up System

> Status: Committed for Phase 3 and Phase 4. This document is the contract between the wizard (Phase 3) and the report pipeline (Phase 4). The static banks below are the source of truth for what `lib/questions/*.json` must contain; the `maps_to` namespace is the source of truth for what the report pipeline is allowed to read. Changing either requires a matching code change on the other side.

---

## 1. System overview

After a signed-in user has submitted a raw idea (Phase 2) and confirmed its archetype on the confirmation screen (or overridden it), they are routed into `/app/ideas/[id]/questions` — a one-question-per-screen wizard that captures the information the report pipeline needs. The wizard is hybrid: a **static base bank** per archetype plus **up to three dynamic follow-ups** written by Claude from the idea text.

**Why hybrid, and not "all dynamic" or "all static".**

- **All dynamic** would feel magical but would be unpredictable — the report pipeline (Phase 4) needs a *stable input contract* to do deterministic cost math and to build competitor/compliance prompts. If every question is generated fresh, the pipeline cannot rely on any specific field existing, and the cost engine falls apart.
- **All static** is predictable but boring. It also fails the pitch: an idea like "homemade pet treats for dogs with anxiety" deserves a targeted follow-up about calming ingredients that no generic bank can anticipate. Without a dynamic layer the product feels like a form.
- **Hybrid** gives the report pipeline the stable inputs it needs (via the static bank + the `maps_to` contract) *and* gives the user the "the AI actually read my idea" feeling (via dynamic follow-ups). Failure of the dynamic step degrades cleanly to a working flow — the static bank is a complete report input on its own.

**Question count targets.**

| Layer | Count | Why this bound |
|---|---|---|
| Static bank per archetype | 5–9 questions | Under 5 and we're leaving pipeline gaps. Over 9 and the wizard becomes a form and users bail. `physical_product` and `ecommerce_brand` sit at the top of the range because they feed the cost engine. `other` is the exception at 3. |
| Dynamic follow-ups | 0–3 questions | Hard-capped at 3. Zero is a valid outcome. |
| Total per idea | 5–12 questions | Required subset must be answerable in ≤5 minutes on mobile. |

**Time budget.** The wizard is one screen per question and every input is either a single tap (`select`), a short number (`number`), or a 1–3 sentence text field (`text`, `multiselect`). Required questions across all archetypes fit inside 5 minutes on a 390px screen; optional questions may push a diligent user to ~7 minutes.

**Persistence and resume.** Every answer is upserted into `public.answers` on `(idea_id, question_key)` (see `docs/DATA_MODEL.md` §2.3). Closing the tab and returning re-enters the wizard at the first unanswered required question. The wizard never re-asks a question the user already answered.

**No re-asking intake fields.** The intake form (Phase 2) has already captured `ideas.raw_text`, `ideas.location_country`, and `ideas.location_region`. Questions in this document MUST NOT re-ask any of them. If a pipeline field needs geography, it reads from the `ideas` row, not from `answers`.

---

## 2. Question schema

Every question object — whether static or dynamic — conforms to the same shape. This is what `lib/questions/<archetype>.json` files contain, and what the dynamic-follow-up prompt must emit.

```json
{
  "key": "product_home_based",
  "text": "Where will you make and sell from?",
  "subtext": "This changes what permits you'll need and how your cost picture looks.",
  "input_type": "select",
  "options": ["Home kitchen only", "Rented commercial space", "Market stall / pop-up", "Online only (fulfilled from home)"],
  "required": true,
  "maps_to": "cost.production_location"
}
```

### 2.1 Field definitions

| Field | Type | Required | Constraints | Purpose |
|---|---|---|---|---|
| `key` | `string` | yes | snake_case, `^[a-z][a-z0-9_]{0,79}$`, unique across the entire bank for that archetype (static + dynamic combined) | Stable machine identifier. Stored verbatim in `answers.question_key`. Never rename after ship — that would orphan every existing answer. |
| `text` | `string` | yes | 6–140 chars; ends with `?` for questions | The human-visible question. Snapshotted into `answers.question_text` at answer-time so later copy edits don't retroactively change historical context. |
| `subtext` | `string` \| `null` | no | 0–200 chars | Optional clarifying line rendered under `text`. Use for "why we're asking" or a one-line example. Omit for self-evident questions. |
| `input_type` | `enum` | yes | one of `text`, `select`, `number`, `multiselect` | Drives which input component the wizard renders and how the pipeline parses the answer. |
| `options` | `string[]` | conditional | Required if `input_type ∈ {select, multiselect}`. Forbidden otherwise. Each option 1–60 chars, unique within the array, min 2 options, max 8 options. | The visible option labels. The label itself is also the persisted value (there is no separate value/label split — keep it simple). |
| `required` | `boolean` | yes | — | Required questions block completion. Optional questions can be skipped and the pipeline treats them as absent. |
| `maps_to` | `string` | yes | Must be a key from §3. Dotted namespace (`section.field`). One question maps to exactly one pipeline field. Two questions in the same bank MAY NOT share a `maps_to`. | The contract with the Phase 4 report pipeline. Answers are grouped by `maps_to` when handed to the pipeline. |

### 2.2 Input-type semantics

| `input_type` | Widget | Persisted `answers.answer_text` shape | Notes |
|---|---|---|---|
| `text` | Single-line or short textarea (≤3 rows) | Raw string, trimmed. | Free-text. The pipeline parses with Claude if it needs structure (e.g., materials list). |
| `select` | Radio group (≤4 options) or dropdown (5–8 options) | The chosen option string, verbatim. | Never mix radios and "other" — if you need free-entry, add a follow-up text question keyed off the select. |
| `number` | Numeric input with optional unit suffix in `subtext` | The number rendered as a decimal string (`"1800"`, `"0.32"`). Pipeline parses with `parseFloat`. | Non-negative unless stated. No commas. |
| `multiselect` | Checkbox group | JSON-encoded array of chosen option strings (`'["Oven","Dehydrator"]'`). Empty selection persisted as `'[]'` if required, or nothing if optional. | Order in the persisted array matches on-screen order, not click order — makes eval diffs stable. |

### 2.3 Uniqueness and ordering rules

- Within one archetype's bank, every `key` is unique.
- Within one archetype's bank, every `maps_to` is unique. Two questions cannot both write `cost.batch_yield`.
- Static questions are presented in the array order defined below. Dynamic questions (if any) always come *after* all static questions.
- Required questions are presented before optional questions of the same archetype so a user in a hurry can stop after the required set and still hand off a valid input to the pipeline.

### 2.4 Global validation invariants (enforced by wizard code and by unit tests)

- No question re-asks `raw_text`, `location_country`, or `location_region`.
- Every `maps_to` value referenced by a bank exists in §3.
- Every required question has an answer before the wizard exits to the "generate report" screen.
- Dynamic questions never introduce a `maps_to` outside §3.

---

## 3. `maps_to` namespace

This is the flat contract the Phase 4 report pipeline reads from. Keys are grouped by dotted prefix for human readability but the namespace is flat — the pipeline receives a `Record<string, string>` keyed by `maps_to` and looks up specific fields by their full dotted name.

**Consumers column key:** `cost` = cost & profit engine (§4.5 of Phase 4), `comp` = competitor research (§4.4), `legal` = compliance (§4.6), `price` = pricing recommendation (§4.5), `synth` = viability/risks/next steps synthesis (§4.2c).

### 3.1 `idea.*` — cross-archetype business framing

| Key | Type | Consumers | Description |
|---|---|---|---|
| `idea.sales_channel` | `select` | comp, price, synth | Where the offering reaches customers. Values like "Weekend markets", "Own Shopify store", "Wholesale to retailers", "App store", "Direct outreach". |
| `idea.stage` | `select` | synth | How far along the operator is. Values: "Just an idea", "Prototype / test batch", "First customers", "Established, thinking of scaling". |
| `idea.time_commitment` | `select` | synth, price | Hours-per-week the operator will put in. "Evenings/weekends", "Part-time (~20 hrs)", "Full-time". Affects labour-hour assumptions and realistic revenue targets. |

### 3.2 `market.*` — customer and positioning

| Key | Type | Consumers | Description |
|---|---|---|---|
| `market.target_customer` | `text` | comp, synth | Short description of the specific customer segment. Example: "Dog owners with anxious pets, aged 30–50, in inner Brisbane." |
| `market.differentiator` | `text` | comp, synth, price | What makes this offer different from what already exists. Free text. |
| `market.service_area_scope` | `select` | comp, legal, synth | Only for `local_service`. "Single suburb", "City-wide", "Metro + surrounds", "Regional". Feeds competitor search radius and permit jurisdiction. |
| `market.geographic_scope` | `select` | comp, synth | For `ecommerce_brand`, `content_education`, `software_app`, `marketplace`. "Local city", "National", "English-speaking countries", "Global". |

### 3.3 `cost.*` — inputs to the deterministic cost engine

Almost all keys in this group are only populated for `physical_product` and `ecommerce_brand`. The cost engine skips this section for archetypes that don't provide it.

| Key | Type | Consumers | Description |
|---|---|---|---|
| `cost.production_location` | `select` | cost, legal, synth | "Home kitchen only", "Rented commercial space", "Market stall / pop-up", "Online only (fulfilled from home)", "Third-party manufacturer", "3PL warehouse". Also drives permit lookup in compliance. |
| `cost.materials` | `text` | cost | Free-text list of ingredients / raw materials with rough quantities. Parsed by the cost engine's LLM assist (Phase 4.5) into structured `{name, quantity_per_batch, unit}`. Example: "500g oat flour, 2 eggs, 400g pumpkin, 200g peanut butter." |
| `cost.equipment_owned` | `multiselect` | cost, synth | Archetype-specific list of equipment the operator already has (oven, dehydrator, packaging sealer, DSLR, etc.). Used to zero out equipment costs the operator doesn't need to buy. |
| `cost.equipment_wattage` | `number` | cost | Total wattage of the primary heat/power equipment used per batch. Fed into `watts/1000 × hours × local $/kWh`. Unit: watts. |
| `cost.active_minutes_per_batch` | `number` | cost, price | Minutes of hands-on labour per batch. Billed at `cost.hourly_rate`. Unit: minutes. |
| `cost.passive_minutes_per_batch` | `number` | cost | Minutes the equipment runs unattended per batch (oven on, dehydrator running). Tracked separately — used for power cost but NOT billed as labour. Unit: minutes. |
| `cost.batch_yield` | `number` | cost, price | How many finished units come out of one batch. Unit: units. |
| `cost.hourly_rate` | `number` | cost, price | Operator's target hourly rate for their own time. Currency: user's local (implied by `ideas.location_country`). |
| `cost.packaging_per_unit` | `number` | cost | Packaging cost per finished unit sold. Currency: local. |
| `cost.startup_capital` | `number` | cost, synth | Upfront money available, in the founder's local currency. Was a `select` band ("Under $500", "$500–$2,000", "$2,000–$10,000", "$10,000+") until 2026-07-11 — stored band answers persist, so consumers must parse both (`parseCapitalRange` in src/lib/derived-metrics.ts does). Feeds a realism check on suggested equipment / stock levels and the report's budget-fit verdict. |
| `cost.fulfilment_model` | `select` | cost, legal, synth | Only for `ecommerce_brand`. "Print-on-demand", "Dropship", "Own inventory, ship from home", "3PL warehouse", "White-label + own storage". |
| `cost.unit_cost_estimate` | `number` | cost | Optional. For `ecommerce_brand` where the operator already knows their landed unit cost from a supplier. Skips the ingredient-parsing step of the cost engine. |

### 3.4 `price.*` — pricing model inputs

| Key | Type | Consumers | Description |
|---|---|---|---|
| `price.model` | `select` | price, comp, synth | "Per unit", "Per hour", "Per project / job", "Subscription (monthly)", "Freemium + subscription", "Take rate (marketplace)", "Ad revenue", "Sponsorships", "Course / one-time digital", "Coaching package". |
| `price.target_price` | `number` | price, synth | Optional. The price the operator has in mind, if any. Local currency. |
| `price.take_rate_pct` | `number` | price, synth | Only for `marketplace`. Intended commission on each transaction, as a percentage (0–100). |

### 3.5 `monetisation.*` — for archetypes where "price" alone doesn't describe revenue

| Key | Type | Consumers | Description |
|---|---|---|---|
| `monetisation.primary_channel` | `select` | synth, price | Primary revenue channel. "Ads", "Sponsorships", "Paid subscription", "Course sales", "Coaching / consulting", "Affiliate", "Merch", "Licensing". |
| `monetisation.secondary_channel` | `select` | synth | Optional secondary. Same option set. |
| `monetisation.free_tier_shape` | `text` | synth, price | Only for `software_app` and `marketplace` where a free tier exists. Free-text description of what's free vs paid. |

### 3.6 `resource.*` — what the operator already has (non-cost)

| Key | Type | Consumers | Description |
|---|---|---|---|
| `resource.audience_size` | `select` | synth, price | Only for `content_education`. "None yet", "<1k", "1k–10k", "10k–100k", "100k+". Feeds realistic monetisation timeline. |
| `resource.existing_content` | `select` | synth | Only for `content_education`. "Nothing published", "A few pieces", "Regular cadence, small audience", "Regular cadence, growing". |
| `resource.tech_capability` | `select` | synth | Only for `software_app` and `marketplace`. "I code", "I have a co-founder who codes", "No-code tools", "Will hire / outsource". Feeds a realism check on build timeline. |

### 3.7 `ip.*` — intellectual property status (invention only)

| Key | Type | Consumers | Description |
|---|---|---|---|
| `ip.status` | `select` | legal, synth | "No filing yet", "Provisional filed", "Non-provisional / PCT filed", "Granted patent", "Trade secret only". |
| `ip.category` | `select` | legal, synth | "Device / hardware", "Process / method", "Composition / material", "Software algorithm", "Design". Drives which patent office guidance links appear. |
| `ip.target_market` | `text` | comp, synth | Free-text description of who ultimately buys or licenses the invention (end consumers, specific industry, licensees). |

### 3.8 `fallback.*` — `other` archetype only

| Key | Type | Consumers | Description |
|---|---|---|---|
| `fallback.problem` | `text` | synth | What problem does it solve? |
| `fallback.customer` | `text` | synth | Who is the customer? |
| `fallback.money_model` | `text` | synth, price | How would you make money? |

### 3.9 Namespace change discipline

- **Adding a key** is a one-way door. Add it here, then use it. The pipeline may safely ignore keys it doesn't know about.
- **Removing a key** requires searching every static bank plus every pipeline consumer for references. Only remove when both sides are cleared.
- **Renaming a key** is banned. Add a new key, migrate consumers, then delete the old one in a separate change.

---

## 4. Static banks per archetype

Every bank below is the canonical content of `lib/questions/<archetype>.json`. Question order in the array is the presentation order.

### 4.1 `physical_product`

Nine questions. Covers the pitch's pet-treats worked example and every cost-engine input.

```json
[
  {
    "key": "product_home_based",
    "text": "Where will you make and sell from?",
    "subtext": "Changes what permits you'll need and how your cost picture looks.",
    "input_type": "select",
    "options": [
      "Home kitchen / workshop only",
      "Home workshop plus market stall / pop-up",
      "Rented commercial space",
      "Online only (fulfilled from home)"
    ],
    "required": true,
    "maps_to": "cost.production_location"
  },
  {
    "key": "product_specific_focus",
    "text": "Who or what is this product specifically for?",
    "subtext": "e.g., 'dogs with anxiety', 'coffee drinkers who like fruity notes', 'cyclists commuting in the rain'.",
    "input_type": "text",
    "required": true,
    "maps_to": "market.target_customer"
  },
  {
    "key": "product_materials",
    "text": "List your main ingredients or materials with rough quantities per batch.",
    "subtext": "Free text is fine — e.g., '500g oat flour, 2 eggs, 400g pumpkin, 200g peanut butter'.",
    "input_type": "text",
    "required": true,
    "maps_to": "cost.materials"
  },
  {
    "key": "product_equipment_owned",
    "text": "Which equipment do you already own?",
    "subtext": "Tick everything you have. Anything not ticked, we'll assume you need to buy.",
    "input_type": "multiselect",
    "options": [
      "Domestic oven",
      "Commercial oven",
      "Dehydrator",
      "Stand mixer",
      "Food processor",
      "Vacuum sealer / packaging machine",
      "Label printer",
      "Refrigeration / cold storage"
    ],
    "required": true,
    "maps_to": "cost.equipment_owned"
  },
  {
    "key": "product_equipment_wattage",
    "text": "Total wattage of the main heat/power equipment you'll run per batch?",
    "subtext": "Check the label on your oven or dehydrator. If unsure, a domestic oven is ~1800–2400W.",
    "input_type": "number",
    "required": true,
    "maps_to": "cost.equipment_wattage"
  },
  {
    "key": "product_active_minutes",
    "text": "How many minutes of hands-on work per batch?",
    "subtext": "Only the time you're actually mixing, shaping, packaging — not oven time.",
    "input_type": "number",
    "required": true,
    "maps_to": "cost.active_minutes_per_batch"
  },
  {
    "key": "product_batch_yield",
    "text": "How many finished units come out of one batch?",
    "subtext": "e.g., '40 packs of treats', '24 bottles of sauce'.",
    "input_type": "number",
    "required": true,
    "maps_to": "cost.batch_yield"
  },
  {
    "key": "product_hourly_rate",
    "text": "What's the hourly rate you want to pay yourself for hands-on work?",
    "subtext": "In your local currency. If you're not sure, pick a number you'd accept for a casual job locally.",
    "input_type": "number",
    "required": true,
    "maps_to": "cost.hourly_rate"
  },
  {
    "key": "product_sales_channel",
    "text": "How will you sell it?",
    "input_type": "select",
    "options": [
      "Weekend markets / pop-ups",
      "Wholesale to local shops",
      "Own online store",
      "Marketplace (Etsy / eBay)",
      "Mix of local + online"
    ],
    "required": true,
    "maps_to": "idea.sales_channel"
  }
]
```

### 4.2 `local_service`

Seven questions. Must capture pricing model and service area scope.

```json
[
  {
    "key": "service_offering",
    "text": "In one sentence, what's the specific service you'll deliver?",
    "subtext": "e.g., 'Weekly residential lawn mowing including edging and green-waste removal.'",
    "input_type": "text",
    "required": true,
    "maps_to": "market.differentiator"
  },
  {
    "key": "service_area_scope",
    "text": "How wide is the area you'll serve?",
    "input_type": "select",
    "options": [
      "Single suburb / neighbourhood",
      "City-wide",
      "Metro + surrounds (up to ~50km)",
      "Regional (multiple towns)"
    ],
    "required": true,
    "maps_to": "market.service_area_scope"
  },
  {
    "key": "service_target_customer",
    "text": "Who is your ideal customer?",
    "subtext": "e.g., 'Busy families with front-and-back yards in single-storey homes.'",
    "input_type": "text",
    "required": true,
    "maps_to": "market.target_customer"
  },
  {
    "key": "service_pricing_model",
    "text": "How will you charge?",
    "input_type": "select",
    "options": [
      "Per hour",
      "Per visit / per job (flat)",
      "Per project (quoted)",
      "Monthly subscription / retainer",
      "Package (bundle of visits)"
    ],
    "required": true,
    "maps_to": "price.model"
  },
  {
    "key": "service_target_price",
    "text": "Roughly what price do you have in mind (in your local currency)?",
    "subtext": "Whatever fits the model above — hourly rate, per-job fee, monthly retainer. Leave blank if unsure.",
    "input_type": "number",
    "required": false,
    "maps_to": "price.target_price"
  },
  {
    "key": "service_time_commitment",
    "text": "How much time will you put into this each week?",
    "input_type": "select",
    "options": ["Evenings/weekends only", "Part-time (~20 hrs)", "Full-time"],
    "required": true,
    "maps_to": "idea.time_commitment"
  },
  {
    "key": "service_startup_capital",
    "text": "Roughly how much money do you have to start?",
    "subtext": "For a vehicle, tools, insurance, marketing.",
    "input_type": "select",
    "options": ["Under $500", "$500–$2,000", "$2,000–$10,000", "$10,000+"],
    "required": true,
    "maps_to": "cost.startup_capital"
  }
]
```

### 4.3 `software_app`

Seven questions. Must capture monetisation model.

```json
[
  {
    "key": "app_specific_user",
    "text": "Who is the specific user this app is for?",
    "subtext": "e.g., 'Freelance designers who juggle 3–10 clients at once.'",
    "input_type": "text",
    "required": true,
    "maps_to": "market.target_customer"
  },
  {
    "key": "app_differentiator",
    "text": "What does your app do that existing tools don't?",
    "input_type": "text",
    "required": true,
    "maps_to": "market.differentiator"
  },
  {
    "key": "app_monetisation_model",
    "text": "How will users pay?",
    "input_type": "select",
    "options": [
      "Monthly subscription",
      "Annual subscription",
      "One-time license",
      "Freemium + paid tier",
      "Free with ads",
      "Per-seat (team plans)",
      "Usage-based / metered"
    ],
    "required": true,
    "maps_to": "price.model"
  },
  {
    "key": "app_free_tier_shape",
    "text": "If you have a free tier, what's included vs paid?",
    "subtext": "Skip if you're not doing free.",
    "input_type": "text",
    "required": false,
    "maps_to": "monetisation.free_tier_shape"
  },
  {
    "key": "app_target_price",
    "text": "Roughly what price do you have in mind (per user, per month, in your local currency)?",
    "input_type": "number",
    "required": false,
    "maps_to": "price.target_price"
  },
  {
    "key": "app_tech_capability",
    "text": "Who's building it?",
    "input_type": "select",
    "options": [
      "I code it myself",
      "I have a technical co-founder",
      "No-code tools",
      "I'll hire / outsource development"
    ],
    "required": true,
    "maps_to": "resource.tech_capability"
  },
  {
    "key": "app_geographic_scope",
    "text": "Where are your users?",
    "input_type": "select",
    "options": [
      "My local city",
      "My country",
      "English-speaking countries",
      "Global"
    ],
    "required": true,
    "maps_to": "market.geographic_scope"
  }
]
```

### 4.4 `ecommerce_brand`

Nine questions. Cost inputs are captured thoroughly because this archetype feeds the cost breakdown.

```json
[
  {
    "key": "ecom_target_customer",
    "text": "Who is your ideal customer?",
    "subtext": "e.g., 'People buying gifts for iPhone-owning teens, in the US and UK.'",
    "input_type": "text",
    "required": true,
    "maps_to": "market.target_customer"
  },
  {
    "key": "ecom_differentiator",
    "text": "What makes your product different from what's already for sale online?",
    "input_type": "text",
    "required": true,
    "maps_to": "market.differentiator"
  },
  {
    "key": "ecom_fulfilment_model",
    "text": "How do orders get made and shipped?",
    "input_type": "select",
    "options": [
      "Print-on-demand",
      "Dropship from supplier",
      "Own inventory, ship from home",
      "3PL warehouse",
      "White-label supplier + own storage"
    ],
    "required": true,
    "maps_to": "cost.fulfilment_model"
  },
  {
    "key": "ecom_sales_channel",
    "text": "Where will you sell?",
    "input_type": "select",
    "options": [
      "Own Shopify store",
      "Etsy / marketplace only",
      "Amazon FBA",
      "Multiple channels (own site + marketplace)"
    ],
    "required": true,
    "maps_to": "idea.sales_channel"
  },
  {
    "key": "ecom_unit_cost_estimate",
    "text": "What's your landed cost per unit from the supplier?",
    "subtext": "Include product + supplier shipping to you. Local currency. If you don't know yet, leave blank.",
    "input_type": "number",
    "required": false,
    "maps_to": "cost.unit_cost_estimate"
  },
  {
    "key": "ecom_packaging_per_unit",
    "text": "How much does packaging cost per unit shipped?",
    "subtext": "Box or mailer + inserts + tape. Rough is fine. Leave blank for print-on-demand.",
    "input_type": "number",
    "required": false,
    "maps_to": "cost.packaging_per_unit"
  },
  {
    "key": "ecom_target_price",
    "text": "What retail price do you have in mind (per unit, local currency)?",
    "input_type": "number",
    "required": false,
    "maps_to": "price.target_price"
  },
  {
    "key": "ecom_geographic_scope",
    "text": "Where will you ship?",
    "input_type": "select",
    "options": [
      "My country only",
      "My country + neighbouring countries",
      "English-speaking countries",
      "Global (wherever the fulfilment supports)"
    ],
    "required": true,
    "maps_to": "market.geographic_scope"
  },
  {
    "key": "ecom_startup_capital",
    "text": "Roughly how much money do you have to start?",
    "subtext": "For initial inventory, store setup, first ads.",
    "input_type": "select",
    "options": ["Under $500", "$500–$2,000", "$2,000–$10,000", "$10,000+"],
    "required": true,
    "maps_to": "cost.startup_capital"
  }
]
```

### 4.5 `content_education`

Seven questions. Must capture channel and monetisation.

```json
[
  {
    "key": "content_specific_topic",
    "text": "In one sentence, what's your content about and who is it for?",
    "subtext": "e.g., '15-minute weeknight dinners for parents of picky eaters.'",
    "input_type": "text",
    "required": true,
    "maps_to": "market.target_customer"
  },
  {
    "key": "content_primary_channel",
    "text": "Which channel is primary?",
    "input_type": "select",
    "options": [
      "YouTube",
      "TikTok / short-form video",
      "Podcast",
      "Newsletter / blog",
      "Online course platform",
      "Paid community",
      "Coaching / consulting"
    ],
    "required": true,
    "maps_to": "idea.sales_channel"
  },
  {
    "key": "content_primary_monetisation",
    "text": "What's your primary way of making money from it?",
    "input_type": "select",
    "options": [
      "Ads",
      "Sponsorships",
      "Paid subscription",
      "Course sales",
      "Coaching / consulting",
      "Affiliate",
      "Merch"
    ],
    "required": true,
    "maps_to": "monetisation.primary_channel"
  },
  {
    "key": "content_secondary_monetisation",
    "text": "Any secondary revenue you're planning?",
    "input_type": "select",
    "options": [
      "None",
      "Ads",
      "Sponsorships",
      "Paid subscription",
      "Course sales",
      "Coaching / consulting",
      "Affiliate",
      "Merch"
    ],
    "required": false,
    "maps_to": "monetisation.secondary_channel"
  },
  {
    "key": "content_existing_content",
    "text": "How much have you published already?",
    "input_type": "select",
    "options": [
      "Nothing published",
      "A few pieces",
      "Regular cadence, small audience",
      "Regular cadence, growing"
    ],
    "required": true,
    "maps_to": "resource.existing_content"
  },
  {
    "key": "content_audience_size",
    "text": "How big is your current audience?",
    "subtext": "Total across your primary channel.",
    "input_type": "select",
    "options": ["None yet", "Under 1k", "1k–10k", "10k–100k", "100k+"],
    "required": true,
    "maps_to": "resource.audience_size"
  },
  {
    "key": "content_time_commitment",
    "text": "How much time will you put into this each week?",
    "input_type": "select",
    "options": ["Evenings/weekends only", "Part-time (~20 hrs)", "Full-time"],
    "required": true,
    "maps_to": "idea.time_commitment"
  }
]
```

### 4.6 `marketplace`

Seven questions. Must capture monetisation model.

```json
[
  {
    "key": "market_side_a",
    "text": "Who's on the supply side of your marketplace?",
    "subtext": "e.g., 'Independent dog walkers who want extra weekend income.'",
    "input_type": "text",
    "required": true,
    "maps_to": "market.target_customer"
  },
  {
    "key": "market_side_b",
    "text": "Who's on the demand side?",
    "subtext": "e.g., 'Dog owners in Chicago who work long hours and need a mid-day walk.'",
    "input_type": "text",
    "required": true,
    "maps_to": "market.differentiator"
  },
  {
    "key": "market_monetisation_model",
    "text": "How do you make money on each transaction?",
    "input_type": "select",
    "options": [
      "Take rate (commission on each transaction)",
      "Subscription (from one or both sides)",
      "Listing fee",
      "Featured / promoted listings",
      "Payment processing fee"
    ],
    "required": true,
    "maps_to": "price.model"
  },
  {
    "key": "market_take_rate",
    "text": "If commission-based, what percentage per transaction?",
    "subtext": "Number between 0 and 100. Skip if you're not using commissions.",
    "input_type": "number",
    "required": false,
    "maps_to": "price.take_rate_pct"
  },
  {
    "key": "market_free_tier_shape",
    "text": "Is there a free side or free tier? What's included?",
    "subtext": "Marketplaces often make one side free to solve the chicken-and-egg problem.",
    "input_type": "text",
    "required": false,
    "maps_to": "monetisation.free_tier_shape"
  },
  {
    "key": "market_geographic_scope",
    "text": "Where does the marketplace operate?",
    "input_type": "select",
    "options": [
      "One city",
      "One country",
      "English-speaking countries",
      "Global"
    ],
    "required": true,
    "maps_to": "market.geographic_scope"
  },
  {
    "key": "market_tech_capability",
    "text": "Who's building the platform?",
    "input_type": "select",
    "options": [
      "I code it myself",
      "I have a technical co-founder",
      "No-code tools",
      "I'll hire / outsource development"
    ],
    "required": true,
    "maps_to": "resource.tech_capability"
  }
]
```

### 4.7 `invention`

Six questions. Must capture IP status and target market.

```json
[
  {
    "key": "invention_category",
    "text": "What kind of invention is it?",
    "input_type": "select",
    "options": [
      "Device / hardware",
      "Process / method",
      "Composition / material",
      "Software algorithm",
      "Design"
    ],
    "required": true,
    "maps_to": "ip.category"
  },
  {
    "key": "invention_ip_status",
    "text": "What's the current IP status?",
    "input_type": "select",
    "options": [
      "No filing yet",
      "Provisional patent filed",
      "Non-provisional / PCT filed",
      "Granted patent",
      "Trade secret only (no filing intended)"
    ],
    "required": true,
    "maps_to": "ip.status"
  },
  {
    "key": "invention_target_market",
    "text": "Who ultimately uses or buys this? Any industries you're targeting?",
    "subtext": "e.g., 'Residential electricians retrofitting older homes.' or 'Consumer pet owners.'",
    "input_type": "text",
    "required": true,
    "maps_to": "ip.target_market"
  },
  {
    "key": "invention_differentiator",
    "text": "What's the novel claim — what does yours do that existing solutions can't?",
    "input_type": "text",
    "required": true,
    "maps_to": "market.differentiator"
  },
  {
    "key": "invention_stage",
    "text": "How far along is it?",
    "input_type": "select",
    "options": [
      "Just an idea",
      "Working prototype",
      "Small production run tested",
      "Ready for scale / licensing"
    ],
    "required": true,
    "maps_to": "idea.stage"
  },
  {
    "key": "invention_startup_capital",
    "text": "Roughly how much money do you have available for this?",
    "subtext": "For prototyping, filings, initial manufacturing.",
    "input_type": "select",
    "options": ["Under $500", "$500–$2,000", "$2,000–$10,000", "$10,000+"],
    "required": true,
    "maps_to": "cost.startup_capital"
  }
]
```

### 4.8 `other`

Minimal three-question bank. This archetype is a fallback (see `docs/ARCHETYPES.md` §1.8); we ask only what's needed for the synthesis section to say something useful.

```json
[
  {
    "key": "other_problem",
    "text": "What problem does this solve?",
    "input_type": "text",
    "required": true,
    "maps_to": "fallback.problem"
  },
  {
    "key": "other_customer",
    "text": "Who is the customer?",
    "input_type": "text",
    "required": true,
    "maps_to": "fallback.customer"
  },
  {
    "key": "other_money_model",
    "text": "How would you make money from it?",
    "input_type": "text",
    "required": true,
    "maps_to": "fallback.money_model"
  }
]
```

---

## 5. Dynamic follow-up prompt spec

After all *required* static questions have been answered, the wizard calls the dynamic follow-up generator. Up to three additional questions may be appended to the wizard sequence before the summary screen.

### 5.1 Inputs to the prompt

The generator is called with a JSON payload constructed server-side:

```json
{
  "idea_raw_text": "…",
  "archetype": "physical_product",
  "location_country": "AU",
  "location_region": "Brisbane",
  "restatement": "…",
  "static_answers": [
    { "key": "product_home_based", "maps_to": "cost.production_location", "answer": "Home kitchen / workshop only" },
    { "key": "product_specific_focus", "maps_to": "market.target_customer", "answer": "Dogs with anxiety" }
    // …one entry per already-answered question in wizard order
  ],
  "used_keys": ["product_home_based", "product_specific_focus", "..."],
  "used_maps_to": ["cost.production_location", "market.target_customer", "..."],
  "allowed_maps_to": ["idea.stage", "market.differentiator", "..." ]
}
```

`used_keys` and `used_maps_to` are handed in explicitly so the prompt cannot collide with a static-bank key or `maps_to`. `allowed_maps_to` is the current §3 namespace minus any entry already used by the static bank.

### 5.2 Prompt contract (outputs)

The model MUST return a JSON array of 0–3 question objects conforming to the §2 schema. No prose, no wrapping keys, no markdown. Schema:

```json
[
  {
    "key": "…",           // snake_case, not in used_keys
    "text": "…",
    "subtext": "…",       // optional
    "input_type": "text | select | number | multiselect",
    "options": ["…"],     // required iff select/multiselect
    "required": false,    // dynamic follow-ups are always optional
    "maps_to": "…"        // must be in allowed_maps_to, not in used_maps_to
  }
]
```

Extra rules baked into the prompt:

- **Never re-ask** anything already answered, or anything already in the static bank for this archetype.
- **Never re-ask intake fields** (`raw_text`, `location_country`, `location_region`).
- **Never invent a `maps_to`** outside `allowed_maps_to`.
- **All dynamic questions are `"required": false`** — the operator has already answered enough to run the pipeline; dynamic follow-ups add polish, not gate-keeping.
- **Prefer `select` over `text`** when the answer space is small and predictable. The report pipeline gets more from a clean enum than a paragraph.
- **Max 3 items** in the array. If in doubt, return fewer — a good two is better than a padded three.
- **Return `[]`** if the static answers already give a rich picture; that is a valid, expected outcome.

### 5.3 Hard cap and validation

Server-side, after the model returns:

1. Parse as JSON. On parse failure → treat as `[]` and continue.
2. Truncate to the first 3 items. Anything beyond is silently dropped.
3. Validate each item against the §2 schema. Drop invalid items; do not throw.
4. Enforce `key ∉ used_keys` and `maps_to ∈ allowed_maps_to` and `maps_to ∉ used_maps_to`. Drop items that fail.
5. If any items survive, append them to the wizard in returned order.

### 5.4 Graceful failure rule

The dynamic follow-up step MUST NOT block or crash the wizard. Any of the following outcomes must degrade to "no dynamic questions this run" and let the user continue to the summary screen:

- Network / API error calling the model.
- Rate limit or timeout (hard timeout of 15s from the wizard's perspective).
- JSON parse failure.
- All returned items fail validation.
- Env flag `DYNAMIC_QUESTIONS_ENABLED=false`.

The failure is logged server-side (for eval/monitoring) but never surfaced to the user. Static bank alone is a complete flow — the acceptance criteria for Phase 3 explicitly say so.

### 5.5 Idempotency

Dynamic questions are generated once per idea, at the moment the user finishes the required static questions. The results are persisted (in memory / server session) for the current wizard session; they are *not* stored as first-class rows anywhere, because if the user leaves and returns, we re-run generation with the (now more complete) static answers and may get different — usually better — questions. Answers to dynamic questions that survive across sessions are those the user actually saved to `answers`. Unanswered dynamic questions from a previous session vanish; that is the correct behaviour.

---

## 6. Worked example — the pet-treats idea

This is the pitch's canonical example, traced through the physical_product bank end-to-end.

**Intake (Phase 2):**

- `ideas.raw_text` = "home made pet treats"
- `ideas.location_country` = "AU"
- `ideas.location_region` = "Brisbane"
- Classifier → `archetype = "physical_product"`, `restatement = "Homemade pet treats sold locally in Brisbane."`

**Static-bank walk (Phase 3):**

| # | Question | Answer (example) | Persisted as `answers` row |
|---|---|---|---|
| 1 | Where will you make and sell from? | Home workshop plus market stall / pop-up | `question_key = "product_home_based"`, `answer_text = "Home workshop plus market stall / pop-up"` |
| 2 | Who or what is this product specifically for? | Dogs with anxiety and older dogs with dental issues | `question_key = "product_specific_focus"`, `answer_text = "Dogs with anxiety and older dogs with dental issues"` |
| 3 | List your main ingredients or materials with rough quantities per batch. | 500g oat flour, 2 eggs, 400g pumpkin puree, 200g peanut butter, 30g chamomile | `question_key = "product_materials"` |
| 4 | Which equipment do you already own? | ["Domestic oven","Dehydrator","Stand mixer","Vacuum sealer / packaging machine"] | `question_key = "product_equipment_owned"`, `answer_text = '["Domestic oven","Dehydrator","Stand mixer","Vacuum sealer / packaging machine"]'` |
| 5 | Total wattage of the main heat/power equipment? | 1800 | `question_key = "product_equipment_wattage"`, `answer_text = "1800"` |
| 6 | How many minutes of hands-on work per batch? | 45 | `question_key = "product_active_minutes"` |
| 7 | How many finished units per batch? | 40 | `question_key = "product_batch_yield"` |
| 8 | Hourly rate for your own hands-on work? | 30 | `question_key = "product_hourly_rate"` |
| 9 | How will you sell it? | Mix of local + online | `question_key = "product_sales_channel"` |

**Dynamic follow-up call.** The generator receives the payload above with the nine `static_answers` filled in. Given the "anxiety" and "dental" specificity, a plausible dynamic response:

```json
[
  {
    "key": "product_passive_minutes",
    "text": "How long does the oven or dehydrator run unattended per batch?",
    "subtext": "We'll use this for the power calculation but not bill it as your time.",
    "input_type": "number",
    "required": false,
    "maps_to": "cost.passive_minutes_per_batch"
  },
  {
    "key": "product_calming_ingredients",
    "text": "Which of these calming ingredients (if any) are you using?",
    "input_type": "multiselect",
    "options": ["Chamomile", "Valerian", "L-theanine", "Hemp / CBD", "None"],
    "required": false,
    "maps_to": "market.differentiator"
  },
  {
    "key": "product_target_price",
    "text": "What retail price per pack do you have in mind (AUD)?",
    "input_type": "number",
    "required": false,
    "maps_to": "price.target_price"
  }
]
```

The user answers 2 and 3, skips 1. The wizard advances to the summary screen. Idea status transitions `questioning → researching` (via §4.1 of `docs/DATA_MODEL.md`) once the user clicks "Generate my report".

**Final `answers` collection handed to Phase 4** — grouped by `maps_to`:

```json
{
  "cost.production_location": "Home workshop plus market stall / pop-up",
  "market.target_customer": "Dogs with anxiety and older dogs with dental issues",
  "cost.materials": "500g oat flour, 2 eggs, 400g pumpkin puree, 200g peanut butter, 30g chamomile",
  "cost.equipment_owned": ["Domestic oven","Dehydrator","Stand mixer","Vacuum sealer / packaging machine"],
  "cost.equipment_wattage": 1800,
  "cost.active_minutes_per_batch": 45,
  "cost.batch_yield": 40,
  "cost.hourly_rate": 30,
  "idea.sales_channel": "Mix of local + online",
  "market.differentiator": ["Chamomile"],
  "price.target_price": 8
}
```

Plus (from `ideas`, not from `answers`): `location_country = "AU"`, `location_region = "Brisbane"`, `raw_text = "home made pet treats"`, `archetype = "physical_product"`.

That is exactly enough for the cost engine to compute per-batch and per-unit cost, for the competitor prompt to search "homemade dog treats Brisbane" layered up to national, for the compliance prompt to look up Queensland food-business rules for pet food at markets, and for the pricing recommendation to compare 8 AUD against the surfaced competitors.

---

## 7. Phase 4 contract — every `maps_to` key and its consumer

This table is the definitive read spec for the Phase 4 pipeline. Every key here corresponds to a field defined in §3. If Phase 4 code reads a key not in this table, it is off-spec.

| `maps_to` key | Type as stored in `answers.answer_text` | Cost engine | Competitor research | Compliance | Pricing recommendation | Synthesis (viability / risks / next steps) |
|---|---|---|---|---|---|---|
| `idea.sales_channel` | string | | ✅ (search phrasing) | ✅ (channel-specific rules, e.g., market permits) | ✅ (channel-fee assumptions) | ✅ |
| `idea.stage` | string | | | | | ✅ |
| `idea.time_commitment` | string | ✅ (throughput realism) | | | ✅ (achievable price × volume) | ✅ |
| `market.target_customer` | string | | ✅ (search seed) | | ✅ (comparable segment) | ✅ |
| `market.differentiator` | string OR JSON-array string | | ✅ (positioning gaps) | | ✅ (premium justification) | ✅ |
| `market.service_area_scope` | string | | ✅ (search radius) | ✅ (jurisdiction) | ✅ (local rate benchmark) | ✅ |
| `market.geographic_scope` | string | | ✅ (search geography) | ✅ (which jurisdictions to check) | | ✅ |
| `cost.production_location` | string | ✅ (rent / overhead assumption) | | ✅ (permits for that setting) | | ✅ |
| `cost.materials` | string | ✅ (parsed to structured list; LLM assist fills unknown prices) | | ✅ (food-safety / label rules if edible) | | |
| `cost.equipment_owned` | JSON-array string | ✅ (zero out already-owned kit) | | | | ✅ |
| `cost.equipment_wattage` | number-as-string | ✅ (power cost: watts/1000 × hours × local kWh price) | | | | |
| `cost.active_minutes_per_batch` | number-as-string | ✅ (labour cost: minutes × hourly_rate) | | | ✅ (implicit labour recovery in price) | |
| `cost.passive_minutes_per_batch` | number-as-string | ✅ (power cost only, NOT billed as labour) | | | | |
| `cost.batch_yield` | number-as-string | ✅ (per-unit cost = per-batch / yield) | | | ✅ (price × yield feasibility) | |
| `cost.hourly_rate` | number-as-string | ✅ (labour rate) | | | ✅ (implied rate recovery) | |
| `cost.packaging_per_unit` | number-as-string | ✅ (added to per-unit cost) | | | | |
| `cost.startup_capital` | string | ✅ (equipment realism check) | | | | ✅ (achievable stock levels) |
| `cost.fulfilment_model` | string | ✅ (ecom-specific cost stack) | | ✅ (importer / drop-ship compliance) | ✅ (marketplace fee stack) | ✅ |
| `cost.unit_cost_estimate` | number-as-string | ✅ (skips materials-parse step for ecom) | | | ✅ (margin math) | |
| `price.model` | string | | ✅ (find competitors on same model) | | ✅ (chosen model shapes recommendation) | ✅ |
| `price.target_price` | number-as-string | | ✅ (position vs competitors) | | ✅ (margin at this price) | ✅ |
| `price.take_rate_pct` | number-as-string | | | | ✅ (marketplace revenue per txn) | ✅ |
| `monetisation.primary_channel` | string | | ✅ (find competitors on same monetisation) | | ✅ (rate benchmarks per channel) | ✅ |
| `monetisation.secondary_channel` | string | | | | ✅ (revenue stack) | ✅ |
| `monetisation.free_tier_shape` | string | | | | ✅ (conversion assumption) | ✅ |
| `resource.audience_size` | string | | | | ✅ (achievable revenue) | ✅ (timeline realism) |
| `resource.existing_content` | string | | | | | ✅ (timeline realism) |
| `resource.tech_capability` | string | | | | | ✅ (build timeline / risk) |
| `ip.status` | string | | | ✅ (patent office guidance links) | | ✅ (defensibility) |
| `ip.category` | string | | | ✅ (which patent office section to link) | | ✅ |
| `ip.target_market` | string | | ✅ (search seed for licensees / competitors) | | | ✅ |
| `fallback.problem` | string | | | | | ✅ |
| `fallback.customer` | string | | | | | ✅ |
| `fallback.money_model` | string | | | | ✅ (best-effort) | ✅ |

**How Phase 4 receives this.** After the wizard exits, the report-creation endpoint reads all `answers` rows for the idea and produces `Record<string, string>` keyed by `question.maps_to` (looked up from the static bank + dynamic session cache). That record, plus the parent `ideas` row (for `location_country`, `location_region`, `raw_text`, `archetype`, `restatement`), is the complete input to the pipeline. No other tables are read.

**Missing keys.** If a `maps_to` is absent from the record (optional question skipped, or archetype doesn't include it), the pipeline treats it as `undefined` and takes its documented fallback path — usually "estimate with LLM and mark as estimated" for cost inputs, or "omit that dimension" for synthesis inputs. Never a crash; never a required-field error at the pipeline layer.

---

*End of QUESTIONS.md — this document plus `lib/questions/<archetype>.json` and the dynamic-follow-up prompt in `lib/prompts/` are the Phase 3 → Phase 4 contract. Changing the `maps_to` namespace requires changing every consumer in Phase 4 in the same PR.*
