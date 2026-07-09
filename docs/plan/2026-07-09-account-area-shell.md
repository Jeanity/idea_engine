# Plan — Account area shell (sidebar layout, settings, my ideas, in-place report, delete account)

Date: 2026-07-09. Requested by Danny. Execute on Sonnet.

## Goal

Rebuild `/app/account` as a sidebar-navigated area modeled on the admin shell
(`src/app/app/admin/admin-shell.tsx`), with these pages/behaviours:

1. **First-login redirect** — a user with no `profiles.username` set lands on
   the account Settings page (welcome state) after auth, so they add their
   name/username first.
2. **Username is the public identity** — shown in feedback displays and at the
   top of the account area (precedence: username → display_name → fallback).
3. **Left nav** (grouped like admin):
   - Ideas: "New idea" (→ `/app`), "My ideas" (→ `/app/account`)
   - Coming soon: Blog, Articles, Forum — visible but inert placeholders
     (styled disabled, "Coming soon" tag; no dead hrefs)
   - Account: Settings (→ `/app/account/settings`), Log out (reuse
     `SignOutButton`)
4. **Settings page** — the existing `AccountForm` (username, full name,
   country/region, marketing opt-in) moves here, plus the admin-only
   Demo Mode card, plus a **Danger zone** with Delete account.
5. **My ideas page** — the existing ideas list (score rings, status badges,
   Read Report / Download PDF) becomes the account landing page.
6. **In-place report reading** — "Read Report" opens the report INSIDE the
   account shell (no bouncing out of the account area).
7. **Delete account** — self-service, irreversible, full cascade.

## Architecture decisions (do not deviate)

### Routes
```
/app/account                     → My ideas (landing)
/app/account/settings            → Settings + danger zone
/app/account/ideas/[id]/report   → report rendered inside the account shell
```
- New `src/app/app/account/layout.tsx` (server): auth-gate (`redirect('/sign-in')`),
  fetch profile identity fields once, render `<AccountShell …>{children}</AccountShell>`.
- `AccountShell` = new client component `src/app/app/account/account-shell.tsx`,
  copied and adapted from `admin-shell.tsx` (sidebar + topbar + collapse +
  mobile drawer; different nav config, badge says "Account" not "Admin",
  identity block shows username + email). Keep the same styling language.
  Use a different localStorage key: `account.sidebar.collapsed`.
- Do NOT wrap admin routes — this shell is for `/app/account/*` only.

### First-login redirect
- In `src/app/auth/callback/route.ts`, after successful
  `exchangeCodeForSession`: if the profile row has no `username`, redirect to
  `/app/account/settings?welcome=1` instead of `next`. (Query via the service
  client already imported there; best-effort — on query error fall back to
  `next`.)
- Settings page reads `searchParams.welcome` and shows a friendly intro banner
  ("Welcome! Set your username and details…").

### Username precedence
- `src/lib/public-name.ts` holds the public display-name helper used by
  feedback surfaces — flip precedence to `username → display_name → fallback`
  and update its tests (`src/__tests__/public-name.test.ts`).
- Grep for other `display_name ??` / `display_name ?` fallbacks in feedback
  contexts (admin feedback page, dashboard LatestFeedback via
  `/api/admin/dashboard`, `/api/admin/feedback`) and align them.
- Account shell identity block: username first, email under it.

### In-place report
- `src/app/app/ideas/[id]/report/page.tsx` currently does the data fetch +
  renders `report-client`. Extract its body into a shared server component
  `src/app/app/ideas/[id]/report/report-page-content.tsx` (or a lib module)
  that takes the idea id — whatever splits cleanest with minimal diff — then:
  - existing route keeps working unchanged (renders the shared component with
    its own header/layout),
  - new `/app/account/ideas/[id]/report/page.tsx` renders the shared content
    inside the account shell (children of the account layout).
- Update "Read Report" links on the My ideas list to the account-scoped route.
  Keep `ideaHref()` for non-ready statuses pointing at the existing flow
  routes (confirm/questions) — those stay outside the account shell.
- The report page's internal links (edit answers, etc.) may still exit the
  shell — acceptable for now, do not chase them.

### Delete account
- API: `DELETE /api/profile/delete-account` (route.ts). Flow:
  1. `createDbClient()` → `auth.getUser()`; 401 if no user.
  2. Require body `{ confirm: 'DELETE' }` — 400 otherwise.
  3. Service client (only after auth check): delete the user's rows in every
     table that references them. CHECK `supabase/migrations/*.sql` for FK
     `on delete cascade` — anything not cascading from `auth.users` or
     `profiles` must be deleted explicitly (ideas → answers/reports cascade?,
     report_feedback, edit_log, purchases, analytics rows are keyed by
     visitor not user — verify each).
  4. `service.auth.admin.deleteUser(userId)` last.
  5. Log failures via `logError` (`src/lib/log-error.ts`), source
     `api:delete-account`.
  - There is an existing admin-side user delete (`/api/admin/users/[id]`
    DELETE + `src/lib/admin-users.ts`) — REUSE its cascade helper if one
    exists rather than duplicating the table list.
- UI: "Danger zone" card at the bottom of Settings — bordered amber/red-free?
  Project rule: **no red** in the design language generally, but destructive
  actions may use red sparingly (existing admin delete-user button does).
  Follow the existing admin `delete-user-button.tsx` visual precedent.
  Modal/confirm flow (per Danny's standing rule: destructive actions ALWAYS
  need explicit confirmation):
  - Checkbox: "I understand my account, all my ideas, and all reports will be
    permanently deleted."
  - Prominent note: "Download the PDFs of any reports you want to keep before
    deleting — reports cannot be retrieved afterwards, by anyone, including
    support. There is no undelete."
  - Type-to-confirm input requiring the word `DELETE`.
  - Button disabled until both satisfied.
  - On success: call supabase sign-out (client) then hard redirect to `/`.

### Nav placeholders
Blog / Articles / Forum: render as non-link rows (button disabled or span)
with a small "Soon" chip. They must NOT navigate anywhere.

### Misc
- `AppHeader`'s "My ideas" link (`/app/account#your-ideas`) → `/app/account`.
- Old single-page account content is fully superseded: `/app/account/page.tsx`
  becomes the My ideas page (keep the offers banners `OfferBanners` on it).
  The gradient identity card moves to/stays at the top of My ideas (or the
  shell top bar) — keep it somewhere visible with username first.
- Keep all existing functionality: offers, demo-mode toggle (admin only,
  moves to Settings), PDF links, purchase-coming-soon buttons.

## Verification (mandatory before commit)
```
npx tsc --noEmit
npx next build
npx vitest run
```
All three must pass. Also `npx eslint` on touched files if quick.

## Commit
Single commit on `main`, message style: `feat(account): sidebar account area — settings, my ideas, in-place reports, delete account`.
End commit message with `Co-Authored-By: Claude <noreply@anthropic.com>`.
DO NOT push — Danny reviews first.

## Out of scope
- Real Blog/Articles/Forum pages.
- Stripe/purchase wiring.
- Encrypting anything.
- Changing the admin area.
