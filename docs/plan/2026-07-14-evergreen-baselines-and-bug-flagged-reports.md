# Evergreen country baselines + bug-flagged report inspector

**Status:** spec — ready for implementer (Sonnet tier)
**Date:** 2026-07-14
**Owner:** Fable (architecture + final review). Build as TWO separate implementer
runs — Workstream B first (small, independent), then Workstream A (larger,
includes migration 030). Opus reviewer pass required on Workstream A (touches
migration + report pipeline = high-risk); B can go straight to Fable review.

Model-economy note for the implementer: no new AI feature in this spec defaults
above Haiku except the one explicitly amortized call (evergreen baseline
generation, Sonnet — see A3 rationale).

---

## Workstream B — Bug-flagged report inspector (build first)

### Goal
When a user files a bug from inside a report, the admin must be able to open
the actual report the bug refers to and eyeball what the AI produced. Today
`bug_reports.report_id` is captured (migration 018) but leads nowhere — there
is no admin view of another user's report (`ReportPageContent` fetches via the
RLS client, so an admin opening `/app/ideas/<id>/report` for someone else's
idea 404s).

### B1. Admin report inspector page — `/app/app/admin/reports/[id]/page.tsx`
New server component under the existing admin layout (the layout already gates
on `isAdminEmail` — same safety pattern as `/app/admin/bugs/page.tsx`: service
client reads are safe ONLY because the layout gate ran).

Fetch with `createServiceClient()`:
- `reports` row by id: `id, idea_id, user_id, status, model_version, cost_usd, sections, generation_started_at, generation_completed_at, error`
- the parent `ideas` row: `restatement, archetype, location_country, location_region, raw_text`
- owner display info (whatever the admin users list already uses — follow `src/lib/admin-users.ts` / `src/lib/public-name.ts`)
- all `bug_reports` rows with this `report_id` (plus signed screenshot URLs, 1hr, same pattern as the bugs queue page)

Render (dark/light classes matching existing admin pages):
1. Header: idea restatement, owner (linked to `/app/admin/users/<user_id>`),
   report status, model_version, cost_usd, generation timestamps.
2. **Bug context block** (only when bug rows exist): each bug's created_at,
   status, `report_tab`, description, page_url, browser_info, screenshot link.
   This sits ABOVE the report content — the admin is here to answer "what did
   the user see that made them file this?"
3. **Generation diagnostics**: from `sections._meta` — `partial` flag,
   `section_status` map, and the `steps` table (step id, status, model, input/
   output tokens, web searches, cost, error). Simple HTML table.
4. **Sections**: one collapsible `<details>` block per top-level key of
   `sections` (skip `_meta`), pretty-printed JSON in a `<pre>` with
   `overflow-x-auto`. Do NOT try to reuse `ReportClient` — it drags in surveys,
   gating, affiliates, and owner-scoped queries. The admin needs content
   fidelity, not visual fidelity.
5. If the report row doesn't exist: `notFound()`.

### B2. Link from the bugs queue
In `src/app/app/admin/bugs/bug-queue-list.tsx`: when a row has `report_id`,
render a "View report" link to `/app/admin/reports/<report_id>`. Keep the
existing layout; a small link/button alongside the status controls is fine.

### B3. Bug badge on the admin user detail page
In `src/app/app/admin/users/[id]/page.tsx`: the page already fetches the
user's reports. Add one service-client query for `bug_reports` rows matching
those report ids (`select report_id`, `in` filter), and render a small badge
(e.g. red-tinted pill, "N bug(s)") on idea rows whose report has bugs, linking
to the inspector. Follow the existing `report: {status}` pill styling.

### B4. Out of scope for B
- No migration. No new indexes (admin-page volumes are tiny; `report_id`
  filters on a table that fits in memory).
- No changes to the user-facing bug widget or the bug email.
- No status/workflow changes to bug_reports.

### B verification
- `npm run lint` (baseline is 18 warnings — do not add to it) and `npm run build`.
- Manual: with the dev DB, file a bug from a report (or insert a bug_reports
  row pointing at an existing report), then confirm: bugs queue shows "View
  report" → inspector renders header, bug block, diagnostics, sections; user
  detail page shows the badge. Screenshot-less and report_id-less bug rows must
  still render fine (no link, no crash).

---

## Workstream A — Evergreen country baselines (compliance first)

### Goal
Country-generic research (business registration, tax, consumer law, privacy —
"how to start a business in X") is re-purchased on every report. Cache it per
**country × archetype × section** in a DB table that self-populates: first
report from a new key does a dedicated one-time baseline research call and
stores it; every later report gets the baseline injected free and spends its
AI budget only on idea-specific research. Admin can eyeball, approve, or evict
entries.

**Phase 1 scope = the `compliance` section only.** The table, admin page, and
lookup helper are built generically (a `section` column) so financing/marketing
can adopt the same infra later without schema changes — but do NOT wire those
sections in this run.

### A1. Migration `supabase/migrations/030_evergreen_baselines.sql`
Follow the house style of 018 (header comment: purpose, RUN MANUALLY note,
graceful-degradation note).

```sql
create table public.evergreen_baselines (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  country_code        text not null,            -- upper-cased, e.g. 'AU'
  region              text not null default '', -- '' = country-level (phase 1 always '')
  archetype           text not null,
  section             text not null check (section in ('compliance', 'financing', 'marketing')),
  items               jsonb not null,           -- array of ComplianceItem-shaped objects
  review_status       text not null default 'unreviewed' check (review_status in ('unreviewed', 'approved')),
  reviewed_at         timestamptz null,
  generated_by_model  text not null,
  generation_cost_usd numeric not null default 0,
  source_report_id    uuid null,                -- report whose run filled this entry
  expires_at          timestamptz not null,     -- generation time + 180 days
  unique (country_code, region, archetype, section)
);

create index idx_evergreen_lookup on public.evergreen_baselines (country_code, region, archetype, section);
```

RLS: enable RLS, create **no** policies — service-role only, same posture as
bug_reports admin reads. (The report pipeline and admin pages both use the
service client.)

No storage bucket, no triggers. `updated_at` is set by application code on
regeneration.

### A2. Lookup/store helper — `src/lib/evergreen.ts`
```ts
getEvergreenBaseline(supabase, { countryCode, archetype, section }): Promise<EvergreenBaseline | null>
```
- Normalizes country to upper-case; region fixed to `''` in phase 1.
- Returns null when: no row, row expired (`expires_at < now()`), or the table
  doesn't exist yet (catch Postgres `42P01` / PostgREST `PGRST205` — same
  `isMissingTable` pattern as `/api/bug-report`; a missing migration must mean
  "cache miss, pipeline behaves exactly as today", never a crash).

```ts
storeEvergreenBaseline(supabase, { countryCode, archetype, section, items, model, costUsd, sourceReportId }): Promise<void>
```
- Upsert on the unique key (regeneration after expiry/eviction overwrites in
  place; reset `review_status` to 'unreviewed', set `updated_at`, recompute
  `expires_at` = now + 180 days).
- Two concurrent first-reports for the same key: upsert makes last-writer-win —
  acceptable, both results are fresh. No locking.
- Swallow missing-table errors (log via console, don't fail the report).

### A3. Pipeline changes — `src/lib/inngest/generate-report.ts`, compliance step
Replace the current single `compliance-check` call with:

**(0) Provider guard.** If `provider` resolves to `'mock'` (demo mode), skip
the evergreen cache entirely — no reads, no writes. Fixture data must never
poison the cache, and demo runs must not depend on DB state. Mock mode uses the
new two-call flow with fixtures (see A6) but never touches the table.

**(1) Cache read** — inside a `step.run('evergreen-compliance-read', ...)`
(NOTE for implementer: every DB touch in this function MUST live inside a
`step.run` — Inngest replays the function body at each step boundary and bare
I/O re-fires on every replay; see the mark-running comment in the file).

**(2) On MISS — baseline generation call.** New `aiStep`:
- id `evergreen-compliance-baseline`, maxTokens 6144
- prompt: new file `src/lib/prompts/compliance-baseline.ts` (see A4)
- `tools: webSearchTool(4)`, `model: DEFAULT_MODEL` (Sonnet — deliberate
  exception to Haiku-first: this call is amortized over every future report
  from this country × archetype, so quality dominates; cost per report rounds
  to zero), `tag: 'report:compliance-baseline'`
- inputs: archetype + country + region ONLY. **No idea fields** (no
  restatement, no sales_channel) — idea-specific content must not bleed into
  the canonical baseline.
- on success: `bankStep(...)` (the triggering report honestly carries the
  cost) and `storeEvergreenBaseline(...)` inside its own step.run, recording
  model + costUsd + reportId.
- on failure: proceed with `baseline = null` — the overlay call below then
  runs in "legacy" mode (see 3b) and nothing is stored.

**(3) Overlay call** (every report):
- id `compliance-check` (keep the id — it stays the per-report step), maxTokens
  6144, `model: stepModel('compliance')` (Haiku), `tag: 'report:compliance'`.
- **3a. With a baseline** (hit or freshly generated): `tools: webSearchTool(2)`
  (down from 3 — the baseline already covers the generic ground), prompt =
  new builder in `src/lib/prompts/compliance-overlay.ts` (see A4) which
  receives the baseline items and the idea specifics, and asks ONLY for
  requirements beyond the baseline.
- **3b. Without a baseline** (generation failed / table missing): exact
  current behavior — existing `buildComplianceMessage`, `webSearchTool(3)`,
  existing fallback chain. This is the unchanged safety net.

**(4) Merge & status.** Section value = baseline items (if any) followed by
overlay items, deduped by case-insensitive `item` name (overlay wins on
collision — it's fresher and idea-aware). `sectionStatus.legal_compliance`:
- baseline present + overlay ok → 'live_ok'
- baseline present + overlay failed → 'live_ok' (baseline is real, searched,
  source-backed content; do NOT run the inferred fallback on top of a good
  baseline — that's the cost we're deleting)
- no baseline + overlay(legacy) ok → 'live_ok' (as today)
- no baseline + legacy failed → existing fallback → static baseline chain,
  'fallback_inferred' (unchanged)

Item shape stays exactly `ComplianceItem` (src/lib/compliance-baseline.ts) so
the report UI and PDF need zero changes.

### A4. Prompts
Both new prompt files follow the house pattern (persona preamble, CRITICAL
OUTPUT RULE for bare JSON array, official-URL rules copied verbatim from
`compliance.ts` — never fabricate URLs, copy from live search results).

**`compliance-baseline.ts`** — `COMPLIANCE_BASELINE_SYSTEM_PROMPT` +
`buildComplianceBaselineMessage({ archetype, location_country, location_region })`.
Asks for the 4–8 requirements that apply to essentially EVERY new business of
this archetype in this country: registration, tax registration thresholds,
consumer law, privacy obligations, plus archetype-generic items (e.g. software
distribution/data rules for software archetypes). Explicitly instructs: "Do
NOT include requirements that depend on the specific product or service sold —
those are researched separately per business."

**`compliance-overlay.ts`** — `COMPLIANCE_OVERLAY_SYSTEM_PROMPT` +
`buildComplianceOverlayMessage({ archetype, location_country, location_region,
restatement, sales_channel, production_location, baseline_items })`.
Renders the baseline as a compact JSON list under "ALREADY COVERED — do not
repeat these", then asks for 0–4 requirements SPECIFIC to this idea (industry
licences, product safety, food handling, professional registration, etc.).
Returning `[]` when the baseline covers everything is a valid, expected answer
(the CRITICAL OUTPUT RULE in compliance.ts already permits `[]`).

### A5. Admin surface — `/app/app/admin/evergreen/`
Follow the bugs-queue pattern exactly (service client after layout gate,
missing-migration notice for 42P01/PGRST205 telling Danny to run 030, MarkSeen
only if the section registry makes that a one-liner — otherwise skip).

- `page.tsx`: table of all rows — country, archetype, section, item count,
  review_status, updated_at, expires_at, generation cost, model, link to
  source report (`/app/admin/reports/<source_report_id>`, from Workstream B).
  Filter pills: All / Unreviewed / Approved (URL param, like bugs statuses).
  Each row expands (`<details>` or client component, match house style) to
  show the items pretty-printed.
- Row actions via new API routes (follow `/api/admin/bugs/[id]/route.ts` for
  auth shape — `isAdminEmail` check + service client):
  - `PATCH /api/admin/evergreen/[id]` `{ action: 'approve' }` → review_status
    'approved', reviewed_at now.
  - `DELETE /api/admin/evergreen/[id]` → delete row (eviction = "regenerate on
    next report from this key"). No confirm UI beyond a JS confirm().
- Add "Evergreen" to the admin nav in `admin-shell.tsx` (match existing items).
- `review_status` is informational in phase 1: unreviewed baselines ARE served
  (first user from a country can't wait for review). The queue exists so Danny
  eyeballs new entries soon after they appear. Do not build gating-on-approval.

### A6. Fixtures & tests
- Add fixtures `src/lib/fixtures/report-compliance-baseline.json` (4–6
  ComplianceItem objects, AU-flavored, derived from the existing
  `report-compliance.json` content) and reuse the existing
  `report-compliance.json` as the overlay fixture is NOT possible (tag differs
  only if the tag changes — the overlay keeps tag `report:compliance`, so the
  existing fixture already serves it; verify the fixture's shape still parses
  as a JSON array).
- Unit tests (vitest, colocated in `src/__tests__/`): the merge/dedupe
  function (baseline + overlay, collision → overlay wins, empty overlay ok)
  and `getEvergreenBaseline` expiry logic (expired row → null). Pure-function
  tests only — no Supabase mocking heroics.

### A7. Explicitly out of scope (phase 1)
- Financing/marketing sections (schema supports them; do not wire).
- Region-level rows (column exists, always '' for now).
- Approval-gated serving, versioning/history, scheduled refresh (expiry-as-miss
  self-heals), any teaser-pipeline changes, any user-facing UI changes.

### A verification
- `npm run lint` (do not exceed the 18-warning baseline) + `npm run build`
  (prod build — client/server boundary smoke, house rule).
- Vitest green.
- Manual with dev DB + migration 030 applied: run a report for an AU idea →
  evergreen row appears (unreviewed, cost recorded, source report linked);
  run a second AU report of the same archetype → `_meta.steps` shows NO
  `evergreen-compliance-baseline` step and the compliance section contains
  baseline + overlay items; admin page lists/approves/deletes the row; after
  delete, next report regenerates it.
- Manual without migration 030: report generation must behave exactly as
  today (legacy path), no errors surfaced to the user.

---

## Sequencing & review

1. Implementer run 1: Workstream B. → Fable review.
2. Implementer run 2: Workstream A. → Opus reviewer (correctness of Inngest
   step discipline, RLS posture, cache-poisoning guards, fallback chain) →
   Fable final review.
3. Danny runs migration 030 manually (house rule) before A ships to prod.
