# Plan — Promo mode + report-end surveys

Date: 2026-07-09. Danny's launch-trial path: promo mode gives the first N users free full
reports; the survey collects real feedback at the end of those reports. Execute on Sonnet.
TWO commits (one per feature), promo first.

## Shared foundation — `app_settings` table (migration 013)

```sql
create table app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table app_settings enable row level security;
-- no policies: service-role only. Public/user-visible state is exposed through
-- purpose-built API routes that return only what's safe.
```
Helper `src/lib/app-settings.ts`: `getSetting<T>(service, key): Promise<T | null>` and
`setSetting(service, key, value)` (upsert, bumps updated_at). Both take an existing service
client — they must not create one themselves.

---

## Feature 1 — Promo mode

### Context (verified)
Full-report generation is currently ADMIN-ONLY: `POST /api/reports/full` hard-gates on
`isAdminEmail`. There is no payment system yet. Promo mode = the first mechanism that lets
regular users trigger a full report, free, within admin-set caps. When caps run out the app
"returns to live mode", where the unlock button goes back to the existing inert
"coming soon" state (payments are Phase 5).

### State — `app_settings` key `promo`
```jsonc
{
  "enabled": true,
  "spend_cap_usd": 100,        // number | null = no spend cap
  "report_cap": 100,           // number | null = no count cap
  "per_user_limit": 1,         // number | null = unlimited per user
  "started_at": "2026-07-09T…",// set when enabled
  "ended_at": null,            // set on auto/manual end
  "ended_reason": null         // 'spend_cap' | 'report_cap' | 'manual'
}
```
### Migration 013 also adds: `alter table reports add column is_promo boolean not null default false;`
Promo usage counters are DERIVED (no separate counter row to drift):
- reports used = `count(reports where is_promo)` (all-time — promo rows keep the flag forever;
  a new promo period is measured from its own started_at: count where is_promo AND
  created/completed >= started_at. Use generation_started_at >= started_at).
- spend used = `sum(cost_usd) where is_promo and generation_started_at >= started_at`.
- per-user used = same filtered by owner via ideas join (reports has no owner column? it does
  have owner_id — VERIFY in database.types.ts; if absent, join through ideas.owner_id).

### Gate changes — `src/app/api/reports/full/route.ts`
- Admin path unchanged (admin can always generate — test mode).
- Non-admin path (NEW): after auth + idea-ownership checks (which already run with the
  per-request client, keep that), use the service client to:
  1. Read `promo` setting. Not enabled → 403 with the current "coming soon" style message.
  2. Check caps (queries above). If spend or report cap reached → atomically-enough end the
     promo: `setSetting` enabled=false + ended_at + ended_reason, then 403 with a friendly
     "the free launch offer has ended" message. (Volume is tiny; check-then-act overshoot of
     one report is acceptable — note it in a comment.)
  3. Check per_user_limit (count this user's is_promo reports in the period) → 403 "you've
     used your free report for this promotion" when at limit.
  4. Proceed: set `is_promo = true` on the report row in the same update that queues it.
- The spend cap stops NEW runs once accumulated spend ≥ cap (spend is only known post-run —
  that's inherent; document it in the admin UI as "approximate, checked before each run").

### Status endpoint — `GET /api/promo-status`
Authenticated (any signed-in user). Returns ONLY
`{ active: boolean, perUserRemaining: number | null }` for the CURRENT user (null = unlimited).
Computed with the service client after auth check; never expose caps/spend numbers.

### Report page UI — the unlock button
`report-client.tsx` (or wherever the inert "Unlock full report — coming soon" button lives —
also the account My-ideas list has a mirror "Purchase full report · coming soon" button):
- When promo active AND user has remaining allowance: real button
  "Generate full report — free during launch" → POST /api/reports/full → existing progress
  flow (the page already knows how to poll/show a generating report — reuse exactly what the
  admin test button does; find it and generalise rather than duplicating).
- When promo active but user exhausted their limit: disabled button with
  "Free launch limit reached — paid reports coming soon".
- Promo inactive: current "coming soon" behaviour unchanged.
- Fetch promo status server-side in the report page's server component (service client is NOT
  ok there — it's a user page; call the helper via a small server-side function that uses the
  service client ONLY to read the promo setting — this is app-global config, not user data, so
  a dedicated `getPromoPublicStatus(userId)` helper in src/lib/promo.ts using the service
  client is acceptable; keep ALL promo logic in that one lib file, used by both the API gate
  and the page).

### Admin UI — Promo section on `/app/admin/settings`
(Reuse the existing settings page; add a "Promo mode" card above/below the model picker.)
- Form: spend cap USD (number, blank = none), report cap (number, blank = none), per-user
  limit (number, blank = unlimited). Save via `PATCH /api/admin/promo`.
- Start button (confirm dialog: "This lets every signed-in user generate full reports for
  free until a cap is reached.") / End-now button (confirm dialog too — it changes what
  users see immediately).
- Live usage readout while enabled: reports used vs cap, spend used vs cap (4-decimal USD),
  distinct users served; auto-refresh not required (manual reload fine).
- `GET/PATCH/POST /api/admin/promo` route(s) — standard admin gate pattern.
- History niceties (ended_reason/ended_at display) — show when ended.

---

## Feature 2 — Report-end surveys

### Data — migration 014
```sql
create table survey_questions (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  qtype text not null check (qtype in ('text','rating','multiple_choice')),
  options jsonb,               -- string[] for multiple_choice, null otherwise
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table survey_responses (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references survey_questions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  report_id uuid references reports(id) on delete set null,
  answer text not null,
  created_at timestamptz not null default now()
);
```
RLS: enable both.
- survey_questions: public select where `active`.
- survey_responses: authenticated INSERT with check `user_id = auth.uid()`; authenticated
  SELECT of OWN rows only (`user_id = auth.uid()`) — needed so the report page knows the user
  already answered. No update/delete.
Survey on/off lives in `app_settings` key `survey`: `{ "enabled": false }` (default OFF).

### User-facing — end of the report page
- After the report content (full report; include on initial-report view too — same component,
  it sits below whatever content rendered): if survey enabled AND active questions exist AND
  user has no responses yet for any active question → show a compact "Help us improve —
  2 minutes" card: renders questions in sort order (text → textarea; rating → 1-5 stars,
  reuse the star visual language from feedback; multiple_choice → radio list). One submit for
  all answers → `POST /api/survey` (validates: enabled, question ids active, one answer per
  question, lengths ≤ 2000; inserts with the per-request client so RLS authorises; attaches
  report_id when the page provides it).
- After submitting (or if already answered): a small "Thanks for the feedback" line, not the form.
- Survey disabled or no questions: renders nothing at all.

### Admin — `/app/admin/surveys` (+ "Surveys" nav item, ClipboardList icon, Management group)
- Master on/off toggle (writes app_settings.survey).
- Questions manager: add (prompt, type, options for multiple_choice), reorder (up/down),
  toggle active, delete. DELETE RULE: hard delete allowed ONLY when the question has zero
  responses (confirm dialog); questions with responses can only be deactivated (UI explains
  why — responses are never destroyed).
- Responses view: per-question tab/section — for rating: average + distribution; for
  multiple_choice: counts per option; for text: list of answers with username + date.
  Plus a total-respondents count.
- **AI overview button**: "Summarise responses" → `POST /api/admin/surveys/summary` →
  builds a compact prompt from all responses (cap the input: latest ~200 responses) →
  `callAI` from src/lib/ai.ts with model `claude-haiku-4-5-20251001` (HAIKU_MODEL export),
  maxTokens 1024, tag `admin:survey-summary` — returns 3-6 bullet themes + notable quotes.
  Ephemeral (rendered, not stored). Button shows cost is tiny but non-zero ("uses a small
  amount of AI credit").
- APIs: `GET/POST/PATCH/DELETE /api/admin/surveys` (+ questions sub-ops) — standard admin
  gate pattern, service client after check.

### Graceful degradation (both features)
Missing migration 013/014 must never crash anything: promo status reads → treat as
promo-off; survey reads → treat as survey-off; admin pages show the "run migration NNN"
notice (copy the samples/contact pattern incl. PGRST205 + 42P01 handling).

---

## Verification (all must pass, in E:\idea-engine)
```
npx tsc --noEmit
npx next build
npx vitest run
```
Add vitest coverage for the pure parts: promo cap-decision logic (extract a pure function
`evaluatePromoGate(config, usage)` in src/lib/promo.ts and test cap/limit/ended branches) and
survey response validation.

## Commits (two, on main, DO NOT push)
1. `feat(promo): app-wide promo mode — free full reports with admin caps and auto-revert`
2. `feat(surveys): report-end surveys with admin question manager, responses view, AI summary`
Both ending `Co-Authored-By: Claude <noreply@anthropic.com>`.

## Out of scope
Payments/Stripe · emails · homepage promo banner (can reuse offers later) · multi-survey
support · storing AI summaries.
