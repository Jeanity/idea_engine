# Plan D — admin-only Demo/Live mode toggle

## Goal
The admin account (email === `ADMIN_EMAIL`) gets a switch in the Account area that
turns real AI API usage off/on **for their own account only**. When Demo Mode is on,
report generation for that account's ideas uses the free mock fixtures instead of
Anthropic. The current mode shows in the top navigation bar as **Demo Mode** /
**Live Mode** — visible to the admin only. Normal users see and get nothing.

## Mechanism
`profiles.demo_mode boolean` (migration shared with Plan C). The Inngest pipeline
looks up the idea owner's `demo_mode` and, when true, forces the `mock` provider on
every `callAI` call — same code path as `AI_PROVIDER=mock`, which reads fixtures from
`src/lib/fixtures/` at $0. Env `AI_PROVIDER` stays as the process-wide default;
`demo_mode` is a per-call override.

## Files
- `supabase/migrations/003_edit_log_and_demo_mode.sql` — shared with Plan C
- `src/lib/database.types.ts` — profiles `demo_mode: boolean` (Row; optional in Insert/Update)
- `src/lib/ai.ts` — per-call provider override
- `src/lib/demo-mode.ts` — NEW: owner lookup helper
- `src/lib/inngest/generate-teaser.ts`, `src/lib/inngest/generate-report.ts` — use it
- `src/app/api/profile/demo-mode/route.ts` — NEW: admin-only toggle endpoint
- `src/app/app/account/page.tsx` + NEW `src/app/app/account/demo-mode-toggle.tsx`
- `src/components/app-header.tsx` — mode badge

## Steps

### 1. `callAI` override
Add `provider?: 'anthropic' | 'mock' | 'ollama'` to `CallOptions`. In `callAI`:
`const provider = options.provider ?? process.env.AI_PROVIDER ?? 'anthropic'`.

### 2. Owner lookup helper
`src/lib/demo-mode.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js'

/** 'mock' when the idea owner has demo mode on, undefined otherwise. */
export async function providerOverrideForUser(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.from('profiles').select('demo_mode').eq('id', userId).single()
  return data?.demo_mode ? ('mock' as const) : undefined
}
```
(Match the client typing used elsewhere — `createServiceClient` in `src/lib/db.ts`.)

### 3. Pipeline
Both Inngest functions already receive `userId` in `event.data` (sent by
`/api/reports` and `/api/reports/full`). At the top of `generate-teaser` and
`generate-report`, resolve `const provider = await providerOverrideForUser(supabase, userId)`
and pass `provider` into **every** `callAI` call in that function. Verify
`generate-report.ts` actually destructures `userId` from the event; add it if not.

### 4. Toggle endpoint
`src/app/api/profile/demo-mode/route.ts` — POST, body `{ demo_mode: boolean }`:
- 401 if no user; 403 if `user.email !== process.env.ADMIN_EMAIL` (same pattern as
  `src/app/api/reports/full/route.ts`).
- Validate body, `update profiles set demo_mode where id = user.id`, return `{ ok, demo_mode }`.

### 5. Account page section
- In `src/app/app/account/page.tsx`, compute `isAdmin = user.email === process.env.ADMIN_EMAIL`
  and read `demo_mode` in the existing profile select.
- When admin, render a card (matching the existing card styles) titled **"AI usage —
  admin"** above/below the profile form: explanation line ("Demo Mode answers report
  runs from canned fixtures — no API spend. Applies to your account only.") and the
  toggle component.
- `demo-mode-toggle.tsx` (`'use client'`): a switch showing the current state
  (amber pill "Demo Mode" when on, emerald pill "Live Mode" when off), POSTs to the
  endpoint, `router.refresh()` on success, disabled while in flight, inline error on
  failure. Style consistent with `account-form.tsx`.

### 6. Nav badge
`src/components/app-header.tsx` is a server component receiving `email`:
- `const isAdmin = email === process.env.ADMIN_EMAIL`; when admin, fetch
  `profiles.demo_mode` with the client it already creates (`auth.getUser()` isn't
  needed — select own row via RLS: `.select('demo_mode').single()` scoped by RLS to
  the signed-in user; if RLS scoping isn't guaranteed, get the user id from
  `supabase.auth.getUser()`).
- Render next to the nav links: a small pill — Demo Mode: `bg-amber-500/15
  text-amber-300 light:bg-amber-100 light:text-amber-700`; Live Mode:
  `bg-emerald-500/15 text-emerald-300 light:bg-emerald-100 light:text-emerald-700`.
  Non-admins: render nothing.

## Verify
- `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm run test` pass.
- Grep both Inngest functions to confirm no `callAI` call was left without the
  `provider` pass-through.
