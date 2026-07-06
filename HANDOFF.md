# Handoff — 2026-07-06 (report v2: positivity layer, marketing tab, location move, answer editing)

## What ships in this commit

1. **Native `<select>` dark-mode fix** — `color-scheme` rules in globals.css; option text was white-on-white in dark mode (confirm page archetype dropdown, account country dropdown).
2. **ADMIN_EMAIL env var** — the admin gate (`user.email === process.env.ADMIN_EMAIL`) was never set anywhere, so the "generate full report" test-mode button existed for nobody. Set in `.env.local`, documented in `.env.example`. **DEPLOY BLOCKER: add `ADMIN_EMAIL` to the Vercel project env or there is no admin in prod.**
3. **Answer editing after report generation** — report page → "Review / edit answers" link → summary page where every answer card is click-to-edit (`/questions?edit=<key>` jumps straight to that one question; save returns to review). The questions page previously hard-redirected to the report once one existed, making answers permanently uneditable.
4. **Report positivity layer** (Danny's product philosophy: no user ever leaves thinking their idea was *bad* — hard to execute yes, bad never; encouragement must be evidence-grounded, never invented):
   - Persona rules (persona.ts, applies to every prompt incl. teaser): competition = demand evidence, not a verdict; success is the founder's own bar, not a VC's; "hard" ≠ "bad".
   - `why_this_can_work` synthesis section → "Why This Is Worth Pursuing" card on Overview: `market_proof` (what competitors prove about demand) / `your_edge` (grounded in gap_notes; HONESTY RULE — undifferentiated ideas get told the missing wedge, not fake praise; novel differentiators get an IP-protection next_step) / `upside` (framed against the founder's own success goal).
   - Universal `success_definition` question (injected for all archetypes, optional select).
5. **`one_thing_to_do` + `validation_copy` sections** (learnings from ValidatorAI head-to-head tests) — "If you do nothing else, do this" card and paste-ready demand tests (poll question / ad line / forum post) on the Considerations tab.
6. **Location moved out of step 1** — idea form is just the textarea. Country is an injected, required question for every archetype; city/region optional for local_service / physical_product / marketplace / ecommerce_brand. `/api/ideas/[id]/complete` validates the country answer (2-letter) and back-fills `ideas.location_country/location_region` before flipping status — reports can never run without a country. Placeholder for new rows is **'ZZ'** (ISO "unknown"): the column has a `char_length()=2` CHECK constraint, the original `''` placeholder violated it and broke idea creation ("Failed to save idea") — fixed.
7. **Payment-model de-bias** — software_app.json gains "One-off purchase per report / item / project" and "Commission / % per transaction"; price question wording is now model-agnostic; dynamic-questions prompt clarifies the business model instead of assuming subscription.
8. **NEW pipeline step: marketing playbook** → "Getting the Word Out" report tab. Channels tailored to archetype/scope/customer with specific local-currency costs and links (strict URL rules: top-level platform pages or search-verified only, same anti-fabrication policy as compliance), ≥2 free channels, "Before you spend a dollar" week-1 block, starter budget scaled to stated capital. Web search ≤3, maxTokens 3072, tag `report:marketing`, adds ~US$0.05–0.15/report. Synthesis maxTokens now 6144 (8 keys).
9. **Pipeline bug fix** — answers to injected questions (success_definition, country/region) never reached the report prompts: generate-report.ts built its maps_to lookup from the static banks only. Now mapped explicitly (`INJECTED_QUESTION_MAPS`).

## Verification status
- `npx tsc --noEmit` clean; lint clean on all files touched today (pre-existing `set-state-in-effect` / `no-explicit-any` issues remain in questions-wizard.tsx, report-client.tsx, theme-toggle.tsx, generate-teaser.ts).
- Select fix verified in both themes via computed styles. Edit flow, admin gate, and idea creation verified live by Danny.
- **In progress: GB end-to-end test** (mobile oven cleaning, Nottingham) — verifies the injected country question, £ currency, .gov.uk compliance links, and the marketing tab in one run. AU regeneration of the self-test idea (to see the new sections) also pending.
- Old reports: new tab/cards are hidden when keys are missing (render nothing, not "unavailable") — confirm on one old report.

## Known follow-ups (backlog, rough priority)
1. **Security/privacy workstream** (own session): app-level AES-256-GCM encryption of ideas.raw_text/restatement, answers.answer_text, reports.sections (server-held key); service-role access audit log; "Your idea stays yours" trust page; ToS clause that users retain all idea IP; Inngest Cloud = data processor in prod (step memoization holds derived content) or self-host the runner. RLS is already owner-only on all tables; true E2E impossible (pipeline needs plaintext for the Claude API).
2. Startup-capital options hardcode "$" — GB/EU users see dollars; make currency-neutral.
3. Country question: no pre-fill from the founder's previous ideas; validation is regex-only (`ZZ` would pass as a real answer).
4. software_app / content_education never get asked city/region — fine generally, wrong for "an app for one city" edge cases.
5. Consider "One thing to do"-style single-action framing in the TEASER too (currently full report only).

## Standing next actions (carried from cosmetic-sprint handoff)
1. Task 4B.3 cost/quality matrix: 14 ideas (2/archetype) on Anthropic mode → QUALITY_LOG.md → 4B.4 tier-boundary decision (pricing figures are placeholders until then; report cost is now ~US$0.60–0.70 with the marketing step — re-measure).
2. Stripe account signup (activation review takes days; only external blocker for Phase 5).
3. Phase 5 build after 4B.4: two-tier checkout, webhook unlock, PDF download, report updates diff, email delivery.
4. Backlog: wizard privacy-consent question, URL liveness checks, headline-score derivation, re-capture fixtures (`npx tsx scripts/capture-fixtures.ts`) — fixtures pre-date all of today's new sections.

## Gotchas (standing)
- Prompts must pin exact JSON key names; callAI throws on max_tokens truncation (synthesis now needs ≥6144).
- Web search = dominant report cost (caps: 5 competitors / 3 compliance / 3 financing / 3 marketing).
- Mock mode (`AI_PROVIDER=mock`) renders the charger fixture for EVERY idea — judge quality only on Anthropic mode. Currently `.env.local` is set to `anthropic`.
- Next 16 allows ONE dev server per directory — kill the existing one before starting another (`.claude/launch.json` in E:\sig has `idea-engine` + `idea-engine-inngest`; Inngest dev server required for report generation locally).
- Sample-report page must never gain real URLs; public blur = nonsense text underneath.
- Model routing: cheapest capable — Haiku (boilerplate) → Sonnet (implementation) → Fable/Opus (prompts, architecture, sales copy).
