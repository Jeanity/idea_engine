# Phase 04 — Research & Report Pipeline

## Goal ("done" looks like)
Clicking "Generate my report" kicks off an async job that (1) researches real competitors via Claude's web search tool, (2) estimates costs/pricing/margins from the wizard answers, (3) flags legal/compliance items with links to official sources, and (4) assembles a structured report. The user watches progress, then views the report with **preview sections open and full sections visually locked** (paywall wiring comes in Phase 5). This phase is the product.

## Dependencies
Phase 3 complete (answered ideas with `maps_to` contract in `docs/QUESTIONS.md`).

## Tasks (in order)

### 4.1 Report schema + pipeline architecture
**Model: Opus** — the central architecture decision of the whole build.
Define: report section schema (JSONB: `summary`, `viability_snapshot`, `competitors[]` with name/url/location/pricing/angle/gap-notes, `cost_breakdown`, `pricing_recommendation`, `legal_compliance[]` with official links, `risks`, `next_steps`), which sections are free-preview (`summary`, `viability_snapshot`, 2 competitors) vs paid, and the pipeline shape: Inngest function with one step per section, each step retryable, partial failure = report completes with a "section unavailable" marker (never a dead report). Output: `docs/REPORT_SPEC.md`.

### 4.2 Research prompt suite
**Model: Opus** — prompt design; quality here is the paid product's quality.
Three prompts in `lib/prompts/`: (a) **competitor research** using the Anthropic web search tool — layered local → national → global per the pitch, strict JSON out, must return real URLs only; (b) **legal/compliance flagging** — surface likely permits/rules for archetype + location with links to official (gov) sources, wrapped in mandatory not-legal-advice framing; (c) **synthesis** — viability snapshot, risks, next steps from all gathered material. Each prompt documented with 1 worked example.

### 4.3 Inngest job runner setup
**Model: Sonnet** — integration work.
Add Inngest (free tier, works natively on Vercel, gives retries + step durability — the reason we're not hand-rolling a queue). `POST /api/reports` creates `reports` row (`queued`) and fires the event; Inngest function updates status per step.

### 4.4 Competitor research step
**Model: Sonnet** — implementation of prompt (a) with validation.
Execute web-search prompt, validate JSON, verify each URL is well-formed, store into report sections. Cap search calls per report (cost control, config in `lib/ai.ts`).

### 4.5 Cost & profit engine
**Model: Sonnet** — mostly deterministic math + one LLM assist.
For product archetypes: deterministic calculator from wizard inputs — materials, packaging, power (`watts/1000 × hours × local $/kWh`), active-labour (minutes × hourly rate; passive machine time tracked separately, per the pitch), per-unit cost, suggested price, margin. LLM fills only gaps the user skipped (e.g., typical ingredient prices), clearly marked as estimates. For service/software archetypes: simpler startup-cost + pricing-benchmark estimate via prompt (c).

### 4.6 Compliance step
**Model: Sonnet** — implementation of prompt (b).
Run compliance prompt, keep only results with resolvable official-source links, always append the standard disclaimer block (verbatim from `docs/REPORT_SPEC.md`).

### 4.7 Assembly + report viewer
**Model: Sonnet** — the big UI piece.
Assemble sections into the `reports` row. Viewer at `/app/reports/[id]`: clean readable layout, preview sections rendered, paid sections shown as locked cards with section titles + blurred teaser (real gating logic in Phase 5 — here it's visual only). Print stylesheet so browser print-to-PDF looks decent (this IS the MVP "export" — skip PDF libraries).

### 4.8 Progress screen
**Model: Haiku** — simple polling UI against defined statuses.
"Researching competitors… / Crunching your numbers… / Writing your report…" driven by report status; auto-redirects to viewer on completion; friendly retry on `failed`.

### 4.9 End-to-end quality pass
**Model: Sonnet** — judgment required to assess output quality.
Run 5 diverse ideas (pet treats, lawn care, SaaS tool, Etsy candles, online course) through the full pipeline. Manually grade each report: competitors real and clickable? numbers plausible? compliance links official? Fix the worst prompt failures. Record results in `docs/QUALITY_LOG.md`.

## Acceptance criteria
- [ ] Pet-treats idea end-to-end: report contains ≥5 real competitor links (at least 2 plausibly local/national to the user's location), a cost table with power + active-labour split, a suggested price with margin, ≥2 official compliance links, and next steps.
- [ ] Report generation completes in under ~5 minutes and survives a transient step failure (retry) without dying.
- [ ] A failed section renders as "unavailable" while the rest of the report displays.
- [ ] Preview vs locked sections match `docs/REPORT_SPEC.md`.
- [ ] Browser print of a report produces a presentable PDF.
- [ ] Total LLM + search cost per report is measured and logged (must be comfortably under the planned price — target <15% of it).

## Solo-operator sizing
~2 weeks part-time — the longest phase. If it slips, cut 4.5's LLM gap-filling (require user-entered costs) before cutting anything else.
