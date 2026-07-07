# Master Plan — Admin Backend + User Feedback/Ratings

Written 2026-07-07 by Fable for execution by cheaper models (Danny may lose Fable
access). Each block below is self-contained: a fresh session given ONE block plus the
"Ground rules" section should be able to execute it without further context. Execute
blocks in dependency order. One block = one plan-file + one implementation session,
per Danny's standing workflow (plan → subagent → HANDOFF.md for open items).

## Model routing (Danny's rule: cheapest capable model)
- **Haiku** — mechanical CRUD, table scaffolds, copy-paste UI variants of existing pages.
- **Sonnet** — default for all implementation blocks below unless marked otherwise.
- **Opus** — blocks marked ⚠️ (architecture judgement: Block 2 event pipeline, Block 4
  link-rewriting, Block 9 integration decisions). Also user-facing sales copy review.
- Never hand a block to a model that can't evaluate its own output; skip + report instead.

## Ground rules (read before any block)
- Stack: Next.js 16 App Router + TS, Supabase (Postgres + Auth + RLS), Inngest,
  Tailwind (dark `slate-950` default + `light:` variants), vitest. Repo: E:\idea-engine.
- Admin gate: `isAdminEmail(email)` from `src/lib/admin.ts` (comma-separated
  `ADMIN_EMAIL` env, already supports multiple admins). NEVER invent a second admin
  mechanism. All admin API routes: 401 no user / 403 not admin (pattern:
  `src/app/api/profile/demo-mode/route.ts`).
- RLS is owner-only on all tables. Admin pages that read OTHER users' data must use
  `createServiceClient()` (`src/lib/db.ts`) **after** the `isAdminEmail` check —
  never before, never in client components.
- Migrations: numbered SQL files in `supabase/migrations/`, run manually by Danny in
  the Supabase SQL editor. Hand-edit `src/lib/database.types.ts` to match (no codegen).
  Next free number at time of writing: **004**.
- Verify every block: `npx tsc --noEmit`, `npm run lint` (6 pre-existing errors are
  known — introduce zero new), `npm run test`, `npm run build`.
- Product voice: encouraging, evidence-grounded, never "teaser" (say "initial
  report"). No red in score/data visuals (project design language).
- Stripe is NOT wired yet (Phase 5 of the main plan). Blocks 6/7 build tables + UI
  that Phase 5 plugs into; they must not block on Stripe.
- Charts: use **recharts** (React-19-compatible; add as dependency in the first block
  that needs it). Keep charts to line/bar; no red for negative trends (amber).
- **Deletion always confirms.** ANY destructive action (delete account, remove
  affiliate link/offer, clear data) MUST require explicit confirmation in the UI
  before it fires — no one-click deletes. For high-stakes deletes (user accounts)
  require typing the target's identifier to confirm. Applies to every block.

## Dependency order

```
Block 1 (admin shell)
  ├── Block 2 ⚠️ (analytics events)  ──► Block 3 (usage dashboard) ──► Block 8 (graphs)
  ├── Block 4 ⚠️ (affiliate links)
  ├── Block 5 (user management)
  ├── Block 6 (discounts/offers)     ──► [Stripe Phase 5 plugs in]
  ├── Block 7 (sales & costs)        ──► [Stripe Phase 5 plugs in]
  └── Block 9 (feedback & ratings)   ──► homepage testimonials
```

---

## Block 1 — Admin shell (`/app/admin`) — Sonnet, small

New route group `src/app/app/admin/` with:
- `layout.tsx`: server component; `auth.getUser()` → `isAdminEmail(user.email)` else
  `redirect('/app')`. Renders `AppHeader` + an admin sub-nav (tabs: Dashboard,
  Affiliates, Users, Offers, Sales, Feedback — links can 404 until later blocks).
- `page.tsx`: placeholder dashboard (Block 3 fills it).
- Add an "Admin" link in `src/components/app-header.tsx` visible only when
  `isAdminEmail(email)` (same spot as the Demo/Live pill).
- Shared `src/app/app/admin/admin-nav.tsx` for the tabs.
Acceptance: non-admin hitting /app/admin is redirected; admin sees shell + nav.

## Block 2 ⚠️ — Analytics foundation (events + sessions + referrers) — Opus

Everything in Blocks 3/8 (users online, traffic, returning visitors, referrer/campaign
reports) reads from this. Design goal: ONE append-only events table, written cheaply,
aggregated by Postgres.

### Migration 004 (this block's part)
```sql
create table public.page_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  session_id uuid not null,          -- anonymous, cookie-held
  user_id uuid null,                 -- filled when signed in
  path text not null,
  referrer text null,                -- document.referrer, first page of session only
  utm jsonb null,                    -- {source,medium,campaign,term,content}, first page only
  is_new_session boolean not null default false
);
create index page_events_occurred_idx on public.page_events (occurred_at);
create index page_events_session_idx  on public.page_events (session_id, occurred_at);
alter table public.page_events enable row level security; -- no public policies: service-role only

alter table public.profiles add column last_seen_at timestamptz null;
alter table public.profiles add column acquisition jsonb null; -- first-touch {referrer, utm, landing_path}
```

### Capture
- Client beacon component mounted in the ROOT layout (public site + app): on route
  change, `navigator.sendBeacon('/api/track', …)` with path; on first hit of a session
  (no `ie_sid` cookie) also send `document.referrer` + parsed UTM params and set the
  cookie (uuid, 30-min rolling expiry → session semantics; also a persistent `ie_vid`
  visitor cookie for returning-visitor counts — store visitor id in the event too if
  the implementer prefers; decide and document).
- `/api/track` route: validates a small allowlist of fields, service-role insert.
  MUST be fire-and-forget fast, no auth required (public pages track too); rate-limit
  naive (reject bodies > 1KB, paths not starting with '/').
- Signed-in heartbeat: same beacon includes auth'd user via server cookie session —
  the route updates `profiles.last_seen_at` (throttle: only if > 60s stale).
- First-touch attribution: on signup (`auth/callback` or profile-creation point),
  copy the session's referrer/utm/landing_path into `profiles.acquisition`.
- Respect DNT? No — but keep data minimal: no IP, no UA stored (privacy stance).

### Aggregation
Postgres functions (security definer, service-role-called RPCs) for: sessions/day,
pageviews/day, unique visitors/day, returning visitors/day, top referrers, top UTM
campaigns — each over an arbitrary `from`/`to` range. Unit-test date-bucketing logic
that lives in TS.

Acceptance: browsing the site produces rows; an admin-only test RPC returns sane
counts; signup stores acquisition.

**Open decision for Danny (record in HANDOFF when built): GA4 as well?**
Recommendation: self-owned events are the primary source (no consent banner needed if
no cookies beyond functional — NOTE: the session/visitor cookies here are borderline;
if Danny wants zero-cookie, switch session_id to a server-derived daily hash and lose
returning-visitor precision). GA4 can be added later purely by pasting the gtag
snippet — do not build dashboards against GA4.

## Block 3 — Usage dashboard (reports, users online, periods) — Sonnet

Fills `/app/admin` (Dashboard tab):
- **Users online now**: `profiles.last_seen_at > now() - 5 min` (count, service role).
- **Reports generated**: live (running now — `reports.status in (queued,running)`),
  last hour / today / this week / this month / custom range — from
  `reports.generation_completed_at`, split initial vs full (full = `sections` has
  `competitors` key; see `reportDisplayState` in `src/app/app/account/page.tsx`).
- **Ideas created**, **signups** (profiles.created_at) for the same period picker.
- Period picker component (Today / 7d / 30d / custom from-to) reused by Blocks 7/8 —
  build it as `src/app/app/admin/period-picker.tsx`.
- Auto-refresh the "live" numbers every 30s (client polling a single admin stats API
  route: `/api/admin/stats?from=&to=` returning all counts in one shot).
Acceptance: numbers match hand-run SQL for a seeded range; non-admin gets 403.

## Block 4 ⚠️ — Affiliate links + click tracking — Opus (rewrite engine), Sonnet (CRUD)

### Migration (next free number)
```sql
create table public.affiliate_links (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,            -- /go/<slug>
  name text not null,                   -- "Vistaprint"
  target_url text not null,             -- full affiliate URL incl. tracking params
  match_domains text[] not null default '{}',  -- ["vistaprint.com","vistaprint.co.uk"]
  match_terms  text[] not null default '{}',   -- ["business cards","flyer printing"] (optional, see engine notes)
  active boolean not null default true,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.affiliate_clicks (
  id bigint generated always as identity primary key,
  link_id uuid not null references public.affiliate_links(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  context text null,        -- e.g. 'report:<idea_id>', 'homepage'
  user_id uuid null,
  referrer_path text null
);
-- RLS on, no public policies (service-role only)
```

### Pieces
1. **Admin CRUD page** (Affiliates tab): list with per-link click counts (7d/30d/all),
   add/edit/deactivate. Sonnet/Haiku.
2. **Redirect route** `src/app/go/[slug]/route.ts`: look up active slug (service
   role), insert click row (await-less best effort), 302 to `target_url`. Unknown
   slug → redirect to `/`. No auth required.
3. **Rewrite engine** ⚠️ `src/lib/affiliate-rewrite.ts`: pure function
   `rewriteAffiliateUrls(sections, links)` applied where report sections are DELIVERED
   (web report API/page load + PDF route) — NOT at generation time, so links added
   later apply to old reports and removed partnerships disappear retroactively.
   - v1 scope: **domain matching only.** Walk the sections JSON; any string value that
     is a URL whose host ends with a `match_domains` entry → replace with
     `${origin}/go/${slug}?ctx=report:${ideaId}`. Keep display text unchanged.
   - `match_terms` (plain-text mentions like "print business cards at Vistaprint"
     with no URL) is a **v2 stretch** — do NOT attempt LLM-based injection in v1; if
     attempted later it must be a deterministic term→append-link pass, never a model
     call per render.
   - Unit-test heavily (nested JSON, arrays, non-URL strings, already-rewritten URLs).
4. **Disclosure line** (legal, FTC/ASA): wherever rewritten links can render — report
   web footer + PDF footer — add: "Some links in this report may be affiliate links.
   They never affect our recommendations." Add it unconditionally (simpler + safer).
Acceptance: seeded Vistaprint link + a report containing a vistaprint.com URL renders
/go/vistaprint, click lands a row and 302s correctly, PDF shows rewritten URL + disclosure.

## Block 5 — User management — Sonnet

Users tab:
- **List**: all profiles (service role) with email (join `auth.users` via
  `supabase.auth.admin.listUsers()` — pages of 50), created_at, last_seen_at, idea
  count, report count, search by email/username.
- **Detail view** (`/app/admin/users/[id]`): profile fields, acquisition (Block 2),
  ideas + report statuses, purchases (Block 7), feedback left (Block 9). Read-only
  except the actions below.
- **Add account**: `supabase.auth.admin.createUser({ email, email_confirm: true })`
  or `inviteUserByEmail` — prefer **invite** (sends the magic link; no password
  handling). Requires SMTP configured in Supabase — if not configured, surface the
  error cleanly and note it in HANDOFF.
- **Remove account**: `supabase.auth.admin.deleteUser(id)` + rely on FK cascades —
  ⚠️ CHECK 001_initial_schema.sql for `on delete cascade` from profiles→ideas→
  answers/reports; if absent, migration must add it or the delete route must delete
  child rows explicitly, in order. Confirm dialog requires typing the user's email.
  Admin cannot delete an admin account (guard by `isAdminEmail`).
Acceptance: invite creates a pending user; delete removes user + all owned rows; both
actions logged to console with admin email + target id (poor-man's audit trail).

## Block 6 — Discounts & special offers — Sonnet

Pre-Stripe scaffolding; Phase 5 maps codes to Stripe promotion codes later.

### Migration
```sql
create type public.offer_audience as enum ('new_users','account_holders','everyone');
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,             -- "LAUNCH20"
  description text not null,             -- shown to users
  percent_off int null check (percent_off between 1 and 100),
  amount_off_cents int null,             -- alternative to percent
  audience public.offer_audience not null default 'everyone',
  show_on_homepage boolean not null default false,
  show_in_account boolean not null default false,
  starts_at timestamptz not null default now(),
  ends_at timestamptz null,
  max_redemptions int null,
  redemption_count int not null default 0,
  active boolean not null default true,
  stripe_promotion_code_id text null,    -- filled by Phase 5
  created_at timestamptz not null default now()
);
```

- Admin CRUD (Offers tab) with live/expired/scheduled status chips.
- **Display surfaces**: homepage banner (public — only offers with
  `show_on_homepage`, audience `new_users` or `everyone`); account-page banner
  (signed-in — `show_in_account`, audience `account_holders` or `everyone`;
  "new_users" = profile created < 7 days ago, constant in one place).
- "Sent to users" (email) is OUT OF SCOPE until an email provider exists — note in
  HANDOFF when built. Redemption/enforcement is Phase 5's job; this block only
  creates + displays.
Acceptance: an active homepage offer renders on `/` for signed-out visitors; account
banner respects audience; expired/inactive never render.

## Block 7 — Sales & cost tracking — Sonnet

- **Costs**: today only full reports carry cost (`sections._meta.cost_usd`) and the
  teaser's cost isn't persisted. Migration: `reports.cost_usd numeric null`; update
  `generate-teaser.ts` and `generate-report.ts` to write their summed `costUsd` there
  (teaser adds its cost; full pipeline adds total incl. teaser if rerun — keep it
  simple: column = total spent on this report row to date, incremented per run).
- **Sales**: `purchases` table already exists (Stripe fills it in Phase 5). Build the
  admin Sales tab against it now: revenue, refunds, net, per period (reuse
  period-picker), joined with cost → margin per report and aggregate P&L. Shows $0
  revenue until Phase 5 — that's fine and expected.
- Include Anthropic spend total per period even where no sale exists (demo runs cost
  $0 — demo_mode rows will naturally record 0).
Acceptance: seeded purchase rows + real cost rows produce correct totals per period.

## Block 8 — Growth graphs — Sonnet (needs Blocks 2, 3, 7)

Dashboard tab additions, all recharts, all driven by the Block 2 RPCs + Block 3 stats
API + Block 7 tables, sharing the period picker:
- Traffic: sessions + unique visitors per day.
- Returning visitors per day (visitor-cookie based).
- Reports generated per day (initial vs full stacked).
- Signups per day.
- Sales & margin per day (post-Phase 5 it lights up).
- Referrers/campaigns table: top sources with sessions → signups → reports →
  purchases conversion columns (join acquisition + events). This is the "are my ad
  campaigns effective" view — campaign = utm_campaign, source = utm_source/referrer host.
Acceptance: charts render with seeded data; empty states don't crash; date ranges align
across charts (UTC vs local — pick UTC, label it).

## Block 9 ⚠️ — Feedback & ratings on the final report + testimonials — Opus copy review, Sonnet build

### Migration
```sql
create table public.report_feedback (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text null,
  allow_public boolean not null default false,  -- user consent to quote
  featured boolean not null default false,      -- admin picked for homepage
  created_at timestamptz not null default now(),
  unique (report_id)
);
-- RLS: insert/update own (user_id = auth.uid()), select own; admin ops via service role
```

### User side
- Feedback card at the END of the web report view (`report-client.tsx`, after the last
  tab/content, before the PDF button area): 5-star picker + optional comment textarea +
  checkbox "You may quote my feedback publicly (first name / display name only)".
  One per report; editable after submit (upsert). Thank-you state after save.
- POST `/api/ideas/[id]/report/feedback` (owner-gated via RLS pattern like
  `answers/route.ts`).
- Also mention feedback in the PDF appendix callout? One line max ("Tell us how we
  did — leave a rating on your report page."). Optional, implementer's call.

### Admin side
- Feedback tab: list all (service role), filter by rating, toggle `featured` (only
  where `allow_public`), average rating stat + ratings histogram.

### Homepage testimonials
- Section on `/` rendering `featured` feedback: stars, quote, display name (fall back
  to "Verified founder"), archetype of the idea. Match existing landing-page design
  language (dark, glow blobs, no AI-isms — see `src/app/page.tsx` marquee style).
  Never invent placeholder testimonials — section hides entirely when none featured.

**Trustpilot / Judge.me decision** (Danny raised): Judge.me is Shopify/e-commerce-
oriented — poor fit. Trustpilot free tier is viable later for external credibility but
can't be seeded from in-app ratings (their rules require organic invites). Recommend:
native ratings now (this block, $0, full control), revisit Trustpilot only when
there's real volume. Record whatever Danny decides in HANDOFF.

Acceptance: rate a report → row saved; toggle featured → appears on homepage; without
consent checkbox the feedback can never be featured (enforce in API, not just UI).

---

## Decisions Danny must make along the way (HANDOFF items as blocks land)
1. GA4 alongside self-owned analytics? (Block 2 — recommendation: not yet.)
2. Zero-cookie analytics vs returning-visitor precision (Block 2).
3. Supabase SMTP/invite email setup (Block 5 needs it for "add account").
4. Email provider for sending offers to users (Block 6 — out of scope until chosen).
5. Trustpilot later? (Block 9 — recommendation: native only for now.)
6. Affiliate programs to actually sign up for (Vistaprint = Awin network; ad-network
   and SaaS referral programs each have their own approval flows — the admin CRUD
   takes any URL, so this is pure business admin, no code).

## Suggested execution order & rough effort
| Order | Block | Model | Size |
|---|---|---|---|
| 1 | 1 admin shell | Sonnet | S |
| 2 | 2 analytics foundation | **Opus** | L |
| 3 | 3 usage dashboard | Sonnet | M |
| 4 | 9 feedback & ratings | Sonnet (+Opus copy pass) | M |
| 5 | 4 affiliate links | **Opus** engine / Sonnet CRUD | L |
| 6 | 5 user management | Sonnet | M |
| 7 | 6 discounts & offers | Sonnet | M |
| 8 | 7 sales & costs | Sonnet | S–M |
| 9 | 8 growth graphs | Sonnet | M |

Rationale: feedback (9) early — every report generated before it ships is a lost
testimonial. Affiliate links (4) next — revenue-adjacent. Sales dashboards (7/8) are
low value until Stripe Phase 5 approaches.
