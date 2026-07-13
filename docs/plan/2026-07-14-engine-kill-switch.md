# Engine kill switch + "tell me when it's back" notify list

Danny's ask (2026-07-14): a toggle to turn off report generation completely
("The Engine is currently being serviced"), with an opt-in so users can be
emailed when it's back on — batched ≤5/minute to stay under the IONOS send
cap. Implementer: Sonnet. Work in the CURRENT worktree on the current branch;
commit when verified; NEVER push.

## Conventions that bind this build
- Admin API routes re-check `isAdminEmail` themselves; service client only
  minted after the check (see src/app/api/admin/demo-mode/route.ts — copy its
  shape).
- `app_settings` is service-role only; read/write via getSetting/setSetting
  (src/lib/app-settings.ts). Missing-table degrades gracefully.
- Friendly layered copy: user-facing message stays plain and warm; mechanics
  live in code comments (see memory: layered-disclosure standard).
- Lint baseline is 18 problems — add ZERO new ones. tsc/lint/vitest/build all
  green before committing.

## 1. State + lib — src/lib/service-mode.ts
- `SERVICE_MODE_KEY = 'service_mode'`, value `{ paused: boolean }`.
- `readServiceMode(service): Promise<boolean>` (getSetting, default false),
  `writeServiceMode(service, paused)` (setSetting).
- `SERVICE_MODE_MESSAGE` export:
  "The Engine is in for a quick service — new reports are paused while we
  tune it up. Back soon."

## 2. Migration — supabase/migrations/029_generation_notify.sql
```sql
create table public.generation_notify (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references public.profiles(id) on delete cascade,
  email       text not null,
  created_at  timestamptz not null default now(),
  notified_at timestamptz
);
alter table public.generation_notify enable row level security;
-- No policies: service-role only, same stance as app_settings (013).
create index idx_generation_notify_pending on public.generation_notify (created_at) where notified_at is null;
```
Header comment: RUN MANUALLY in Supabase SQL editor after 028. Also add the
table to src/lib/database.types.ts following how other tables are typed there.

## 3. Server-side enforcement (the switch must be REAL)
In these three routes, AFTER auth, BEFORE any work/spend, and SKIPPED for
admins (`isAdminEmail(user.email)` — Danny must be able to test while paused):
- POST /api/ideas (blocks new intake so nobody walks a wizard into a wall)
- POST /api/reports (teaser + regeneration)
- POST /api/reports/full
Response: `NextResponse.json({ error: SERVICE_MODE_MESSAGE, service_mode: true }, { status: 503 })`.
Read via `readServiceMode(createServiceClient())`.

## 4. Notify opt-in API — POST /api/generation-notify
- Auth required (401 otherwise). No admin gate — this one is for users.
- Service client UPSERT into generation_notify on user_id conflict
  (email = auth user's email). Return `{ ok: true }`.
- Missing table (isMissingTable) → 503 `{ error: "Notifications aren't set up yet." }`.
- Accept even if service mode is already off (harmless; row just gets
  notified on the next resume — or never; do NOT error).

## 5. Client UX — one shared notice component
`src/components/service-notice.tsx` ('use client'):
- Props: `{ message: string }`. Renders an amber "wrench" style card: the
  message + (signed-in flows only, which all of these are) a button
  "Email me when it's back on" → POST /api/generation-notify → success state
  "You're on the list — we'll email you the moment it's back."
  Danny asked for a checkbox; a single opt-in button is the same consent with
  one less click — use the button.
- Wire into the three places a user can hit the 503:
  a) NewIdeaForm (src/components/new-idea-form.tsx): on `service_mode` in the
     error response, render ServiceNotice instead of the plain error text.
  b) ProgressScreen error state (report-client.tsx): if the caught error was
     service_mode (extend triggerGeneration to capture the flag), render
     ServiceNotice in place of the retry line (keep the /support line).
  c) The unlock/generate-full path: find the POST to /api/reports/full in the
     teaser viewer (grep '/api/reports/full' in report-client.tsx /
     components) and surface ServiceNotice on service_mode there too.

## 6. Admin control — card + API + header pill
- `/api/admin/service-mode/route.ts`: GET → `{ paused, pendingNotify }` (count
  of notified_at IS NULL rows; 0 if table missing). POST `{ paused: boolean }`
  → writeServiceMode; when flipping paused true→false AND pendingNotify > 0,
  `await inngest.send({ name: 'idea-engine/engine.resumed', data: {} })`.
  console.log the flip with the admin email (see demo-mode route).
- Admin Settings page (src/app/app/admin/settings/page.tsx — follow how the
  existing cards there are laid out): new "Engine" card — status pill
  (Running / Being serviced), two-step confirm on BOTH directions (copy the
  PromoCard confirm pattern), shows "N users waiting to be told it's back".
- AppHeader (src/components/app-header.tsx): admin-only pill when paused,
  amber, "Engine paused" — same pattern as the Site Demo pill (read via the
  service client next to the other reads there).

## 7. Inngest batch mailer — src/lib/inngest/notify-engine-resumed.ts
- `createFunction({ id: 'engine-resumed-notify', retries: 1, concurrency: [{ limit: 1 }] },
  { event: 'idea-engine/engine.resumed' }, ...)` — limit 1 so two resumes
  can't double-send.
- Loop (max 200 iterations; unique step ids `batch-${i}` / `sleep-${i}`):
  1. step.run: if `readServiceMode()` is paused again → return 'aborted'.
     Select 5 oldest rows where notified_at IS NULL. For each: sendMail
     (buildBrandedEmail, getSiteUrl — see generate-report.ts's
     send-ready-email step for the exact pattern), then update notified_at.
     Send-then-mark: a crash between the two can rarely double-send on
     retry — acceptable; the reverse (marked but never sent) is not.
     Per-user send failure: logError and STILL mark notified_at (a dead
     address must not wedge the batch loop forever). Return rows processed.
  2. If 5 processed → `step.sleep('sleep-${i}', '1m')` and continue; else done.
- Email copy (friendly): subject "The Engine is back on", body: good news,
  it's generating reports again, link to `${getSiteUrl()}/app`, closing line
  "You asked us to let you know — this is that email, and the only one."
- Register the function wherever the other Inngest functions are served
  (grep `generateReport` for the route that lists them).

## 8. Tests + verification
- Unit tests only where pure logic exists (e.g. if you extract a
  `pickNotifyBatch`/message helper, test it; don't force it).
- Full gate: `npx tsc --noEmit` clean, `npm run lint` at 18, `npx vitest run`
  all green, `npm run build` clean.
- Commit with a descriptive message. DO NOT push. Report: files touched,
  verification output, anything you were unsure about.
