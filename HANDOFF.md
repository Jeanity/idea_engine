# Handoff — 2026-07-13 (launch hardening + customer support)

All on main through `9c45be8`; no new migrations (027/028 were already run).

1. **Inngest concurrency caps** — generate-report 8, generate-teaser 25. Under burst
   load reports now QUEUE instead of blowing Anthropic TPM and degrading to PARTIAL.
   Tune the 8 with the Anthropic tier (also mirrored in queueWaitLabel, report-client).
2. **Demo mode, sitewide + per-user**: app_settings 'demo_mode_global' (admin Settings
   card toggle; red "Site Demo" header pill) + admin can flip any user's demo_mode from
   the admin user-detail page (/api/admin/users/[id]/demo-mode). Demo now also mocks
   classify + dynamic-questions, so a demo account's whole intake→report flow is $0.
   Test recipe: non-admin account (admins never see promo overlays) + demo ON.
3. **Queue-aware progress screen**: after 25s queued → "you're in line" + rounded-UP
   ETA (never a position number); "High demand" line at depth ≥10 only; full-report
   runs show the "we'll email you" release valve. GET /api/reports returns queueDepth
   (bare count) while the caller's report is queued.
4. **Full-report run visuals**: 6-gear cluster (geometry verified meshing) + "Generating
   your full report" heading; teaser keeps the 3-gear original. Run type = click-time
   hint + preview_sections-preserved heuristic (survives refresh).
5. **Survey gates E2E-VERIFIED by Danny** (both overlays working live). Root cause of
   "not working" was the promo card's save button not reading as covering the survey
   dropdowns — now labeled "Save caps & surveys". Full checklist lives in the promo-card
   / survey.ts comments.
6. **Customer support — pre-payments slice DONE** (`9c45be8`): admin Purchases &
   refunds section on Sales (record/undo refund w/ two-step confirm, Stripe payment
   deep link, email-enriched + filterable; record-keeping only until payments wires the
   Stripe API); /support hub page (stable URL for future receipts) + footer/sitemap;
   FAQ refund + purchase-help entries (JSON-LD included); /contact?category= prefill.
   Still deferred to payments build: order-confirmation email, My purchases
   self-service, live Stripe refund call.
7. **Footer everywhere it belongs** (Danny's scoping, 2026-07-13): public pages
   (already had it) + /app intake page + report views (teaser/full). Deliberately NOT
   on the generation funnel (questions/confirm/progress — no exit links mid-flow);
   progress screen's ERROR state gets a /support link instead (help exactly where it's
   needed). Account sidebar gains a Help group (FAQ/Contact/Support) — rides the
   existing mobile hamburger drawer. Footer is print:hidden; react-pdf never saw it.

**FILED WITH PAYMENTS TASKS (Danny, 2026-07-13): user credits.** Admin needs a way to
grant a free full-report generation credit (or other credit types) to a user account —
e.g. goodwill after a support issue, comps, promos. Deliberately waiting for the
payments build to define what a "credit" IS (a row that satisfies the unlock gate the
same way a purchase does), so the grant mechanism and the purchase path share one
model instead of bolting a parallel freebie system on later. Natural home: admin
user-detail page action + a credits/entitlements table designed alongside purchases.

Danny-side done: Vercel MAIL_FROM display name now HadIdea. Still open from 07-11
list: Supabase auth email templates check, logo, smexy device check. GSC/Bing tokens
still pending.

---

# Day wrap — 2026-07-11 (all shipped to main + prod)

Everything below is live: c4af64e stepped survey → b5932c1 HadIdea rebrand → 1a222c7
smexy mode → 93510cc homepage "Every report includes" refresh → 9a1cd80 smexy as DEFAULT
(dark = kill-switch fallback) → 363aa21 roaming aurora (blobs cross the screen and bounce
off edges). Tests 266 green throughout; no new DB migrations — the smexy flag uses the
existing app_settings KV (no row needed until first admin toggle; missing key = ON).

**Danny's to-do list (nothing blocking, no migrations):**
1. Vercel env `MAIL_FROM` display name still says "Idea Engine" → change to HadIdea.
2. Supabase dashboard: check auth email templates (magic link) for the old name.
3. Eyeball smexy on real devices/prod; Admin → Settings → "Smexy mode" is the instant
   revert-to-dark switch if anything looks off.

**Tomorrow: logo.** Danny is iterating on a candidate (green rounded-square "hi" mark —
h + dotted i, first letters of HadIdea; reads slightly like a puppy, undecided if bug or
feature). Agreed spec when finalising: transparent background; SVG master; square mark
1:1 on a 1024×1024 canvas (safe zone: inner ~820px for circle crops); horizontal lockup
4:1 on 1600×400 with ~40px baked padding; wordmark needs BOTH colorways (white for
smexy/dark, dark for light) since transparency alone doesn't solve text contrast; PNG @2x
exports for email (SVG unsupported in many clients — mailer currently uses a text
wordmark); consider an indigo→fuchsia aurora-gradient variant to match the new house
style. Green + navy as-is clashes with the smexy palette.

# Smexy is now the DEFAULT theme (2026-07-11, same night)

Danny: "I love it… dark mode replaced." `.smexy` is baked into the SSR <html> class;
the toggle cycles smexy ↔ light (sun/sparkles icons). Classic dark still exists in CSS
(smexy layers on it) but is only reachable as the fallback when the admin kill switch is
OFF: then the default reverts to dark, the toggle is the old dark ↔ light, saved smexy
demotes to dark, and ThemeToggle caches the flag in localStorage('smexy_off') so the
no-flash init script keeps later first paints correct (first load after a flip paints
smexy once). Re-enabling promotes fallback-dark visitors (no explicit choice) back to
smexy. Full matrix click-verified: default paint, both cycles, light persistence,
demote/promote, cache behaviour.

# Smexy mode — third theme (2026-07-11)

Danny asked for a third "wow" theme next to dark/light. Shipped as `.smexy` on <html>
(ThemeToggle cycles dark → light → smexy; sparkles icon): dark mode stays the base and a
pure-CSS layer in globals.css ("Smexy mode" section) adds an animated aurora behind every
page, liquid-glass cards (targets the app's own bg-slate-900/80 convention), gradient CTAs
(bg-indigo-500), a silver-sheen gradient on h1s, film grain, and themed scrollbar/selection.
No component markup changed except ThemeToggle + the layout init script.
**Landing-page exception**: its dark sections sit on an opaque white wrapper (light lower
half), so translucent shells there composite to grey — inside .bg-white wrappers the shells
stay solid and the hero's own blobs get boosted (saturate/brightness) instead.
**Kill switch (Danny's ask)**: app_settings 'smexy_theme' (default ON, src/lib/smexy.ts),
card in Admin → Settings, /api/admin/smexy (GET/PATCH, admin-gated — 401 verified) +
public /api/theme-modes read by ThemeToggle; when off, the mode leaves the cycle and saved
'smexy' visitors demote to dark next load (click-verified via temporary route stub).
Print/PDF and prefers-reduced-motion are handled; light + dark verified pixel-unchanged.
Dev note: Turbopack's persistent .next cache in this Windows worktree silently served stale
CSS across dev-server restarts — if edits don't show up, delete .next.

# Rebrand: Idea Engine → HadIdea (2026-07-10)

Product renamed **HadIdea** (camel case in text/titles, `HADIDEA` PDF wordmark) to match
the live hadidea.com domain. Swept all user-facing copy: page titles/metadata, header +
footer + sidebar wordmarks, sign-in, about/FAQ/terms/privacy/sample-report, email chrome
defaults + admin reply/invite emails, PDF cover + disclosure lines, download filenames
(`hadidea-report-*.pdf`), .env.example MAIL_FROM display name, start.bat, package name.
Deliberately NOT renamed (internal, breakage risk, invisible to users): Inngest app id +
event names (`idea-engine/...`), promo IP_HASH_SALT, repo folder/URL, .claude agent defs,
historical docs/plan files. Post-report survey also reworked same day: one question per
step with progress bar + Back/Next (survey-card.tsx).
**Manual follow-ups outside the repo**: Vercel env `MAIL_FROM` still says
"Idea Engine <reports@hadidea.com>" → change display name to HadIdea; check Supabase auth
email templates (magic link) for the old name; Inngest dashboard app name is cosmetic.

# ❓ DECISIONS NEEDED FROM DANNY — question-flow audit, 2026-07-10 evening

Two-researcher user-simulation audit of the question flow (per Danny's ask after the
bottle bugs). ALL mechanical fixes SHIPPED same evening (2 Sonnet implementers,
Fable-reviewed, 248 tests green):
- **Stale hidden-branch answers no longer reach reports** (report gen, teaser, PDF
  appendix, summary — new src/lib/question-bank.ts filterVisibleAnswers).
- **parseNumber hardened**: free-text like an ingredient list can no longer become a
  billion-dollar materials cost in the deterministic calculator (now honest omission).
- **Region gating extended**: ecommerce_brand never asks region (online-only by
  definition); marketplace asks only for "One city" scope; in-person content_education
  teachers now DO get asked (their option notes promised local research).
- **Invention hardware branch**: device inventions now collect who-will-make/unit-cost/
  packaging (the classifier sends manufactured-novelty ideas here now).
- Equipment list de-fooded + "None of these yet" escape (was a hard block for candle
  makers); dropship/POD capital subtext fixed; workshops monetisation option added;
  free-with-ads apps skip the target-price question; non-food examples added.

## Capacity hardening (Danny's launch-capacity questions, same evening)
- **Generation rate limiting SHIPPED** (Sonnet implementer, Fable-reviewed): max 5 new
  ideas/hour per account + 10-min cooldown between forced regenerations of the same idea
  (per-account teaser spend ceiling ~US$1/hour). **Admins and paying customers (any
  completed purchase) bypass entirely** — Danny: "if they pay for 5 reports they can do
  5 in 2 minutes". Stale-rescue path preserved; friendly 429. Also fixed a PRE-EXISTING
  bug: RegenerateButton ignored POST failures → infinite "Generating…" spinner.
  Known gap (accepted): retrying a FAILED report hits neither guard — failures aren't
  user-inducible cheaply; revisit in the security audit if needed.
- **Email ceiling researched**: IONOS caps sends PER HOUR by mailbox age — 50/h (first
  week) → 100/h → 400/h → 500/h after 30 days. Mailboxes created 2026-07-10, so full
  rate lands ~Aug 10 (≈ launch). sendMail failures already logError → admin Errors red
  badge, so a hit ceiling is visible. Transactional provider only needed at real scale.
- **Anthropic capacity** (per current docs): Start tier = US$500/month spend cap (the
  real wall — pauses API until next month), 1,000 RPM / 2M ITPM per model (non-issue).
  Pre-launch: check tier on Console→Limits, enable credit auto-reload + low-balance
  alerts; request Build tier if trial pace outgrows $500/month.

## Also shipped same evening (Danny's live-testing feedback)
- **Cost questions never required** (Danny: "no way to know that with no experience"):
  unit-cost/packaging questions reframed "only if you already know" + AI cost fallback
  (see resolved decision 1 above).
- **Teaser morsels** (Danny: "no promises of any kind of valuable information"): the
  teaser call now also writes 1–2 idea-specific hook sentences per locked section
  (rendered fading into the blur) and a cost_preview whose AMOUNTS show while labels
  are redacted server-side ("a true teaser"). Plus two teaser bugs fixed: the
  next_steps_preview/next_steps key mismatch (the "Where to start" card never rendered
  from real teasers), and truncation-prone maxTokens 1024→2048 with shape validation
  (throw → Inngest retry instead of storing a malformed snapshot — the cause of Danny's
  "Viability Snapshot unavailable" run). EXISTING teasers predate hooks — regenerate the
  initial report to see the new gated view. **CLICK-VERIFIED by Danny on prod** (bottle
  teaser: hooks + amount-only cost rows + constructive verdict all rendering; "would
  certainly encourage a user to buy the full report"). Teaser prompt also now inherits
  EXPERT_PARTNER_PREAMBLE (it was the only surface without the no-bad-ideas persona) +
  a constructive-realism verdict rule — gaps must name the staged path the founder's
  budget CAN fund. NOTE: the teaser-gating toggle is currently ON in prod from testing —
  Danny to decide whether it stays on during the free trial (gated teaser + free unlock
  may actually drive more full-report generations) or goes off per the original plan. Invention category renamed to "Physical
  product / device" (+ Design gates manufacturing questions too).

These need YOUR call — answer in any order:

1. ~~Materials cost for self-made products~~ **RESOLVED by Danny's later directive**
   ("costs should be estimated by the report, not the user"): cost questions are now
   optional "only if you already know" inputs, and generate-report falls back from the
   free deterministic calculator to the AI estimate-costs step whenever materials/unit
   cost inputs are blank or unparseable (`needsAiCostFallback`, path recorded in
   _meta.section_status: live_ok vs fallback_inferred — watch that ratio in admin to
   learn real COGS before the $4.95 phase).
2. **Invention: license-only vs build-and-sell.** The invention bank treats every inventor
   as building a business. A commercialization-path question could branch: licensors get
   royalty/deal research instead of unit costs. Build it? (Hardware inventions DID just
   get manufacturing cost questions — this is about the licensing path.)
3. **Archetype confirm step.** The override dropdown gives no explanation of what each
   archetype means (your bottle sat exactly on such a boundary), and overriding does NOT
   regenerate the one-line restatement (written for the original archetype). Add short
   descriptions + regenerate restatement on override (one extra small AI call)?
4. **local_service assumes solo operators.** No staffing/headcount question exists (no
   maps_to key for it), so an employee-based business (e.g. cleaning company with crews)
   is priced on the founder's own hours. Add a staffing question + key?
5. **marketplace never asks its differentiator.** Its demand-side question is wired into
   the 'differentiator' slot the competitor research reads — so competitor research gets
   a customer description instead of what makes the marketplace different. Add a real
   differentiator question + dedicated key, and re-home the demand-side answer?
6. **(FYI, no action needed)** physical_product's "which equipment do you own" answer is
   collected but consumed by nothing in the deterministic path — worth wiring into
   startup-cost logic during the materials fix (1), whichever option you pick.

---

# Handoff — 2026-07-10 AFTERNOON (Teaser gating + local-day charts)

Two builds, verified together (tsc/lint/build/211 tests clean). NOT click-tested (auth).

## Migration 026 — RUN ✅ in prod (Danny confirmed 2026-07-10)
Migrations current through **026 — ALL RUN in prod.** (027 in flight, see below.)

## Decisions + queue changes (Danny, 2026-07-10 afternoon)
- **Launch deferred ~3 weeks → early-to-mid August.** No rush on payments. Danny-side in
  the meantime: logo (in progress today), then Google brand verification; new PayPal
  business account (started looking now).
- **Customer support Phase 1 DONE** (Sonnet subagent, Fable-reviewed+merged):
  "Billing & refunds" category on /contact (+ Terms refund-policy hint), rose-flagged rows
  + filter chip in the admin queue, [Contact — BILLING] notification subject.
  Migration 027 — RUN ✅ in prod (Danny confirmed 2026-07-10). Migrations current
  through **027 — ALL RUN in prod.**
  Phase 2 (refund workflow, order emails, My purchases) stays blocked on payments —
  see docs/plan/2026-07-10-customer-support.md.
- **Survey v2.1 PLANNED, not built** — docs/plan/2026-07-10-survey-v2.1-when-targeting.md
  (date windows + account-age targeting + post-purchase surface). Danny decides
  build timing based on usage.
- **Multi-admin: all admins get complete control** — only candidates are fully-trusted
  family; the is_admin mechanism can be a simple boolean/email-list, role-gating only if
  ever needed. (Still needed before admin #2 exists at all.)
- **Real stats for demo-stats.ts: wait until post-trial** (need real data first), but
  build it behind an admin switch (app_settings, e.g. 'real_stats') so flipping from
  demo numbers to live aggregates is a toggle, not a deploy.
- **Teaser gating section-tuning**: Danny will look at it later — remind him.

## Teaser gating / blur — BUILT (approved spec below marked done), toggle is OFF
When the **Initial-report gating** toggle in /app/admin/settings is ON, initial reports are
redacted at delivery time on every path (report page SSR, the /api/reports poll — the main
teaser delivery path — and the teaser PDF): viability snapshot keeps headline score +
verdict, loses per-dimension scores/rationales (dimension labels render as locked rows);
next steps cut to 1 (+ blurred stubs); five locked full-report sections render as decorative
skeleton structure (competitors/costs/pricing/compliance/marketing). Redaction is REAL —
gated fields never leave the server; the skeletons have nothing underneath. Stored rows are
never modified → retroactive + reversible. app_settings key 'teaser_gating' (no migration
needed). src/lib/teaser-gating.ts + tests. **Toggle stays OFF for the free trial; flip ON
for the $4.95 phase.** Section-level tuning (which sections gate hardest) still owed once
survey data lands.

## Editable email header/footer — BUILT (Danny's ask, same day)
The branded shell every email gets (wordmark, signature, footer note) is now admin-editable:
**Templates page → "Email header & footer" card** (header title / signature / footer note;
blank signature or footer note hides that line; links row + © year stay fixed for
email-client safety). Stored in app_settings 'email_chrome' (no migration), HTML-escaped,
any read failure falls back to the hardcoded defaults so sending can never break. All six
send paths now use buildBrandedEmail(); buildEmail stays pure for tests. Template bodies
remain pure message text — the shell still wraps them automatically.

## Multi-day charts now bucket by admin-local days — BUILT (Sonnet subagent, Fable-reviewed)
/api/admin/graphs shifts the query range and all JS bucketing by the tz param in daily mode
too (was hourly-only); traffic/returning-visitor series use new migration-026
`*_per_local_day` RPCs (SECURITY DEFINER, new function names — the 005 functions are
untouched) with a graceful UTC-day fallback pre-migration. localDayLabel() + tests in
src/lib/analytics.ts.

---

# Handoff — 2026-07-10 LATER SESSION (Survey system v2 — multi-survey + groups + targeting)

The big deferred build from the spec below ("NEXT UP — Survey system v2") is **BUILT — see
docs/plan/2026-07-10-survey-v2.md**. tsc/lint/build/201 tests all clean. NOT click-tested (auth).

## Migration 025 — RUN ✅ in prod (Danny confirmed 2026-07-10, admin verified working)
`supabase/migrations/025_survey_v2.sql`. It carried the v1 question bank + responses into a
default **"Launch survey"** (placement full_report_end, audience all) and preserved its
on/off state from the old app_settings 'survey' flag (that key is now retired, left in
place unread). Migrations current through **025 — ALL RUN in prod.**

## What shipped
1. **Data model**: `survey_groups`, `surveys` (group_id, active, placement, audience,
   sort_order), `survey_questions.survey_id` + `survey_responses.survey_id` fks. Placements:
   full_report_end / initial_report_end / account / post_purchase (renders nowhere until
   payments). Audiences: all / first_report / first_purchase / promo_users / repeat_users.
2. **Eligibility** (src/lib/survey.ts): pure `audienceMatches` + `pickEligibleSurvey`
   (unit-tested) + `pickSurveyFor(service, rls, userId, placement)` — first active survey with
   active questions the user hasn't answered whose audience matches. A user answers a given
   survey ONCE; no more "thanks" card on revisit (the next eligible survey takes the slot).
   Audience signals: completed reports (status complete), promo reports (is_promo), completed
   purchases — purchase audiences match nobody until payments ship (by design, per spec).
3. **Placements wired**: report page picks full_report_end vs initial_report_end by
   hasFullSections server-side; account page (/app/account) renders the account placement.
   SurveyCard generalised to src/components/survey-card.tsx (submits survey_id).
4. **Admin nav**: AdminShell NavItems support `children` — Surveys is now a dropdown with
   **Create survey** (/app/admin/surveys) + **Analytics** (/app/admin/surveys/analytics).
   Collapsed sidebar shows the parent icon (links to first child); emerald dot = any active
   survey (nav-status now counts surveys.active instead of the retired app_settings flag).
5. **Management page** rebuilt: surveys grouped by group (+ Ungrouped), create/edit survey
   modal (name/group/placement/audience), per-survey active toggle + expandable question
   manager (same qtypes as v1), group create/rename/delete (delete → members become
   ungrouped). Delete rules preserved: a survey OR question with responses can only be
   deactivated; zero-response deletes need the two-step confirm.
6. **Analytics page**: picker over surveys + whole-group rollups (questions labelled by
   survey), same aggregates as v1 (rating avg+distribution / choice counts / text list),
   Haiku summary scoped per survey (hidden on group rollups).
7. **API**: /api/survey requires survey_id (validates active via RLS, blocks double-answer
   with a 409). Admin routes restructured: /api/admin/surveys (GET list + POST), /[id]
   (PATCH/DELETE survey), /[id]/questions (+ /[qid]), /groups (+ /[gid]),
   /responses?survey=|group=, /summary takes { survey_id }.

## Danny-side / notes
- **Stripe**: application COMPLETE (2026-07-10) — live account created as sole trader (own
  ABN), category "Other digital goods", statement descriptor HADIDEA.COM / short HADIDEA,
  support phone kept off receipts (email support via hello@hadidea.com). Declined: Managed
  Payments (3.5% add-on), Stripe Tax (under GST threshold), Invoicing, Climate. Account is
  CLEARED to accept payments while under review (Stripe email confirmed). 2FA + passkey
  enabled; payout bank confirmed; receipt emails ON for successful payments AND refunds.
  Public details: support email hello@hadidea.com (login stays me@), website + terms/privacy/
  support links added. Logo/branding still pending (Danny hasn't settled on a logo). The payments build is still
  LAST per the standing decision — signup was merchant-side runway only. Next merchant task:
  NEW PayPal business account (see decision above).
- Launch runway now: create/verify the Launch survey questions in the new UI → promo caps →
  Start. The v1 10-question draft still applies (chat 2026-07-09).
- Survey v2.1 ideas deliberately not built: "when" targeting (date windows / after-N-days),
  post-purchase render surface (needs payments).

## Teaser gating / blur — **DONE 2026-07-10 afternoon** (spec kept for context)
Danny's read (agreed after pricing discussion): the initial report gives too much away — the
FULL viability snapshot answers "is my idea any good?" for free, killing the reason to buy.
Approved design:
1. **Partially gate the verdict (biggest lever)**: headline score ring + one-line verdict stay
   free; per-dimension sub-scores and their rationales are gated.
2. **Locked content rendered as visible structure, not absence**: blurred cost-breakdown table
   with realistic rows, "N more competitors" blurred rows, blurred marketing channels, next
   steps = 1 visible + blurred numbered stubs. People pay to close a gap they can SEE.
3. **Summary stays fully visible** (trust builder — proves the AI understood THEIR idea).
4. **Admin on/off switch** (Danny's ask): app_settings key (e.g. 'teaser_gating'), toggle in
   /app/admin/settings, so gating can be flipped without deploy — OFF during the free trial,
   ON for the paid phase. Apply the gating at RENDER time (like affiliate rewrite /
   essential services), NOT baked into stored sections — retroactive + toggleable.
5. **Blur must be real, server-side** (Danny explicit): gated text NEVER ships to the client
   (no CSS-blur over real text — devtools defeats it). Placeholders are structure-only.
6. **Architectural constraint discovered**: the initial report's content IS preview_sections
   (teaser pipeline); the full report doesn't exist until unlock generates it. So blurred
   sections are honest STRUCTURAL previews of what the full report delivers (from
   REPORT_SPEC), not redactions of real hidden text — do not fabricate specifics ("6 more
   competitors found") unless the teaser step actually knows them. Optionally have the
   teaser step cheaply capture real counts/names to make placeholders concrete.
7. Use the launch survey's "most valuable section" answers to decide which sections get the
   hardest gating. Track unlock CTR before/after the flip.

## TODO — Customer support feature (Danny's ask, 2026-07-10, build with/before payments)
## → PRE-PAYMENTS SLICE DONE 2026-07-13 (`9c45be8`, see top of file). Items 1+2 built
## (billing category was migration 027; refund workflow on Sales page). Item 3's
## /support page + FAQ built; order-confirmation email and item 4 (My purchases)
## remain for the payments build. Spec kept below for that.
Stripe signup surfaced the requirement: customers must be able to reach us about a charge
(support email is on Stripe receipts — hello@hadidea.com; phone kept private). What to build:
1. **Billing/refund support path**: add a "Billing & refunds" category to the /contact form's
   reason selector (contact_submissions.category enum + admin filter chip — same pattern as
   the existing partnership highlight; these rows should be visually flagged too, since
   charge disputes are time-sensitive: unanswered billing mail becomes chargebacks).
2. **Refund handling workflow**: admin needs a way to action a refund request against a
   purchase (find purchase by email/report, refund via Stripe API or dashboard link, record
   refunded_at — purchases table already has the column). Ties to /terms §5 policy.
3. **Support surface on receipts/emails**: order-confirmation email (payments build) must
   carry the support contact + link to /contact; consider a /support alias page or FAQ
   section for "problems with my purchase".
4. Optional later: order lookup in the account area ("My purchases" list with a "get help
   with this order" link that pre-fills the contact form).

---

# Handoff — 2026-07-10 (domain, email, admin ops polish — continuation of the marathon)

All pushed to main; migrations through **023** RUN in prod (Danny confirmed).

## Infrastructure (Danny-side, done and verified live)
- **hadidea.com live on Vercel**: apex-canonical (www 308s to apex), auto-SSL verified externally.
- **Supabase auth**: Site URL https://hadidea.com, allowlist covers apex/www/vercel.app/localhost.
- **Google OAuth**: origins updated, consent-screen branding (home/privacy/terms links,
  authorized domains), publishing status = In production. Brand verification NOT yet submitted —
  consent popup still shows the supabase.co domain until verified (or the ~$10/mo Supabase
  custom-auth-domain add-on, deferred to paid launch, which would also fix magic-link URLs).
- **IONOS email live**: hello@ (contact + admin notifications), reports@ (sender), me@ (personal).
  SPF/DKIM/DMARC verified in DNS. Supabase dashboard SMTP → reports@. Vercel env vars set
  (SMTP_*, MAIL_FROM, ADMIN_NOTIFY_EMAIL, NEXT_PUBLIC_SITE_URL). Magic-link flow tested end-to-end.
- Codebase confirmed free of hardcoded app URLs (everything origin-derived).

## Shipped (commit order)
1. `b95fa62` — **email wiring** (nodemailer, src/lib/mailer.ts, no-ops when env unset): admin
   notifications (contact incl. PARTNERSHIP-flagged subject + replyTo submitter / bug / feedback),
   feedback-reply emails (sets emailed_at), full-report-ready email (memoized Inngest step, can
   never fail the run), upsell "Emailed to you the moment it completes" line activated.
2. `8fe2ba4` — **per-admin dashboard layout** (migration 021, profiles.admin_dashboard_layout):
   server-persisted, localStorage as cache, debounced save, confirm-gated reset.
3. `f31dc05` — **contact reply modal** (migration 022, contact_replies): modal per Danny's
   standing modals-over-navigation rule; sends from reports@ w/ replyTo hello@, quotes original,
   sent/failed badge, auto-flips status to replied only on successful send.
4. `e507ed0` / `ac1047e` — **delete with two-step confirm** for feedback entries and contact
   submissions (replies cascade; list updates instantly).
5. `bd21c55` / `a1eefb5` — **admin nav notifications** (migration 023, profiles.admin_seen):
   Surveys emerald pulse when live; Contact/Feedback/Bugs amber count chips + Errors RED "!"
   chip, all meaning "new since I last opened that page"; visiting a page auto-acknowledges
   (MarkSeen POST + window-event refetch); collapsed sidebar + mobile hamburger carry
   severity dots (red > amber > emerald). Per-admin timestamps.

## Shipped later on 2026-07-10 (evening — admin ops + messaging suite)
6. `f56f7f8` / `ff83cac` — **error-log and bug-report deletes** (two-step confirm; bug delete
   also removes the screenshot from storage; errors page already had a typed-confirm Clear all).
7. `8eb1fea` — **invite modal with editable message**: invite email now sent via OUR mailer
   (generateLink for the action link — account still created instantly, that's Supabase
   semantics); created-but-email-failed is surfaced honestly (delete user + retry).
8. `51ea40a` — **universal email header/footer** in buildEmail (text wordmark → hadidea.com,
   indigo accent line, team signature, site/contact/privacy links, © year; plain-text version
   too). Email-client-safe: inline styles, no images/SVG/webfonts; single-column divs — worst
   case in desktop Outlook is a wider column, cosmetic only. Templates stay pure message text.
9. `3bf4431` — **message templates** (migration 024, RUN): /app/admin/templates CRUD page
   (modals), one default per kind (invite / contact_reply / feedback_reply, DB-enforced),
   TemplatePicker wired into all three compose modals (+ "Save as template"); feedback's
   inline reply composer converted to a modal in the process.
10. `5f731fd` — **refund policy live** in /terms §5 (pre-generation full refund; defective →
    regenerate or refund; no change-of-mind post-delivery; ACL preserved). Verified rendering.
11. Payments intel updated in "Decisions" above (direct Afterpay merchant, PayPal reusable,
    Shopify rejected, Paddle/LS flagged).

**Migrations current through 024 — ALL RUN in prod (Danny confirmed each).**

## Notes for next session
- Cookie banner final copy is the cheeky "not the creepy kind… we'll ask first" (Danny-approved).
- A separate chip session fixed samples-admin PGRST205 detection (was uncommitted in this
  session's tree throughout — check git status/log for its final state).
- Survey v2 spec (multi-survey/groups/targeting + nav dropdown) is below — still the next big
  build when Danny calls it.
- Launch runway unchanged: paste survey questions → set promo caps → Start.

---

# Handoff — 2026-07-09 (marathon session — launch-trial infrastructure)

Everything below is BUILT, PUSHED to main, and (per Danny) migrations 011–020 are RUN in prod.
Workflow: plan-file → Sonnet/Haiku subagent → Fable review+push per task; plans in
docs/plan/2026-07-09-*.md. Supersedes the section after it (same date, earlier session).

## Shipped today (commit order, all on main)
1. `82767a8`/`32bb4e4`/`b05d894` — admin dashboard: AI-cost donut split initial vs full,
   period-scoped donuts, local-midnight hourly charts (tz param), 4-decimal cost display.
2. `6e25e14`/`3023c37` — **account area rebuild**: sidebar shell (`/app/account` = My ideas,
   `/app/account/settings`, in-shell report route), first-login redirect to settings when
   username unset, username-first public identity, self-service delete-account (typed
   confirm, cascade, no undelete), admin↔account cross-links.
3. `0fa5ea1` — mobile responsive pass (10 files).
4. `9392f26` — **sample-report management** (migration 011): admin clone-from-report CRUD at
   /app/admin/samples, public gallery + modal. Danny has added real samples.
5. `0c768ab` — **public site batch** (migration 012): footer, /terms /privacy /about (draft
   banner), /faq, /contact + admin queue (partnership rows highlighted), account-icon
   dropdown in app header.
6. `e251e1f` — **promo mode** (migration 013): app-wide free-full-report mode, admin caps
   (spend/count/per-user), auto-revert to live, evaluatePromoGate pure+tested. Header pill
   shows Promo Mode (violet) when active (`ae8a5e4`).
7. `68f9460` — **surveys** (migration 014): report-end survey, admin question manager
   (delete only when zero responses), responses view, on-demand Haiku AI summary. Danny has
   a drafted 10-question launch survey (chat 2026-07-09 — ratings 1-5 usefulness/trust/
   recommend, most/least valuable section, next-action, willingness-to-pay bands, PMF
   disappointment q, 2 open texts).
8. `596072b` — **report counting fix** (migration 015): teaser_completed_at column; initial
   and full reports count as separate events (upgrade no longer erases the initial from stats).
9. `bdd9e4c` — **classifier fix**: 1:1 session coaching/tutoring → local_service (verified
   live by Danny — his seniors-app-coaching idea now classifies correctly).
10. `fcc7c7e` — **conditional questions** (`show_if` on Question): content_education bank
    branches on delivery format (published/course vs live sessions).
11. `741b03c` — **essential-services block** (migration 016): render-time, affiliate-aware
    (country match → global → Google-search fallback), /go/ click tracking, disclosure line.
12. `1af8508` — **"Getting set up" tab**: block moved out of compliance into its own tab
    (after compliance), 5 groups, archetype-aware category filtering, socials card, own PDF page.
13. `f5e741c` — **multi-country affiliates** (migration 017): countries text[] (Hnry = AU+NZ).
14. `91fbb67` — **bug widget** (migration 018): in-report modal + screenshot (private bucket
    created IN the migration), admin /app/admin/bugs triage queue.
15. `ee612ea` — **feedback replies + moderation** (migration 019): admin replies public/private,
    hide toggle, admin_public approval (homepage rule = admin_public AND allow_public AND NOT
    hidden AND featured; featured rows backfilled). emailed_at ships null until SMTP.
16. `2863243` — initial-report upsell list refreshed (13 items incl. Getting set up, funding,
    PDF; email line is a TODO comment until SMTP) + "See a full sample report" link with
    validated-path back button on /sample-report.
17. `de2bec4`/`d87a9dd`/`8a788a8` — **cookie consent**: accept/decline/manage, decline fires
    ONE anonymous session ping (10-min sessionStorage throttle, no vid) then silence,
    footer "Cookie preferences" reopens, GA-ready hasAnalyticsConsent() hook. Final copy is
    the cheeky "not the creepy kind… we'll ask first" version (Danny-approved).
18. `ee612ea`-adjacent — **promo abuse guard** (migration 020): normalized-email/+tag/
    gmail-dot dedupe, disposable-domain blocklist, ie_ab browser cookie (strictly-necessary,
    consent-independent), IP velocity (≥3/day denies), all denials reuse the positive
    per-user-limit message, suspiciousClusters count on the admin promo card.

## Danny's launch sequence (admin UI, no code)
Surveys: paste the 10 questions + toggle on → Settings→Promo: set caps → Start.

## Decisions made today (bind future work)
- **Payments LAST**, multi-processor (Stripe + PayPal + Afterpay — Danny researching). Don't
  suggest Stripe signup as a next action. Facts gathered 2026-07-10: Danny is ALREADY a
  PayPal + Afterpay merchant via Jeanity — PayPal: Danny DECIDED (2026-07-10, supersedes the
  earlier "likely reusable" note) to create a NEW PayPal business account for hadidea rather
  than reuse Jeanity's — clean buyer-facing name, next task after the Stripe signup is done;
  Afterpay is a DIRECT full
  merchant relationship (NOT Shopify-bound — corrected by Danny 2026-07-10), so hadidea has
  two Afterpay paths to weigh at build time: (a) add hadidea.com as an additional brand/site
  under the existing Afterpay merchant account (approval step, keeps his negotiated rate,
  direct API = redirect checkout flow) vs (b) Afterpay-through-Stripe (zero onboarding, one
  integration, Stripe's ~6%+30¢ AU rate). Cost-vs-effort call, not a default. Shopify Buy Button evaluated and REJECTED (checkout
  disconnected from app auth → fragile order→user matching, wrong brand, monthly cost).
  Paddle / Lemon Squeezy flagged as merchant-of-record alternatives (handle global GST/VAT —
  worth weighing as solo operator). Refund policy is now LIVE in /terms §5 (2026-07-10,
  `5f731fd`): full refund pre-generation, regenerate-or-refund for defective, no
  change-of-mind post-delivery, ACL rights preserved — Stripe's visible-refund-policy
  requirement is met.
- **Blog/Articles on the back burner** with payments.
- **SMTP**: Danny will use his own business-domain email accounts once hosting is set up;
  the wiring task then covers: contact/bug/feedback-reply notifications, report-ready email,
  the upsell email-line TODO, Users invite action, feedback_replies.emailed_at.
- Cookie banner promise "if that ever changes, we'll ask first" = adding marketing/affiliate
  cookie categories later requires a new Manage toggle + re-prompt (consent versioning).
- GA when added must load ONLY behind hasAnalyticsConsent(); the "creepy" copy line needs
  revisiting then.

## Next-up queue (nothing in flight)
1. ~~SMTP wiring~~ DONE later this session (`b95fa62` — IONOS live, all email hooks wired).
2. ~~Multi-day admin charts bucket UTC days~~ DONE (migration
   `026_local_day_graphs.sql` — NOT YET RUN in prod, run it in the Supabase SQL editor).
   Adds `analytics_{sessions,unique_visitors,returning_visitors}_per_local_day` RPCs
   (tz_offset_minutes param) alongside the migration-005 ones; /api/admin/graphs tries the
   new RPCs first and falls back to the old UTC-day ones (42883/PGRST202) if 026 hasn't run
   yet, so nothing breaks pre-migration — multi-day charts just stay UTC-bucketed until it's
   applied, same as before this fix.
3. Standing backlog: security/privacy workstream, 4B.3 cost/quality matrix, real stats for
   demo-stats.ts, viability-score calibration, fixtures re-capture, multi-admin roles
   (ADMIN_EMAIL is a single env var — needs an is_admin mechanism before admin #2 joins).

---

# Survey system v2: multi-survey + groups + targeting — **DONE 2026-07-10** (spec kept for context)

Built per the "LATER SESSION" section at the top of this file (migration 025).
Original spec follows.

Danny's request. NOT started — he flagged it as a whole system / large task, deliberately
deferred. Current state for context: ONE global survey (migration 014 — survey_questions /
survey_responses, app-wide on/off in app_settings, shown once per user at the end of reports).

## Requirements (Danny's words, mapped)
1. **Admin nav gets a dropdown under "Surveys"** with subsections: **Create survey** and
   **Analytics / Responses**. (The admin sidebar currently has no expandable/nested nav items —
   AdminShell's NavItem type needs a `children` concept; keep collapse behaviour + active-pill
   logic working.)
2. **Multiple surveys, groupable**: create a survey GROUP, add surveys to it — e.g. one survey
   for first-time users, another for first-time purchasers, "another for whatever".
3. **Targeting**: per survey (or group), Danny selects **who / when / where** it is shown.

## Design sketch (settle at build time)
- Tables: `surveys` (id, name, group_id, active, placement, audience, created_at),
  `survey_groups` (id, name), `survey_questions` gains `survey_id` fk (migrate the existing
  global questions into a default "Launch survey"), `survey_responses` gains `survey_id`.
- Targeting dimensions to support first: **audience** (all users / first report just completed /
  first purchase just completed / promo users / repeat users) and **placement** (end of full
  report / end of initial report / account page / post-purchase). "When" (date windows or
  after-N-days) can be v2.1.
- Eligibility resolution: one helper `pickSurveyFor(user, placement)` — first active survey
  matching placement + audience that the user hasn't answered; a user answers a given survey once.
- Response analytics per survey + per group rollup; keep the on-demand Haiku AI summary,
  scoped to a survey.
- Migration renumber note: check supabase/migrations/ max at build time (022 contact_replies
  was next as of this writing).
- Purchase-based audiences depend on the purchases table having real rows — fine to build the
  enum now; those audiences just match nobody until payments ship.

---

# Handoff — 2026-07-09 EARLIER SESSION (Dashboard polish, feedback cards, scrolling testimonials, local time)

**Committed on branch `feat/report-appendix-editlimit-demo-mode`, NOT pushed.** [Since merged
to main and pushed — see the session above.] Two commits
this session: `390eb9e` and `c658e68`. tsc/build/70 tests all clean. NOT click-tested (auth).

## What shipped — commit `390eb9e`

1. **Sample report updated** — `src/lib/sample-report.ts` now includes `marketing_plan` (5
   channels, starter budget), `why_this_can_work`, `one_thing_to_do`, `validation_copy` sections.
   The public `/sample-report` page now renders all current tabs.

2. **Dashboard half/full height system** — `WidgetDef` and `LayoutItem` now carry a `height:
   'half' | 'full'` dimension alongside the existing `span`. CSS grid uses `row-span-1` /
   `row-span-2` with `gridAutoRows: minmax(200px, auto)`. Edit mode shows ½H / 1H toggle
   buttons (separated by a divider from the width buttons). Default heights: KPI cards, report
   types, report costs, affiliates, feedback = half; overview chart, sales = full. AdminCard
   is now `flex flex-col`, WidgetCard body is `flex-1`, StatCard sparkline uses `mt-auto` —
   all so cards stretch to fill their grid slot. Saved layouts auto-reconcile the new `height`
   field (old layouts without it get the widget's `defaultHeight`).

3. **Per-model AI cost donut** — new dashboard widget `ai-cost-by-model` (half-height, span 1).
   The `/api/admin/dashboard` route aggregates `cost_usd` from `sections._meta.steps` grouped
   by model across all completed reports. `CostsData` interface extended with `costsByModel`.
   Model names shortened for display (`claude-haiku-4.5-20251001` → `haiku-4.5`). Palette:
   amber/indigo/emerald/pink/cyan/orange (6 colours cycling).

4. **Local timezone** — all date computations switched from UTC to browser local time:
   - `period-picker.tsx`: `toLocalDate()` replaces `toISOString().slice(0,10)`.
   - `todays-sales-widget.tsx`, `report-costs-widget.tsx`: same `toLocalDate()` / local
     date arithmetic.
   - `overview-chart.tsx`, `growth-graphs.tsx`: new `utcHourToLocal()` converts UTC `HH:00`
     labels to the browser's timezone for hourly chart axes.
   - Sublabels changed: "Hour buckets are UTC." → "Hourly buckets, local time." /
     "Day buckets are UTC calendar days." → "Daily buckets."

5. **New period presets** — `PeriodPreset` type extended: `yesterday`, `wtd` (week to date,
   Monday-based), `mtd` (month to date), `ytd` (year to date). Dashboard subtitle shows
   readable labels ("Snapshot for week to date" etc.).

## What shipped — commit `c658e68`

6. **Admin feedback cards** — `src/app/app/admin/feedback/feedback-cards.tsx` (new client
   component). The feedback page now renders entries as a responsive 3-column card grid
   (1 col mobile, 2 tablet, 3 desktop) with client-side sort buttons: Date / Rating / Idea
   type. Each card shows: stars, user name, archetype chip, comment (4-line clamp), date,
   consent badge, and the existing `FeatureToggle`. Featured cards get an emerald border.
   Rating filter chips remain (server-side, URL-based). Pagination still works below the cards.

7. **Homepage scrolling testimonials** — when 4+ testimonials exist, the section switches
   from a static grid to a **reverse-direction marquee** (scrolls right, opposite to the
   report card marquee which scrolls left). CSS: `@keyframes marquee-scroll-reverse` (translateX
   -50% → 0), `.marquee-track-reverse` (50s linear infinite), hover pauses, reduced-motion
   stops. Under 4 testimonials: falls back to the original static ScrollReveal grid. Cards
   are 320px wide with the same `TestimonialCard` component.

## Still TODO from this batch

### 4. Admin sample-report management + public sample gallery — DONE 2026-07-09 (`9392f26`)
Built per docs/plan/2026-07-09-sample-report-management.md: `sample_reports` table
(migration 011, RUN in prod by Danny, samples added and verified working), admin CRUD at
`/app/admin/samples` (clone from real report, sanitized `_meta`, active toggle, sort, confirm-
delete), public `/sample-report` card gallery + modal viewer, coffee-van sample kept as fallback.

### 5. Mobile-responsive layout review — DONE 2026-07-09 (`0fa5ea1`)
Code-wide pass; 10 files fixed (header wrap, admin tables scroll containment, defensive
flex-wrap). Verified code-level only — preview viewport wouldn't shrink to 375px; Danny should
spot-check on a real phone.

---

# NEXT UP — Promo mode (3rd app mode: live / demo / promo) — SPEC ONLY, 2026-07-09

Danny's request, for the launch trial ("first N reports free to the first N registered users").

1. **Three modes**: live (charge users), demo (existing fixture mode, no API spend), **promo**
   (real generation, payment requirement OFF — users generate full reports free).
2. **Admin promo setup page** (Settings or its own page): configure a promo with **limits** —
   admin sets an **AI spend cap (USD)** and/or a **generation count cap** (e.g. 100 or 1000
   reports — Danny undecided, make it a number field, not hardcoded).
3. **Auto-revert**: when a cap is reached, the app switches itself back to **live mode** and
   resumes charging. Must be enforced server-side at generation time (check caps before
   starting a run, atomically count/accumulate after), not just UI.
4. **Optional per-user limit** during promo (e.g. 1 free report per user) — admin-settable,
   nullable = unlimited.
5. Needs: a table for promo config + counters (spend so far, reports so far, per-user counts
   derivable from reports), admin UI, gate checks in the report-request path, and a public-
   facing "free during launch" treatment on the generate/unlock buttons while promo is active.
6. Note: current `demo_mode` is a per-profile boolean (admin's own account only). Promo mode
   is APP-WIDE state — different mechanism; don't conflate. Migration number: next free is
   013 (011 samples, 012 contact — the bug-report spec's claim of 011 below is stale).

# NEXT UP — Report-end surveys — SPEC ONLY, 2026-07-09

Danny's request; primary tool for gathering real feedback during the promo trial.

1. **Survey attached to the end of reports** (full report page, probably initial too — confirm
   at build time). Admin can turn the survey **on/off** globally.
2. **Admin question management**: add/remove/reorder questions. Question types at minimum:
   free text + some structured type (rating or multiple-choice) — decide at build time.
3. **Survey responses page** in admin: see what people are answering (per question and per
   respondent view).
4. **AI overview**: option for an AI-generated summary of responses ("general overview of what
   users are saying") — use cheapest capable model (Haiku), on-demand button not automatic,
   so it costs nothing until clicked.
5. Tables: `surveys`/`survey_questions`/`survey_responses` (or single-survey simplification:
   `survey_questions` + `survey_responses` with an app-wide on/off setting). RLS: users
   insert-only own responses; admin reads via service role.
6. Danny's intent: run promo → collect survey answers → real user feedback before pricing.

---

# NEXT UP — Public site: footer, socials, blog/FAQ, contact form, account nav
(NOT STARTED — spec only, 2026-07-08)

Danny's request, dictated as a batch — **order not decided yet, pick per session**. Six related
but separable pieces. Current state: `src/app/page.tsx` (marketing homepage) has a bare one-line
footer (`© {year} Idea Engine. All rights reserved.`, line ~592) and a minimal header (`Idea
Engine` wordmark + `HeaderAuthLink`, line ~377). No `/terms`, `/privacy`, `/about`, `/contact`,
`/blog`, `/faq` routes exist yet. `src/components/app-header.tsx` is the **signed-in app shell**
header (separate from the public homepage header) — currently has "My ideas" / "New idea" text
links top-left and a "My account" text link top-right (see piece 4 below).

## 1. Footer section (ToS, Privacy, Copyright, About, Contact Us)
- New static pages: `/terms`, `/privacy`, `/about` (content TBD — ask Danny for copy, or draft
  placeholder legal text and flag it needs a lawyer pass, same caution as the compliance-baseline
  fallback's "not legal advice" framing elsewhere in this app).
- Footer redesign in `page.tsx` (and eventually mirrored in the signed-in app shell / `AppHeader`
  area or a shared `<Footer>` component so `/app/*` pages get it too — decide scope: marketing-only
  first, or everywhere).
- Copyright line stays, links added: Terms · Privacy · About · Contact · (Blog · FAQ — pieces 3/6).

## 2. Contact Us — segmented form
- One `/contact` page, form with a **required "reason" selector** (segments):
  User feedback / Complaint / General question / Partnership or advertising inquiry (exact
  labels TBD with Danny). Each segment can route to a different admin queue or just tag the row —
  simplest: one `contact_submissions` table with a `category` enum column, one admin page with a
  category filter (mirrors the filter-chip pattern already used in `/app/admin/errors` and
  `/app/admin/feedback`).
- Migration (011 or next free number — check what bug-report widget spec above claims first):
  `contact_submissions` (id, created_at, category enum, name, email, message, user_id nullable —
  signed-in submitters get it auto-filled, anon visitors can still submit, status open/replied/
  closed). RLS: insert-only for anon+authenticated, no select — service-role/admin only, same
  posture as `bug_reports`/`error_log`.
- **Same "straight to admin" email requirement as the bug-report widget** — blocked on Supabase
  SMTP (recurring dependency across three specs now: feedback-replies, bug-report, contact form —
  worth doing the SMTP setup once and unblocking all three at the same time).
- Partnership/advertiser inquiries in particular are commercially time-sensitive — flag these
  visually in the admin list (e.g. a highlighted category chip) so they don't sit unseen.

## 3. Blog / Articles
- Public list + detail pages (`/blog`, `/blog/[slug]`) and an **admin authoring UI** (new nav item
  under a `Content` group in `admin-shell.tsx`, e.g. `/app/admin/blog`).
- New table `blog_posts`: id, slug (unique), title, excerpt, body (markdown or a rich-text JSON —
  decide format; markdown is simplest and this codebase already renders markdown-ish structured
  content in reports, though not via a dedicated renderer yet, so a markdown lib dependency would
  be new), cover_image_url, author, status (draft/published), published_at, created_at, updated_at.
  RLS: public select where `status = 'published'` (same pattern as `offers`' public-select
  policies), admin-only writes via a self-gated `/api/admin/blog` route.
- Needs an image-hosting decision for cover images — same Supabase Storage bucket question as the
  bug-report screenshot spec above; could share one bucket (`public-assets`) or use a separate
  `blog-images` bucket (this one likely wants public read, unlike the private bug-screenshot
  bucket).
- SEO basics worth building in from the start: per-post `<title>`/meta description, since this is
  the only public content growth this app will have (Next.js `generateMetadata` per post).

## 4. Account nav — icon + popdown menu (replaces top-left text links)
Concrete change to `src/components/app-header.tsx`:
- Replace the **"My account" text link** (line ~68-73) with a small SVG account/user icon
  (lucide-react `User` or `CircleUserRound` — already a project dependency, no new package needed).
- Clicking/hovering opens a **dropdown menu** with: My account (→ `/app/account`), My ideas
  (→ `/app/account#your-ideas`, only if `hasIdeas` — reuse the existing count-only query already in
  this file), New idea (→ `/app`). Sign out can stay as its own button beside the icon, or move
  into the dropdown too — Danny's call.
- Once the dropdown covers ideas/new-idea, **remove the top-left "My ideas" / "New idea" text
  links** (lines 40-47) per Danny's explicit ask ("so we don't need the links for those up the
  top left") — the wordmark + Admin badge + Demo/Live pill stay top-left; nav moves entirely into
  the icon dropdown top-right.
- Standard pattern: client component (needs `'use client'` + `useState` for open/closed, or a
  headless approach with a details/summary element or click-outside handling) — `AppHeader` itself
  is currently an async Server Component (queries `hasIdeas`/admin status), so the dropdown likely
  needs to be split into a small client subcomponent that receives `hasIdeas`/`isAdmin` as props,
  same pattern as `DemoModeToggle`/`SignOutButton` already used elsewhere in this header.

## 5. Header links to Contact / Articles / Blog (public marketing header)
- Danny: "We may add the links to the Contact us, articles and blog at the top" — i.e. the public
  homepage header (`page.tsx` line ~377), not the signed-in app header. Straightforward `<Link>`
  additions once `/contact` and `/blog` exist (piece 2/3).

## 6. FAQ page
- New `/faq` page (static content, accordion-style Q&A — no DB table needed unless Danny wants
  FAQ content editable from admin without a code deploy, in which case it's the same shape as
  `blog_posts` but simpler: a `faq_items` table with `question`, `answer`, `sort_order`, `published`).
- Footer link (piece 1). Danny: "will probably also be linked from the top menu eventually" — not
  required now, just noted so the header nav additions in piece 5 leave room for it.

## 7. Social buttons
- Danny will create Facebook / TikTok / Instagram / Twitter(X) accounts — **URLs not decided yet,
  do not fabricate placeholder links**; wait for the real handles.
- Icon row in the footer (piece 1). lucide-react ships `Facebook`, `Instagram`, `Twitter` icons but
  **no TikTok icon** — will need a custom inline SVG for that one (small, common gap in most icon
  sets). `target="_blank" rel="noopener noreferrer"` on all four.

## Cross-cutting notes
- **Migration numbering**: the bug-report widget spec (this file, next section down) claims
  migration 011 for `bug_reports`. Whichever of the two features (bug reports vs. contact form)
  gets built first should take 011; the other takes the next free number. Check `supabase/
  migrations/` for the actual current max before assigning — don't assume from this doc alone.
- **SMTP dependency now shared by three features** (feedback-replies, bug-report, contact form) —
  strong case for setting up Supabase SMTP as its own small task before/alongside any of these,
  rather than deferring it three separate times.
- **Storage buckets**: bug-report screenshots (private) and blog cover images (public) are two
  separate Supabase Storage bucket needs — both dashboard-created, not migrations.
- None of this is built. No code changes made this session for this spec — planning only, per
  Danny (low on usage, deciding order next time).

---

# NEXT UP — Bug report widget (NOT STARTED — spec only, 2026-07-08)

Danny's request. Not built — he was low on usage this session, picking up next time. Lets a user
flag a bug from inside a report (initial/teaser or full) with an optional screenshot, sent straight
to the admin.

## Requirements (Danny's words, mapped)
1. A "report bug" box/modal, **hidden until** a small link or icon is clicked — not in the way.
2. Visible on **both** report pages: the initial (teaser) report and the full ("final") report.
3. Submitting sends the report **straight to admin** — i.e. it must land somewhere Danny actually
   sees it, not just sit in a table nobody looks at.
4. Users can **attach a screenshot** when reporting.
5. A dedicated **bug report page** (admin-facing, to review/manage reports).

## Recommended design

### Trigger placement
Small text link or subtle icon-button (e.g. a bug/flag icon), **fixed near the bottom of the
report viewport** — same register as the existing "Regenerate initial report" / "Review / edit
answers" links already in `report-client.tsx` (both `TeaserViewer` and `FullReportViewer` render
those in a small centered link stack under the CTA). Adding "Report a bug" as one more line in that
same stack keeps it consistent and out of the way — no floating action button needed. Opens a modal
(don't build a separate route for the form — keep it in-context so the user doesn't lose their
place in the report).

### Modal contents
- What went wrong (required, textarea)
- Optional screenshot attachment (see below)
- Auto-captured context (silent, not user-facing fields): `idea_id`, `report_id`, current tab
  (`activeTab` state already exists in `FullReportViewer`), `report.status`, browser `navigator.
  userAgent`, current URL. This is what makes the report actually actionable — "something's wrong"
  with no context is useless to Danny.
- Submit button + a lightweight confirmation ("Thanks — we'll take a look") that closes the modal.

### Screenshot attachment
No file-upload/storage infra exists yet in this codebase (checked — no Supabase Storage bucket is
configured anywhere). Two viable approaches, pick one:
- **(a) Supabase Storage bucket** (`bug-screenshots`, private, RLS: insert-only for authenticated
  users, no public read — admin reads via service client): user picks a file via `<input type=
  "file" accept="image/*">`, upload via `supabase.storage.from('bug-screenshots').upload(...)`
  client-side, store the returned path on the bug_reports row. Standard, scales fine, needs the
  bucket created in Supabase (dashboard, not a SQL migration).
- **(b) Client-side screen capture** (e.g. a canvas-based DOM screenshot of the report content) —
  more "automatic" (no file picker) but heavier to implement correctly (cross-origin images, fonts,
  scroll state) and overkill given the user is already looking at the exact page — a manual
  screenshot + upload is simpler and more reliable. **Recommend (a).**
- Max file size (e.g. 5MB) and image-only MIME check before upload.

### Data model — migration 011 (not yet written)
New `bug_reports` table:
```
id, created_at, user_id (nullable — best-effort, don't block on auth edge cases),
idea_id, report_id, report_tab text null, description text not null,
screenshot_path text null (Storage object path, not a public URL),
browser_info text null, page_url text null,
status text not null default 'open' check (status in ('open','triaged','resolved','wontfix')),
admin_notes text null
```
RLS: insert-only for `authenticated` (their own `user_id`), no select for anon/authenticated
(reports shouldn't be user-readable after submission) — service-role/admin reads only, same
pattern as `error_log` (migration 009) and `offers`/`affiliate_links` writes.

### "Sent straight to admin" — email notification
Requirement #3 needs Danny to actually *see* it without polling a page. Two options, can do both:
- **In-app**: reuse the `logError()` pattern (`src/lib/log-error.ts`) as precedent — but bug reports
  are user-submitted content, not error diagnostics, so they should NOT go into `error_log`; give
  them their own table (above) and their own admin page, linked from the sidebar (`System` group,
  next to Errors — `/app/admin/bugs`, `AlertTriangle`-style icon, maybe `Bug` from lucide-react).
- **Email**: same SMTP blocker as the feedback-replies spec above and the Users "invite" action —
  Supabase SMTP still isn't configured. Once it is, a bug-report insert should trigger a
  notification email to `ADMIN_EMAIL`. Until then, the admin page + a next-session polling habit
  is the fallback — flag this dependency to Danny same as the other two features blocked on it.

### Admin bug reports page (`/app/admin/bugs`)
Same shape as `/app/admin/errors` (already built, migration 009) — reuse conventions: newest-first,
R3 pagination (`src/lib/admin-pagination.ts`), status filter chips (open/triaged/resolved/wontfix),
expandable rows for full description + browser info + link to the idea/report, a way to view the
attached screenshot (signed URL via service client — `supabase.storage.from('bug-screenshots').
createSignedUrl(path, 60)`, not a public URL, since the bucket is private), and a status-update
control (open → triaged → resolved, simple dropdown/buttons, no typed-confirm needed since nothing
is destructive here — only a hard "delete report" action would need the deletion ground rule).
New route `/api/admin/bugs` (list/update), self-gates `isAdminEmail` like every other admin route.

### Submission route
`POST /api/ideas/[id]/report/bug` (or a flatter `/api/bug-reports`) — authenticated (signed-in
users only, matches how feedback/regenerate routes work), validates description non-empty,
uploads/records the screenshot path if present, inserts the row, and (once SMTP exists) fires the
notification email.

## Dependencies / open decisions for Danny
1. **Supabase Storage bucket must be created** (dashboard action, not a migration) before screenshot
   upload works — flag this the same way the SMTP gap is flagged elsewhere in this file.
2. **Email notification is blocked on SMTP** (shared blocker with feedback-replies +  Users invite).
3. Confirm the trigger copy/icon — plain text link ("Report a bug") vs. an icon-only button; text
   link is simpler and matches the existing "Regenerate initial report" / "Review / edit answers"
   style already used in both viewers.

---

# Handoff — 2026-07-08 (Per-step hybrid model routing)

**Committed on the branch.** After the Haiku experiment ($0.33, ~90% quality) Danny asked for
multi-model routing. `STEP_MODELS` in generate-report.ts now routes per step:
- **Haiku 4.5**: competitors, compliance, financing, marketing — the search/extract steps, whose
  cost is dominated by search-result input tokens (competitors alone was $0.94 of a $1.70 Sonnet
  run; Haiku's input rate is half).
- **Sonnet 5**: cost estimation + synthesis — the judgment steps / the report's analytical voice.
- Teasers + failure-fallbacks: Haiku (unchanged). Admin Settings `report_model` overrides EVERY
  step when set; "App default" = hybrid. `model_version`/`_meta.model` records the override or
  `hybrid (haiku + sonnet-5)`; true per-call models are always in `_meta.steps[].model`.
- Expected COGS: **~$0.40–0.90/report** (from ~$1.20–1.70 all-Sonnet). Cost-estimate copy updated.
- **Validation still owed:** n=1 evidence per model — run the 4B.3 quality matrix (now ~4× cheaper)
  before treating hybrid quality as settled. Watch Haiku's gap_notes depth + JSON discipline in
  `/app/admin/errors`.

---

# Handoff — 2026-07-08 (Hourly dashboard buckets + no chart hover-wash)

**Uncommitted, same branch. No migration.** Danny: single-day dashboard ranges showed one lonely
dot; also the recharts hover cursor washed the whole plot grey.
- `/api/admin/graphs` now returns **24 UTC 'HH:00' hour buckets whenever from === to** (Today or
  any single custom day), plus `granularity: 'hour' | 'day'`. Field stays named `day`, so chart
  data shapes are unchanged. Reports/signups/sales re-bucket in JS; **traffic + returning visitors
  bypass the per-day RPCs in hourly mode** and aggregate `page_events` directly (service client;
  distinct sessions/visitors per hour; returning = visitor has any event before the day; `.in()`
  lookup capped at 1000 visitors — fine at current volume, revisit at scale or add hourly RPCs).
- Clients (growth-graphs, overview-chart via dashboard-client) label hours as-is vs `MM-DD`,
  sublabels flip "per day"→"per hour", header note flips to "Hour buckets are UTC."
- **Hover cursor disabled** (`cursor: false` in the shared tooltipStyle of both chart files) —
  tooltip still appears, background no longer changes.
- New helpers in `src/lib/analytics.ts` (`utcHourLabel`, `UTC_HOUR_LABELS`, `fillHourlySeries`)
  with unit tests (59 total pass). tsc/lint/build clean. Not click-tested (auth) — Danny: pick
  "Today" on the dashboard, expect hourly bars/lines and no grey wash on hover.
- **Follow-up (same day, committed):** AI costs added as a 4th Overview-chart tab (amber, USD
  tooltip/axis) + a new `kpi-ai-cost` StatCard (period total, sparkline, delta) fed from the
  existing `sales.costUsd` series. Saved dashboard layouts auto-append the new widget.

---

# Handoff — 2026-07-08 (Citation highlighting)

**Uncommitted, same branch. No migration.** Danny spotted raw `<cite index="5-30,5-31">…</cite>`
tags in Legal results — these are the model's web-search citation markers leaking into our JSON
output (index = pointer into that call's transient search results, meaningless once stored; the
SPAN is a verbatim quote from a live source). Decision (Danny's): **highlight, don't strip**.
- `src/lib/cite.ts` — `splitCiteSegments` / `hasCiteMarkers` / `stripCiteMarkers` / `deepStripCites`.
- Pipeline stores tags as-is (deliberate; comment on `extractJson` in generate-report.ts).
- Web UI: `CitedText` in report-client renders cited spans with a subtle indigo highlight + dotted
  underline + tooltip "Quoted from a source found during live research". Applied across all prose
  fields (competitors, compliance, funding, marketing, summary, why-this-can-work, pricing, risks,
  next steps, one-thing, validation copy, cost notes, snapshot rationales/verdict) — synthesis and
  cost steps receive competitor data as input so they can ECHO cite tags; that's why non-search
  sections are covered too. Works retroactively on the stored wardrobe report.
- PDF: `deepStripCites(sections)` in the pdf route — quotes kept, tags dropped (no highlight
  treatment in print yet; could add a background style later if wanted).
- Verified: tsc/lint clean, next build clean. Visual check = open any report with live
  compliance/competitor results (the wardrobe report already has tags stored).
- **Variant fix (same day):** Danny's first Haiku report leaked raw `<ancite index="3-24">` /
  `</anite>` tags on the Marketing tab — Haiku garbles the internal `antml:cite` form (Sonnet emits
  clean `<cite>`). cite.ts now normalises every variant (`cite`/`ancite`/`anite`/`antml:cite`, incl.
  unbalanced strays) before splitting/stripping; 6 regression tests in `src/__tests__/cite.test.ts`
  (65 total pass). Fix is render-side, so the stored Haiku report cleans up on refresh.
- **First Haiku full report (2026-07-08): US$0.33 vs Sonnet ~$1.26 (~4×cheaper), quality ~90% —
  strong candidate for the initial/free tier engine; keep Sonnet for paid. 4B.3 quality matrix is
  now 4× cheaper to run with the model switcher.**

---

# Handoff — 2026-07-08 (Admin report-model switcher)

**Uncommitted, same branch. Migration `010_report_model.sql` — RUN ✅ by Danny 2026-07-08.**
First Haiku full-report experiment kicked off same day (~06:03Z).

Danny wants to compare report quality vs cost across models (e.g. "what does a Haiku report look
like?"). Built, mirroring the demo-mode pattern:
- **Admin → System → Settings** (`/app/admin/settings`, new sidebar item): radio picker over every
  active Anthropic API model (Fable 5, Opus 4.8/4.7/4.6/4.5, Sonnet 5/4.6/4.5, Haiku 4.5) with
  per-Mtok pricing + caveat notes (Fable: premium, always-on thinking, possible refusals, needs
  30-day retention). "App default" = NULL = Sonnet 5.
- Stored in `profiles.report_model`; settable only via ADMIN_EMAIL-gated
  `/api/profile/report-model` (allowlist-validated); **only affects reports on the admin's own
  ideas**. Teasers + failure-fallbacks stay Haiku regardless.
- `generate-report.ts` resolves `reportModelForUser()` once and passes it to all 6 primary steps;
  `MODEL_PRICING` in ai.ts now covers all models so cost tracking stays accurate; `model_version`
  now records the **actual** model (was hardcoded 'claude-sonnet-5'), and `_meta.model` + the
  report page's admin cost line show "US$X · model" so comparisons are self-labelling.
- Verified: tsc/lint clean, 56 tests, next build (both new routes compiled). Not click-tested (auth).

---

# NEXT UP — Feedback replies + moderation (NOT STARTED — spec only)

Danny's request (2026-07-08). Build after the current uncommitted work is verified. Lets the admin
reply to a user's report feedback, choose whether each reply/feedback is public, email the user when
replied to, keep complaints private, and hide abusive feedback. Touches the `/app/admin/feedback`
page + `report_feedback`.

## Requirements (Danny's words, mapped)
1. **Reply to feedback** — admin can post a reply to any feedback entry.
2. **Public-or-not per reply** — when replying, admin chooses whether the reply is shown publicly.
3. **Email the user on reply (later phase)** — when admin replies, email the feedback's author so
   they see that a reply exists and what it says. Blocked on email infra (see deps).
4. **Handle complaints privately** — admin-controlled "don't show publicly" so a complaint can be
   answered privately; admin decides later whether to surface it. This is an **admin** control,
   separate from the user's own `allow_public` consent.
5. **Hide option** — admin can hide spammy/rude feedback so it never appears publicly and can be
   filtered out of the admin list.

## Recommended design
- **Migration 010** — new `feedback_replies` table (preferred over a single column so multiple
  replies + per-reply email tracking work): `id, feedback_id (fk report_feedback on delete cascade),
  body text, is_public boolean default false, created_at, created_by text (admin email),
  emailed_at timestamptz null`. RLS on; **service-role only for writes** (admin route), plus a narrow
  authenticated SELECT so a user can read replies to *their own* feedback (join via
  report_feedback.user_id = auth.uid()), and an anon SELECT limited to `is_public = true` replies
  whose parent feedback is itself public (for homepage).
- **Also add to `report_feedback` (same migration):**
  - `hidden boolean not null default false` — moderation hide.
  - `admin_public boolean not null default false` — admin's own publish decision, independent of the
    user's `allow_public`. **Public display rule becomes:** show on homepage/publicly only when
    `admin_public && allow_public && !hidden && featured` (user consent AND admin approval AND not
    hidden). Reconfirm how this interacts with the existing Block 9 homepage testimonials query.
- **Admin UI (`/app/admin/feedback`)** — per row: a reply composer (textarea + "public reply"
  checkbox + Send), existing reply(ies) listed with their public/private badge, a **Hide** toggle
  (reversible, so a plain toggle is fine — no typed confirm needed), and the `admin_public` toggle.
  Reuse the existing `FeatureToggle` pattern / client-component conventions.
- **User-facing surface** — on the report page feedback card (`report-client.tsx`,
  `ReportFeedbackCard`), show any admin reply **to that feedback's owner always** (private replies
  still visible to the recipient, just not on the homepage); publicly only when `is_public`.
- **Email (phase 2)** — on reply Send (or a separate "notify" action), email the author:
  "Danny replied to your feedback: <body>" + link back to their report. Store `emailed_at`.

## Dependencies / notes
- **Email infra is the blocker for #3** — Supabase SMTP still isn't configured (same gap that makes
  the Users "invite" action error). Decide sender (Supabase SMTP vs Resend/Postmark). Build the
  reply + moderation UI first (works without email); wire the email once SMTP/provider is set.
- Deletion ground rule: **hide is reversible → toggle is OK**; a hard *delete* of feedback (if added)
  needs the typed-confirm pattern. New admin route (`/api/admin/feedback/...`) must self-gate
  `isAdminEmail` like every other admin route.
- Homepage testimonials (Block 9) query must be updated for the new `hidden` / `admin_public` rule so
  nothing hidden or un-approved leaks publicly.

---

# Handoff — 2026-07-08 (R4 — admin error log)

**Branch still `feat/report-appendix-editlimit-demo-mode`, NOT committed/pushed.** R4 (the last
admin-redesign block) is built. **Migration `009_error_log.sql` — RUN ✅ by Danny 2026-07-08**, so
`/app/admin/errors` is live and `error_log` writes will persist.

## What shipped (uncommitted)
- **Migration 009** `supabase/migrations/009_error_log.sql`: append-only `error_log` table
  (occurred_at, source, message, detail jsonb, path, user_id — no FK on user_id). RLS on, **no
  policies → service-role only** (same model as offers/affiliate_links). Types added to
  `database.types.ts`.
- **`src/lib/log-error.ts`** — `logError({source, message, detail, path, userId})`, best-effort
  service-role insert that **never throws** (logging can't break the caller), plus `errorMessage()`.
  Detail is JSON-normalised (Errors keep their stack).
- **Wired into catch blocks**: `generate-report` (idea-not-found; and at assemble it logs any real
  AI-step failures **even when a fallback recovered the section** + partial reports — exactly the
  "a section came back failed" cases Danny hit), `generate-teaser` (top-level try/catch, rethrows so
  Inngest retries are unchanged), and the admin mutation routes (affiliates ×3, offers ×3, feedback,
  users invite + delete).
- **Errors page** `/app/admin/errors` (sidebar already linked it): newest-first, **source filter**
  chips, **server-side pagination** (reuses R3 `Pagination`, 25/page), each row **expandable** to
  full detail (path/user/JSON), per-row **Copy** + **Copy page** (formats rows as pasteable text),
  and **Clear all** behind a typed `DELETE ALL` confirm (deletion ground rule). API route
  `/api/admin/errors` (self-gates isAdminEmail) handles delete-one + clear-all.

## Verification
- `tsc --noEmit` clean, `next build` clean (both `/app/admin/errors` + `/api/admin/errors` compiled),
  eslint clean on all touched files, `vitest` 56 pass.
- **NOT click-tested** — the admin section needs auth, which the automated preview session can't do.
  After running migration 009, Danny should: open `/app/admin/errors` (expect empty), force a failure
  (e.g. a report with a failing section) and confirm it appears with Copy + expand working, then try
  Clear all (typed confirm).

## Admin redesign — now COMPLETE (R1–R4). Remaining before merge/deploy
- Migrations 003–009 all run ✅.
- Danny's live pass on R4 + the earlier report-robustness work (separate handoff below).
- Then push branch + merge to main (Vercel deploys from main).

---

# Handoff — 2026-07-08 (Full-report robustness + accurate cost tracking)

**Branch still `feat/report-appendix-editlimit-demo-mode`, NOT committed/pushed.** R2 confirmed
working by Danny. This session fixed report robustness + the cost-tracking undercount, BEFORE
starting R4. No DB migration needed (used a `_meta.partial` flag, not a new status enum).

## What changed (uncommitted)
- **Cost tracking root cause fixed.** App showed US$0.22 while Anthropic billed US$1.13 for the
  same Sonnet-5 run because cost was only banked from the *successful* attempt: failed retries and
  fully-failed steps (competitors + compliance both died in that run, the two most search-heavy
  calls) were billed by Anthropic but recorded as $0.
  - `src/lib/ai.ts`: `AIResult` now carries `model` + `webSearchRequests`; new `AICallError` carries
    the billed cost on the truncation / no-text-block throw paths; exported `HAIKU_MODEL`, `AIResult`.
  - `src/lib/inngest/generate-report.ts`: rewritten around a cost-accurate `aiStep()` helper that
    banks cost from **every** attempt (parse failures + `AICallError`) and never throws for API/parse
    failures (returns `status:'failed'`). Per-call diagnostics now stored in `_meta.steps[id]`
    ({status, model, tokens, web_search_requests, cost}); total `_meta.cost_usd` includes failed/
    fallback attempts. Expect the app total within a few % of the Anthropic dashboard now.
- **Competitor fallback** — if live search fails/returns empty, a cheap **no-search Haiku** pass
  (`src/lib/prompts/competitor-fallback.ts`) produces model-inferred direct/adjacent/substitute/
  marketplace players (no fabricated URLs). Section marked `fallback_inferred`.
- **Compliance fallback** — same pattern (`compliance-fallback.ts`), and if the Haiku pass also
  fails, a **deterministic static baseline** (`src/lib/compliance-baseline.ts`, AU + software/app
  aware) guarantees the Legal tab is never blank.
- **Required-section policy** — `REQUIRED_SECTION_KEYS`; if any required section is still empty after
  fallbacks, report completes with `_meta.partial=true` (soft amber banner) rather than silently OK.
- **Synthesis consistency** — synthesis now receives `section_status` (`live_ok`/`fallback_inferred`/
  `failed`) for competitors + compliance, with prompt rules so the summary never claims research
  "found" competitors that only came from the inferred fallback (the exact Overview-vs-Competitors
  mismatch Danny saw).
- **UI polish** — report tab bar: native scrollbar hidden + subtle edge fade (`.tab-scroll` in
  globals.css), tapped tab scrolls into view, tighter desktop spacing. Fallback/partial banners
  (`InferredNote`, `PartialReportBanner`). Competitor rows now render URL-less inferred entries as
  plain text + a `kind` chip. Admin cost-estimate copy bumped to ~US$0.50–1.20.

## Live incident #2 + fix (2026-07-08, wardrobe-idea test run) — TRUNCATION
Danny's 2nd test (TikTok-Shop wardrobe idea, run 04:56–05:04Z — same run as incident #1 below)
had costs/marketing/synthesis all FAIL with "Response truncated at N output tokens" on **both**
attempts — the old retry reused the SAME maxTokens, so a truncated call was guaranteed to truncate
again (synthesis burned 2×6144 = 12,288 output tokens for nothing; marketing 2×3072 with 119k input
tokens of search results). Competitors succeeded live (7 found); synthesis failing killed all 8 of
its sections incl. Considerations & Next Steps. **Fix (verified tsc/lint/56 tests/build):**
- `AICallError` now carries `kind: 'truncated' | 'no_text'`; `aiStep()` takes `baseMaxTokens` and
  passes the cap into each attempt — on a truncated attempt the next attempt runs at **double** the
  cap (only generated tokens are billed, so high caps are cost-safe).
- Base caps raised for Sonnet 5 verbosity: competitors 4096→8192, costs 2048→4096, financing
  4096→8192, compliance 3072→6144, marketing 3072→8192, **synthesis 6144→16384**, fallbacks
  3072→4096. (Model output ceilings: Sonnet 5 = 128K, Haiku 4.5 = 64K — plenty of headroom.)
- The wardrobe report row still holds the failed sections; regenerate it to fill them under the
  new caps. Cost note: dashboard vs app was $1.53 vs $1.70 (~10% over) — Danny will collect margins
  over future runs before tweaking pricing constants; per-run comparator is `_meta.cost_usd`.

## Live incident #1 + fix (2026-07-08, Danny's first test run)
Danny's test report generated fully but the page sat on the progress screen forever: the row was
stuck `status='running'` with all sections present and **no `_meta`** — same signature as the old
"HMR orphaned the run" incident, but the real cause is general: **Inngest re-executes the whole
function body at every step boundary** (memoizing completed steps), and the "mark running" +
progressive `persistSections()` writes lived OUTSIDE `step.run`. The final replay (after `assemble`
set status complete) re-ran them, flipping status back to 'running' and overwriting sections without
`_meta`. **Fix:** `mark-running` and every persist are now their own memoized steps
(`persist-competitors`/`-costs`/`-funding`/`-compliance`/`-marketing`/`-synthesis`). Rule going
forward: **no non-idempotent side effects outside `step.run` in Inngest functions.**
Danny's stuck row (`a33e9e55…`) was manually repaired to `complete` (approved); its `_meta` was
lost to the stomp, so that one report shows no cost line — row-level cost_usd (1.6952 cumulative)
survived. Next run will have full `_meta`.
Also observed: **duplicate `generate-teaser` runs** at identical timestamps — dev StrictMode
double-mounts ProgressScreen, both mount-POSTs race past the existing-report check and each fires
the event. Costs ~2× a Haiku teaser call in dev; benign but worth a dedupe guard someday.

## Verification
- `tsc --noEmit` clean, `next build` clean (incl. static prerender of `/sample-report`, which uses
  the edited `FullReportViewer` — confirms the render path doesn't crash), `vitest` 56 pass, eslint
  clean on all touched files. Replay-safety fix re-verified same (tsc/lint/56 tests).
- **NOT live-tested end-to-end.** The fallback/partial banners + real cost accounting need a
  signed-in **paid** full-report run (the automated preview session can't auth, and a real run costs
  money). Recommend Danny run one full report and confirm: (a) app cost ≈ Anthropic dashboard, (b) a
  forced competitor/compliance failure still fills the tab. Deferred the user's "regenerate this
  section" idea to a later task.

---

# Handoff — 2026-07-08 (Admin UI redesign — session status / pick-up point)

**START HERE.** After the 9-block admin backend (done, below), building an admin UI
redesign per `docs/plan/2026-07-08-admin-ui-redesign.md` (sidebar shell, snapshot
dashboard, pagination, error log). Migrations 003-008 were RUN by Danny and the database
is updated/tested through 008. Branch still `feat/report-appendix-editlimit-demo-mode`, **NOT pushed**.

## Redesign progress
- ✅ `2ece586` lint cleanup — **0 lint problems** now (all pre-existing issues fixed).
- ✅ `1a0537c` **R1** — sidebar shell (collapsible, grouped nav, mobile drawer, full
  width) + design-system primitives in `src/components/admin/` (AdminCard/StatCard/
  WidgetCard/SectionLabel). Added **lucide-react**. Danny eyeballed it — good.
- ✅ `4f693f0` **R2** — snapshot dashboard: 10 widgets (KPI cards w/ sparklines,
  overview chart w/ tabs, report-types donut, report costs, today's sales, latest
  affiliates, latest feedback) in a 4-col grid with **Edit-layout** drag-reorder +
  width-snap (¼/½/¾/full), persisted per-admin to `localStorage['admin.dashboard.
  layout.v1:<adminId>']`, Reset button. Added **@dnd-kit/core,/sortable,/utilities**.
  New `/api/admin/dashboard` aggregate route; reuses stats/graphs/sales routes.
- ✅ `ddc2700` reduced card roundness `rounded-2xl`→`rounded-lg` (Danny's request).
- ✅ `3ed7089` **R3** — pagination on all admin lists. Adds shared `Pagination`
  (in `src/components/admin/`) + 25/page server-side pagination to
  Users/Affiliates/Offers/Feedback lists (URL `?page=`). `tsc` + lint clean.
- ⬜ **R4 error log — NOT STARTED** (last redesign block). Plan: migration 009
  `error_log` table + `src/lib/log-error.ts` (best-effort service-role insert) wired into
  admin-route/inngest catch blocks + an admin **Errors** page (`/app/admin/errors`,
  paginated, copy button) so Danny can paste logs here. Sidebar already links to it (404s
  until built).

## Redesign — next session
1. Build R4 (error log) — Sonnet; needs migration 009 run by Danny after.
2. Danny still to test R2 live: Edit-layout drag/resize + persistence + reset.
3. Before deploy/merge, either build R4 or hide the current `/app/admin/errors` sidebar link
   so the admin nav does not point at a 404.

---

# Handoff — 2026-07-07 (Admin backend — session status / pick-up point)

**START HERE.** Admin-backend master plan (`docs/plan/2026-07-07-admin-backend-master-plan.md`)
being built block-by-block via Sonnet/Opus subagents. Progress this session:

## Branch & commits
- Branch: **`feat/report-appendix-editlimit-demo-mode`** — 10 commits, **NOT pushed** (Vercel
  deploys from main, so nothing here is live in prod yet). **Admin backend is COMPLETE
  (all 9 blocks).**
  1. `6c0fe50` report Q&A appendix + edit nudge/limit + admin demo mode (plans A–D)
  2. `d3f7208` Block 1 — admin shell (`/app/admin`, gate, sub-nav)
  3. `269613c` Block 9 — report feedback/ratings + homepage testimonials
  4. `91b6c27` Block 2 — analytics foundation (page_events, /api/track, RPCs)
  5. `5af8d00` Block 3 — usage dashboard (period picker, /api/admin/stats)
  6. `3d51509` Block 4 — affiliate links + click tracking + rewrite engine
  7. `03641f1` Block 5 — user management (list/detail/invite/delete w/ 3 server guards)
  8. `148e4df` Block 6 — discounts & offers (admin CRUD + homepage/account banners)
  9. `a7fa300` Block 7 — sales & cost tracking (reports.cost_usd + Sales P&L tab)
  10. `3c3cd6e` Block 8 — growth graphs (recharts; traffic/reports/signups/sales +
      referrer & campaign conversion tables) — **admin backend COMPLETE**

## Migrations — 003–008 ALL RUN ✅
003–008 all applied by Danny and tested working on site. Next pending is **009
(error_log)** once R4 is built.

## Verified live (local) this session
- Block 4 affiliate links: Danny created a link, clicked it — redirect + click tracking
  work. ✅
- Blocks 1/2/3/9 built + tsc/test/build-clean but NOT yet click-tested live by Danny.

## Block 5 — DONE (committed `03641f1`, verified next session)
Agent had actually finished writing all files before it died last night; re-verified this
session: tsc clean, build succeeds, lint = same 9 pre-existing problems (zero new). Delete
route confirmed to carry all three server guards (admin re-check, server-fetched email must
equal typed email, admin accounts 403) + audit logging. **Setup dependency: "add account"
uses `auth.admin.inviteUserByEmail`, which needs Supabase SMTP configured — until then
invites error with a clean "email delivery isn't configured" message.**
- Deletion cascade for Block 5 was pre-verified: `auth.users → profiles → ideas →
  answers/reports → purchases` all `on delete cascade`, so `auth.admin.deleteUser` is clean.
- If Block 5's "add account/invite" needs Supabase SMTP, that's a Danny setup step.

## Admin backend — ALL 9 BLOCKS DONE. Before it's usable in prod:
1. **Migrations 003-008 are already run** in Supabase/database updated. Next pending is
   migration 009 (`error_log`) after R4 is built.
2. **Verify live locally**: click through `/app/admin` (dashboard tiles + graphs),
   Affiliates (done ✅), Users, Offers, Sales, Feedback. Submit a feedback rating on a
   report; feature it; confirm it shows on `/`.
3. **Setup deps still needed**: Supabase SMTP (for the Users "invite" action) and Stripe
   (Phase 5 — offers redemption + real revenue; Sales tab shows $0 until then).
4. **To deploy**: push the branch + merge to `main` (Vercel deploys from main), and confirm
   the target Supabase project is already updated through migration 008 before prod traffic
   depends on these admin features.
Standing rules in play: cheapest capable model, terse, ask before unrequested work,
deletion always confirms, every admin API route self-gates isAdminEmail + service-role only
after the check.

---

# Handoff — 2026-07-07 (Block 2 — analytics foundation)

Block 2 of the admin-backend master plan built (event pipeline, sessions,
referrer/UTM attribution, aggregation RPCs). **Nothing committed.**

## Needs Danny
- ~~Run migrations 004/005/006~~ — **DONE 2026-07-07** (Danny ran 004 report_feedback,
  005 analytics_events, 006 affiliate_links in the Supabase SQL editor). DB is current
  through Block 4.

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
- **Domain**: ~~Danny registered **hadidea.com**, may use it for this project. Nothing wired yet.~~ RESOLVED 2026-07-10: domain live on Vercel, Supabase auth updated, and the brand renamed to **HadIdea** across the app (see rebrand entry at top).

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
