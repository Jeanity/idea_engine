# Plan C — limit answer edits to 2 sessions per hour (after a report exists)

## Goal
Once an idea has a completed report, allow at most **2 answer-edit sessions per
rolling hour**. On the 3rd attempt within the hour, block the save and tell the user
they can either wait or run the report now with their current answers.

Before the first report exists (initial questionnaire + pre-generation review) there
is **no limit** — users must be free to answer and revise.

## Semantics
- An "edit session" = a burst of answer saves. Saves landing within **15 minutes** of
  the previous counted session timestamp belong to that same session (editing 5
  answers in one sitting = 1 session, not 5).
- Sessions are tracked per idea as an array of ISO timestamps in a new
  `ideas.answer_edit_log` jsonb column. Only timestamps in the last hour matter;
  prune older ones when writing.

## Files
- `supabase/migrations/003_edit_log_and_demo_mode.sql` — NEW (shared with Plan D)
- `src/lib/database.types.ts` — add `answer_edit_log` to ideas Row/Insert/Update
- `src/app/api/ideas/[id]/answers/route.ts` — enforcement
- `src/app/app/ideas/[id]/questions/questions-wizard.tsx` — surface the block nicely

## Steps

### 1. Migration (one file shared with Plan D)
```sql
-- Migration 003: answer-edit session log + admin demo mode
-- Run in Supabase SQL editor after 002_add_username_to_profiles.sql

alter table public.ideas
  add column answer_edit_log jsonb not null default '[]'::jsonb;

alter table public.profiles
  add column demo_mode boolean not null default false;
```

### 2. Types
`src/lib/database.types.ts`: ideas Row gets `answer_edit_log: Json`, Insert/Update get
optional variants. (profiles `demo_mode: boolean` is Plan D but lives in the same edit.)

### 3. Enforcement in POST `/api/ideas/[id]/answers`
- Widen the idea select to `id, answer_edit_log`.
- Check whether a completed report exists:
  `reports.select('status').eq('idea_id', id).single()` → limit applies only when
  `report?.status === 'complete'` (queued/running/failed or none ⇒ no limit).
- When the limit applies, before the upsert:
  ```
  const SESSION_WINDOW_MS = 15 * 60_000
  const LIMIT_WINDOW_MS = 60 * 60_000
  const LIMIT = 2
  const now = Date.now()
  const log = (Array.isArray(idea.answer_edit_log) ? idea.answer_edit_log : [])
    .map(t => new Date(String(t)).getTime())
    .filter(t => Number.isFinite(t) && now - t < LIMIT_WINDOW_MS)
  const inSession = log.length > 0 && now - Math.max(...log) < SESSION_WINDOW_MS
  ```
  - `inSession` → allowed, log unchanged.
  - `!inSession && log.length >= LIMIT` → **429**:
    ```json
    {
      "error": "You've edited your answers twice in the past hour. You can edit again in N minutes — or generate your report now with your current answers.",
      "code": "edit_limit",
      "retry_after_minutes": N
    }
    ```
    N = minutes until the oldest of the counted timestamps ages out of the hour
    (`Math.ceil((LIMIT_WINDOW_MS - (now - Math.min(...log))) / 60_000)`), min 1.
  - otherwise → append `new Date(now).toISOString()` to the pruned log and
    `update ideas set answer_edit_log` (same user-scoped client; RLS allows owner
    updates), then proceed with the upsert.

### 4. Wizard UX
`questions-wizard.tsx` `saveAnswer()` currently ignores the response. Change it to:
- `const res = await fetch(...)`; on `!res.ok`, parse the body; if `code ===
  'edit_limit'`, throw a typed error (e.g. `EditLimitError` with the message).
- In `handleNext`'s catch: when it's the edit-limit case, set a dedicated state
  (e.g. `editLimitMessage`) instead of the generic validation error.
- Render the message in the existing error slot area as a small banner with the
  server-provided text plus a link/button **"Generate report now →"** →
  `router.push(`/app/ideas/${ideaId}/summary`)` (the review page has the generate
  button; going straight to `/report` would fire generation with no confirmation).

## Verify
- `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm run test` pass.
- Unit test (vitest) for the session/limit maths is welcome if it can be extracted
  into a pure helper (e.g. `src/lib/edit-limit.ts` with
  `evaluateEditLimit(log: unknown, nowMs: number)` returning
  `{ allowed, updatedLog?, retryAfterMinutes? }`) — prefer that structure so the
  route stays thin and the logic is testable.
