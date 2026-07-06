# Handoff — 2026-07-07 (PDF export, country dropdown, score donuts, account ideas list)

Pushed as commit `81f78ca` — catches up everything since `584535b` (below), which had accumulated uncommitted across several separate work sessions.

## What shipped

1. **PDF report export** — new dependency `@react-pdf/renderer`. `GET /api/ideas/[id]/report/pdf` (must run on Node, not Edge). `src/lib/pdf/` holds the document (`ReportDocument.tsx`), shared primitives (`components.tsx`), and theme (`theme.ts`). Designed as its own professional document — light-only, Helvetica, indigo/emerald/amber accents, no red — not a dark-mode screenshot of the app. Cover page, clickable internal TOC (via react-pdf `Link src="#anchor"` + matching `id` props — no page-number lookup needed), one page per report section, hides any section the report doesn't have (works identically for a full report or a teaser-only one — see item 4).
   - **Known react-pdf gotchas hit and fixed**: Helvetica's base-14 font has no `→` (U+2192) glyph — renders as tofu; use ASCII `>`. `react-pdf`'s Yoga-based flex layout does **not** shrink an unconstrained long-text sibling the way CSS does — a long AI-generated sentence next to a name column will starve the column to ~1 word/line and overflow; fix is `flex:1` on the long side (done in the shared `KVRow` component and every name/badge row). `stroke` doesn't parse CSS `rgba()` — silently falls back to a visible orange "error" color; use solid hex + a separate `opacity` prop instead. `Link`/`Svg` don't cascade text style into nested custom-styled `Text` children — each needs its own style repeated.
   - No PDF equivalent of `target="_blank"` exists in the format — confirmed via `@react-pdf/renderer`'s own `LinkProps` type (only `href`/`src`/`wrap`/`debug`/`hitSlop`). Whichever app opens the PDF decides new-tab vs. same-tab, not the file.
   - Links were color-only (same accent as headings/badges) with no reliable underline across viewers — added an explicit link-icon (Feather's MIT "external-link" glyph, box+arrow, not a chain-link — straight lines stay crisp at ~8px where a curved glyph blurs) beside every link, on **both** web and PDF, via `ExternalLinkIcon` (web) / `LinkIcon` (PDF, built from react-pdf's own `Svg`/`Path`/`Polyline`/`Line` primitives).
2. **Country is now a dropdown**, not free text — `src/lib/countries.ts` (shared with the account form), with currency symbol threaded through the wizard's money questions, `cost-calculator.ts`, and report currency formatting (`symbolForCountry`/`symbolForCurrency`).
3. **Score donut** (`src/components/score-ring.tsx` web, `ScoreDonut` in `src/lib/pdf/components.tsx` PDF) — derives a 0–100 headline score from the 4 viability dimensions via `src/lib/viability-score.ts` (simple interim formula, documented as such; a proper calibration pass is still a backlog item once real report volume exists). Shown on: the report web view (next to "Viability Snapshot"), the PDF Executive Summary page, and each row of the account page's ideas list. Extracted from the landing-page marquee's existing `ScoreRing` (was a private function in `src/app/page.tsx`) rather than inventing a new visual language.
4. **Nav + page restructure**:
   - `AppHeader` is now an async Server Component that queries the signed-in user's idea count itself (one cheap `count`-only query) — "My ideas" only renders once that's `> 0`. No prop threading needed across its ~7 call sites.
   - `/app` (dashboard) is now a clean, single-purpose "start a new idea" page — just the intake form + a mock-stats strip (`src/lib/demo-stats.ts`, shared with the landing page's `DEMO_STATS`, both marked `TODO: replace with real numbers`) + a link to `/sample-report`.
   - The ideas list moved to `/app/account#your-ideas`. Each row shows: score donut (or a neutral dashed placeholder if no score yet), status badge (Classifying/In progress/Researching/Generating…/Failed/Report ready), and a **Download PDF** link — which now works even when only a teaser has been generated (report pipeline stores teaser content in `reports.preview_sections`, not `sections` — see `generate-teaser.ts`; the PDF route was previously gated on full `sections.competitors` existing, now accepts either and hands `ReportDocument` whichever is populated).
5. **New shared modules** (small extractions, avoid yet another duplicate): `src/lib/archetype-labels.ts` (a 5th copy of this map would've been added otherwise — the 3-4 existing duplicates in confirm/summary/other pages were left alone, not worth the touch-risk right now).

## Verification notes
- Every PDF change was checked by rendering against **real production report data** (not just the hand-written sample fixture) via a temporary unauthenticated debug route (`src/app/api/debug-pdf-preview`, service-role client) that was deleted before each commit — rasterized with `pymupdf`/`fitz` (`C:\Python310\python.exe`, `pip install pymupdf`) since headless Chrome's built-in PDF viewer doesn't screenshot through the automated preview tools.
- The account page and dashboard restructure could **not** be visually verified in a real browser — the automated preview session isn't signed in as the real user and there's no way to authenticate it. Verified instead via: `tsc`/`eslint` clean, a pure-logic test of the trickiest new function (`reportDisplayState`'s teaser/full/generating detection, 6 synthetic scenarios all correct), and a direct Supabase query confirming the ideas→reports nested-select shape works as expected. **Recommend a manual click-through of `/app` → `/app/account` after this deploys.**
- Score-ring math cross-checked against a real sample-report render (63/100 for scores 4/3/3/2 — matches the formula by hand).

## Not yet done from this batch
- Add `ADMIN_EMAIL` to Vercel's env (still outstanding from the prior handoff below — unrelated to this batch but still blocking prod admin access).
- The 3-4 pre-existing `ARCHETYPE_LABELS` duplicates elsewhere weren't consolidated onto the new shared module — left alone to limit blast radius.

---

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
