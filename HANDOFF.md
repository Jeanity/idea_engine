# Handoff — 2026-07-07 (Block 2 — analytics foundation)

Block 2 of the admin-backend master plan built (event pipeline, sessions,
referrer/UTM attribution, aggregation RPCs). **Nothing committed.**

## Needs Danny
- **Run migration `supabase/migrations/005_analytics_events.sql` manually** in the
  Supabase SQL editor (creates `page_events`, adds `profiles.last_seen_at` +
  `profiles.acquisition`, and the six `analytics_*` RPCs). Until it runs, `/api/track`
  inserts fail silently (by design) and the RPCs don't exist.

## Open decisions — RECOMMENDED defaults implemented (change only if Danny objects)
- **(a) GA4 alongside self-owned analytics? → NO.** Self-owned events are the sole
  source; no third-party analytics, no gtag. Can be added later purely by pasting the
  snippet if ever wanted — do not build dashboards against GA4.
- **(b) Zero-cookie vs returning-visitor precision? → keep the functional cookies
  (returning-visitor precision).** Two functional-only cookies: `ie_sid` (session,
  30-min rolling) and `ie_vid` (visitor, 1yr persistent). Because of this, `page_events`
  carries a `visitor_id` column (the plan left this to the implementer) so the
  returning-visitor RPC is computable. No IP and no user-agent are ever stored.

## What shipped (uncommitted)
- `page_events` append-only table (RLS on, no policies → service-role only) + first-touch
  columns on `profiles`. Six SECURITY DEFINER RPCs (sessions/pageviews/unique-visitors/
  returning-visitors per day, top referrers, top UTM campaigns) — all revoked from
  anon/authenticated, granted only to `service_role` (Block 3's admin API calls them).
- Client beacon `src/components/analytics-beacon.tsx` mounted in the root layout (covers
  public site + /app): `navigator.sendBeacon('/api/track', …)` on every route change;
  first hit of a session also sends `document.referrer` + parsed UTM.
- `src/app/api/track/route.ts` (nodejs, public, no auth): strict allowlist, rejects
  bodies >1KB and paths not starting with `/`, service-role insert into `page_events`
  only, throttled (>60s) `last_seen_at` heartbeat for the optional signed-in user.
  Always returns 204 — tracking failures never surface.
- First-touch attribution in `src/app/auth/callback/route.ts`: on signup, copies the
  visitor's earliest event (referrer/utm/landing_path) into `profiles.acquisition` once.
- Pure date-bucketing/UTM helpers in `src/lib/analytics.ts` with vitest coverage
  (`src/__tests__/analytics.test.ts`).

---

# Handoff — 2026-07-07 (PDF Q&A appendix, edit nudge, edit rate-limit, admin Demo/Live mode)

**NEW MAJOR PLAN**: `docs/plan/2026-07-07-admin-backend-master-plan.md` — 9-block roadmap
for the comprehensive admin backend (affiliate links + click tracking, analytics/users-online,
user management, discounts/offers, sales & costs, growth graphs, referrer tracking) plus the
end-of-report feedback/ratings → homepage testimonials feature. Written to be executed
block-by-block by Sonnet/Opus without Fable. Start with Block 1 (admin shell); recommended
order + model routing table at the bottom of that file.

All four plan blocks (docs/plan/2026-07-07-A…D.md) implemented via Opus subagent and verified:
`npx tsc --noEmit` clean, `npm run test` 29 passed (7 new edit-limit cases), `npm run build`
succeeds. Lint's 6 errors are all pre-existing in untouched files. **Nothing committed yet.**

## Needs Danny before this works end-to-end

1. ~~Run migration 003 in the Supabase SQL editor~~ — **DONE 2026-07-07** (Danny ran it).
2. ~~ADMIN_EMAIL missing from Vercel~~ — **DONE**: confirmed present in Vercel
   (Production + Preview, updated 2026-07-05).
3. **Stripe still isn't wired** (Phase 5). The new copy (PDF appendix, summary nudge,
   edit-limit message) says regeneration is a new charge — forward-looking copy only.
4. ~~Demo Mode full-report path FAILS on missing fixtures~~ — **FIXED 2026-07-07**.
   `scripts/capture-fixtures.ts` extended (marketing harvest from `sections.marketing_plan`;
   synthesis widened to all 8 keys) and re-run ($0, DB-read). All 7 pipeline tags now have
   fixtures incl. new `report-marketing.json`. Also fixed a latent bug: the script trusted
   the newest `status='complete'` row, which was empty — now skips empties and picks the
   latest report with non-empty `sections` (used the 07-06 GB oven-cleaning report). Uncommitted.

## What shipped (uncommitted working tree)

- **PDF Q&A appendix** — every PDF (initial + full) ends with "Appendix — Your Questions &
  Answers" (answers formatted via new shared `src/lib/format-answer.ts`) plus a "Want a
  different result?" callout linking to `/app/ideas/{id}/summary` (clickable + printed URL).
- **Pre-generation nudge** — summary page, only before the first report exists:
  "Thought of something else? Change your answers now — it's free." with the new-charge warning.
- **Edit rate-limit** — once a report is `complete`: max 2 edit sessions per rolling hour
  (saves within 15 min = one session; timestamps in `ideas.answer_edit_log`). 3rd attempt →
  429 from `/api/ideas/[id]/answers` (`code: 'edit_limit'`, `retry_after_minutes`); wizard
  shows an amber banner with the wait time + "Generate report now →" (routes to summary).
  Pure logic in `src/lib/edit-limit.ts`, unit-tested. No limit before the first report.
- **Admin Demo/Live mode** — `profiles.demo_mode`, toggled via new POST
  `/api/profile/demo-mode` (ADMIN_EMAIL-gated) from the "AI usage — admin" card on the
  account page. Both Inngest functions resolve `providerOverrideForUser()` and pass
  `provider: 'mock'` into all 7 `callAI` calls when on — $0, fixtures, admin's account only.
  Nav header shows amber "Demo Mode" / green "Live Mode" pill, admin only.

## Suggested smoke test (after migration + before commit)

1. Download a PDF for an idea with answers → appendix + edit link render.
2. On an idea with a finished report, trigger a 3rd edit session inside an hour (or seed
   two old timestamps into `answer_edit_log`) → banner with wait time + run-now button.
3. Toggle Demo Mode → header pill flips; generate a report → logs show `provider: 'mock'`,
   cost $0; toggle back to Live.

---

# Handoff — 2026-07-07, end of night

Three pushes today: `584535b` (report v2 — see section below), `81f78ca` (PDF export + UX batch, this section), `df5a544` (terminology). Working tree is clean, everything is pushed. Vercel deploys from main, so all of this is (or is about to be) live in prod.

## State at end of night
- **Local env**: `AI_PROVIDER=anthropic` in `.env.local` (real API calls, real cost). `ADMIN_EMAIL=thedannyowen@gmail.com` set locally — **still NOT set in Vercel env** (top next-action).
- **Dev servers**: `idea-engine` (:3000) + `idea-engine-inngest` (:8288) were running under the Claude session's launcher (`E:\sig\.claude\launch.json`); they die with that session. Next 16 allows ONE dev server per directory — if a stale one holds the port, kill it before starting (`taskkill /PID <pid> /F`; the error message names the PID).
- **Live testing done today**: full end-to-end GB run (mobile oven cleaning, Nottingham) — injected country question, £ currency, .gov.uk compliance links, marketing tab, PDF download all verified against that real report. Real cost of a full report is now **~US$0.84** (marketing step + verbose search results pushed it past the old $0.60 target — re-measure during 4B pricing work).
- **One operational incident worth knowing**: a report got stuck at `status='running'` with all sections present but no `_meta` — cause was editing pipeline code while a live Inngest run was mid-flight (Turbopack HMR orphans the final step silently). Fixed by manually completing the row. Rule of thumb: don't kick off real paid runs while pipeline code is being edited.

## Product decisions made today (bind future copy/work)
- **Never say "teaser" in user-facing copy** — it's an "initial report" (or "basic report"). Fixed everywhere visible in `df5a544`. Internal identifiers (`generateTeaser`, `preview_sections`, `report:teaser` tag) intentionally unchanged.
- **Domain**: Danny registered **hadidea.com**, may use it for this project. Nothing wired yet. When committing to it: add domain in Vercel, update Supabase auth site-URL + redirect allowlist (OAuth/magic links break otherwise), and decide whether the "Idea Engine" name follows the domain (header wordmark, PDF cover, footers, sample-report copy).

## What shipped in `81f78ca`

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

## Next actions (priority order)
1. **Add `ADMIN_EMAIL=thedannyowen@gmail.com` to Vercel project env** — until then prod has no admin and no full-report test button.
2. **Manual click-through of the new `/app` → `/app/account` flow in prod or local** — the restructure couldn't be visually verified from the automated session (auth). Check: "My ideas" nav appears, account page shows ideas with donuts + Download PDF (including an initial-report-only idea), dashboard is the clean new-idea page with stats strip.
3. **Security/privacy workstream** (queued as its own session): app-level AES-256-GCM encryption of ideas.raw_text/restatement, answers.answer_text, reports.sections (server-held key); service-role access audit log; "Your idea stays yours" trust page; ToS clause that users retain all idea IP; Inngest Cloud = data processor in prod or self-host the runner. RLS is already owner-only on all tables; true E2E impossible (pipeline needs plaintext for the Claude API).
4. **Task 4B.3 cost/quality matrix** — 14 ideas (2/archetype) on Anthropic mode → QUALITY_LOG.md → tier-boundary decision. Budget ~$0.84/full report now.
5. **Stripe account signup** (days-long activation review; only external blocker for Phase 5), then Phase 5 build.
6. Smaller backlog: real stats replacing `src/lib/demo-stats.ts` mock numbers; country question pre-fill from previous ideas; headline-score formula calibration (`src/lib/viability-score.ts` is an interim average); consolidate the 3-4 older `ARCHETYPE_LABELS` duplicates onto `src/lib/archetype-labels.ts`; re-capture mock fixtures (`npx tsx scripts/capture-fixtures.ts`) — they pre-date all of today's new sections; "One thing to do"-style closer in the initial report too; fix literal `*something*` markdown leftover in src/lib/sample-report.ts:276.

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
