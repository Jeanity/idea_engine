# Plan — Sample-report management (admin CRUD + public gallery with modal viewer)

Date: 2026-07-09. Requested by Danny. Execute on Sonnet.

## Goal

Danny curates a rotating set of sample reports (one or more per idea type) from
the admin area. The public `/sample-report` page becomes a gallery of static
cards (styled like the homepage marquee idea cards); clicking a card opens the
full sample report in a modal so visitors never leave the page.

## Architecture decisions (binding)

### Data model — `supabase/migrations/011_sample_reports.sql`
```sql
create table sample_reports (
  id uuid primary key default gen_random_uuid(),
  title text not null,                -- card headline, admin-written
  archetype text not null,            -- idea type key (matches ARCHETYPE_LABELS)
  restatement text not null,          -- the idea one-liner shown on card + report header
  sections jsonb not null,            -- full report sections (same schema as reports.sections)
  source_report_id uuid,              -- provenance only; no FK (report may be deleted later)
  active boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table sample_reports enable row level security;
create policy "sample_reports: public read active"
  on sample_reports for select using (active);
```
- No insert/update/delete policies — all writes go through the service client
  in admin API routes (matches the offers/affiliates pattern).
- **Graceful degradation is mandatory**: until Danny runs the migration in
  prod, the table won't exist. The public page must fall back to the built-in
  coffee-van sample on ANY query error; the admin page shows a "run migration
  011" notice instead of crashing.

### Sanitization when cloning (important)
When a sample is created from a real report, strip before insert:
- `sections._meta` (internal cost/model diagnostics — never public)
- The public viewer renders ALL links disabled (same policy as today's sample
  page: a public page must never carry link-rotted or fabricated URLs). Keep
  the URLs in the stored jsonb; disable at render time.

### Admin API — `src/app/api/admin/samples/route.ts` (+ `[id]/route.ts`)
Standard admin-route pattern (auth → `isAdminEmail` → service client only after):
- `GET` — all samples (incl. inactive), sorted by sort_order.
- `POST` — body `{ reportId, title }`: load that report's `sections`,
  `ideas.restatement` + `ideas.archetype` (join via reports.idea_id), sanitize
  (above), insert inactive by default.
- `PATCH /api/admin/samples/[id]` — partial update: title, restatement,
  archetype, active, sort_order. Sets updated_at.
- `DELETE /api/admin/samples/[id]` — hard delete. UI must confirm first
  (Danny's standing rule: destructive actions always need explicit confirm).
- Also `GET /api/admin/samples/source-reports` (or a query param on GET):
  recent completed FULL reports (sections has competitors key), with idea
  restatement/archetype + completed date, for the "create from report" picker.
  Limit 25.

### Public API — `src/app/api/sample-reports/[id]/route.ts`
- Anonymous. Returns `{ title, restatement, archetype, sections }` for an
  ACTIVE sample only (respect the RLS by using the anon/per-request client,
  NOT the service client). 404 otherwise. Used by the modal to lazy-load the
  full sections (they're large — don't ship every sample's full jsonb in the
  gallery page HTML).

### Public page — `/sample-report`
- Server component: per-request client selects active samples
  (id, title, archetype, restatement, sort_order — NOT sections).
- If zero rows OR the query errors → render exactly one card for the built-in
  coffee-van sample from `src/lib/sample-report.ts` (it stays in the repo as
  the permanent fallback; do NOT seed it into the DB).
- Gallery: static grid of cards styled like the homepage marquee idea cards
  (look at `src/app/page.tsx` marquee card markup for the visual language —
  archetype chip, idea text, score ring if derivable from
  sections.viability_snapshot… gallery rows don't have sections, so show the
  archetype chip + title + restatement; skip the score ring or include a
  `headline_score` int column — decision: ADD `headline_score int` to the
  migration, computed at clone time via `deriveHeadlineScore` so cards can
  show the familiar donut cheaply).
- Card click → modal (client component): fetches `/api/sample-reports/[id]`,
  renders the report content, scrollable, closes with X / backdrop / Escape.
  Body scroll locked while open.
- **Renderer reuse**: the current sample page renders the hand-written
  sections — extract that rendering into a component that takes
  `{ restatement, sections }` so the page fallback, and the modal, share one
  renderer. Links disabled + the existing "links are disabled on the sample"
  notice. Keep the existing "this is example content" framing and any
  blur/CTA elements the page has today.
- The built-in fallback card opens the same modal with locally-passed data
  (no fetch).

### Admin page — `/app/admin/samples`
- Nav: add "Samples" to the Management group in `admin-shell.tsx`
  (icon: `BookOpen` from lucide-react).
- Page (client, matches other admin pages structurally):
  - Table/list: title, archetype label, active toggle (optimistic PATCH),
    sort_order controls (up/down arrows swapping order values are fine),
    created date, Edit, Delete (confirm dialog: "This removes the sample from
    the public gallery permanently." — samples are copies; deleting one never
    touches the source report).
  - "New sample" button → picker modal listing recent completed full reports
    (idea text, archetype, date) → select one → title input (pre-filled from
    restatement) → creates INACTIVE → appears in list for editing/activating.
  - Edit: inline or small form for title / restatement / archetype / sort.
    No jsonb editing UI in v1.
- Empty/migration-missing state: friendly notice "Run migration 011_sample_reports.sql".

### Product voice
Sample cards/copy: facts not verdicts, never "teaser", no discouraging language.

## Verification (all must pass, in E:\idea-engine)
```
npx tsc --noEmit
npx next build
npx vitest run
```
Public page must be visually checked with the preview tools if the dev server
runs (it's unauthenticated): gallery renders with the fallback card and the
modal opens/closes. If the viewport can't be controlled, code review suffices.

## Commit
ONE commit on main: `feat(samples): admin-managed sample report gallery with modal viewer`
ending with `Co-Authored-By: Claude <noreply@anthropic.com>`. DO NOT push.

## Out of scope
- Seeding the DB with the coffee-van sample.
- Homepage changes beyond whatever already links to /sample-report.
- JSONB section editing UI.
- Running the migration (Danny applies it in Supabase manually).
