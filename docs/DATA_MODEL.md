# DATA MODEL — Universal Idea Production Engine (MVP)

> Status: Committed for Phases 1–6. This document is the schema contract every later phase codes against. Changing an entity here means changing every phase that depends on it — treat it as load-bearing.

---

## 1. Overview

This document defines the complete persistent data model for the MVP of the Universal Idea Production Engine: a service where a signed-in user submits a raw business idea, the app classifies it into an archetype, asks archetype-specific follow-up questions, runs async research + cost estimation, and produces a structured opportunity report with a free preview and a single paid unlock tier.

The model covers five entities:

1. `public.profiles` — a minimal shadow of `auth.users` for app-level user data.
2. `public.ideas` — the user's raw idea plus its classification and lifecycle status.
3. `public.answers` — one row per guided-wizard question answered.
4. `public.reports` — the async-generated opportunity report, split into free preview sections and full sections.
5. `public.purchases` — a Stripe Checkout unlock granting access to a report's full sections.

**Deliberately excluded (Phase 7 quarantine):** pitches, pitch rooms, supporters, investor connections, equity/success-fee tracking, idea-vault comparisons, multi-tier reports, validation experiments. These carry legal risk (financial promotion, unlicensed intermediation) that we are not underwriting in the MVP. The schema stays clean of them so no accidental promise leaks into product or contract surface.

**Storage:** Supabase Postgres. All application tables live in the `public` schema and are governed by Row Level Security (RLS). Authentication is Supabase-managed (magic link only, no passwords), so user identity lives in `auth.users` and we reference it by UUID.

**Conventions used throughout:**

- All primary keys are `uuid`, generated with `gen_random_uuid()` (built into Postgres via `pgcrypto`).
- Every table has `created_at timestamptz not null default now()` and `updated_at timestamptz not null default now()`.
- `updated_at` is maintained by a shared trigger `set_updated_at()` (defined in the migration; not shown per table).
- All foreign keys are explicit and named; `on delete` behavior is chosen per relationship (see each table).
- All timestamps are `timestamptz`. Never store naive timestamps.
- Enums are implemented as Postgres `check` constraints on `text` columns rather than `create type ... as enum`, because Postgres enums are painful to alter and our statuses will churn during the MVP.
- RLS is `enable`d on every table in `public`; nothing is world-readable.

---

## 2. Entity definitions

### 2.1 `public.profiles`

App-level shadow of `auth.users`. We do **not** duplicate email or password material — Supabase Auth is the source of truth for those. We keep only the fields the app itself needs to attach to a user, and we key it by the same UUID as `auth.users.id` so joins are free.

**Why it exists at all:** RLS policies on `public.*` tables want to compare `auth.uid()` to a column in a `public` table. Having a `profiles` row (created on first sign-in via a trigger) also gives us a clean place to hang MVP-scope app metadata (display name, marketing opt-in, default location for new ideas) without polluting `auth.users`, which Supabase owns and which we should not schema-modify.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | `primary key`, `references auth.users(id) on delete cascade` | Same UUID as the Supabase auth user. Not `default gen_random_uuid()` — it is assigned from `auth.users.id`. |
| `display_name` | `text` | nullable | Optional human name for UI (e.g., dashboard header). Free-text, no uniqueness. |
| `default_country` | `text` | nullable, `check (default_country is null or char_length(default_country) = 2)` | ISO 3166-1 alpha-2. Prefills the location field on `/app/new`. |
| `default_region` | `text` | nullable | City/state string (free text — geocoding is out of scope for MVP). |
| `marketing_opt_in` | `boolean` | `not null default false` | Whether we may email non-transactional messages. Transactional email (report ready, receipt) is always allowed. |
| `created_at` | `timestamptz` | `not null default now()` | |
| `updated_at` | `timestamptz` | `not null default now()` | Maintained by trigger. |

**Auto-provisioning:** a trigger `on auth.users after insert` inserts a matching `profiles` row (`id = new.id`). This guarantees `profiles` is always in sync with `auth.users` without app code doing the write.

**RLS policy pattern:**

- `select`: `auth.uid() = id` — a user can only read their own profile.
- `update`: `auth.uid() = id` — a user can only update their own profile.
- `insert`: disallowed for app code (trigger inserts on their behalf). If we ever want app-side insert, it must also enforce `auth.uid() = id`.
- `delete`: disallowed via RLS. Cascades from `auth.users` handle account deletion.

---

### 2.2 `public.ideas`

The user's submitted business idea plus its classification and where it currently sits in the guided-flow lifecycle.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | `primary key default gen_random_uuid()` | |
| `owner_id` | `uuid` | `not null`, `references profiles(id) on delete cascade` | The user who submitted the idea. Cascades on account deletion. Named `owner_id` (not `user_id`) to keep RLS predicates readable. |
| `raw_text` | `text` | `not null`, `check (char_length(raw_text) between 1 and 4000)` | Exact user-typed idea. Never mutated after insert — the "restatement" lives on the report side. |
| `archetype` | `text` | `not null`, `check (archetype in ('physical_product','local_service','software_app','ecommerce_brand','content_education','marketplace','invention','other'))` | Classifier output OR user override. Taxonomy is fixed for MVP (see `docs/ARCHETYPES.md`). |
| `archetype_source` | `text` | `not null default 'classifier'`, `check (archetype_source in ('classifier','user_override'))` | Records whether the current archetype came from the AI or was overridden on the confirmation screen. Cheap analytics + eval signal. |
| `archetype_confidence` | `numeric(3,2)` | nullable, `check (archetype_confidence is null or (archetype_confidence >= 0 and archetype_confidence <= 1))` | Classifier's self-reported confidence (0.00–1.00). Null when archetype came from a manual override. |
| `location_country` | `text` | `not null`, `check (char_length(location_country) = 2)` | ISO 3166-1 alpha-2. Required — competitor and compliance research need it. |
| `location_region` | `text` | nullable | City/state free text. |
| `restatement` | `text` | nullable | The classifier's one-line paraphrase shown on the confirmation screen. Kept for continuity and later report intro. |
| `status` | `text` | `not null default 'draft'`, `check (status in ('draft','questioning','researching','ready'))` | Lifecycle — see §4.1. |
| `created_at` | `timestamptz` | `not null default now()` | |
| `updated_at` | `timestamptz` | `not null default now()` | |

**Indexes:**

- `idx_ideas_owner_id_created_at desc` — powers "my ideas" dashboard list.
- `idx_ideas_status` — for future admin/cleanup queries; cheap and low-write.

**RLS policy pattern:**

- `select`: `auth.uid() = owner_id`.
- `insert`: `auth.uid() = owner_id` (server sets it from the session; client cannot fabricate).
- `update`: `auth.uid() = owner_id`. Updates are allowed on `archetype`, `archetype_source`, `location_*`, `restatement`, `status`. `raw_text` and `owner_id` should be treated as immutable at the app layer.
- `delete`: `auth.uid() = owner_id`. (MVP has no UI for delete, but the policy is present so we can add "delete idea" later without a schema change.)

---

### 2.3 `public.answers`

One row per answered wizard question. Static-bank questions and dynamic follow-ups live in the same table — the distinction is not persisted, because we do not need to reconstruct where a question came from; we only need the answer for the pipeline.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | `primary key default gen_random_uuid()` | |
| `idea_id` | `uuid` | `not null`, `references ideas(id) on delete cascade` | Cascades: deleting an idea drops its answers. |
| `question_key` | `text` | `not null`, `check (char_length(question_key) between 1 and 80)` | Stable machine key (e.g., `product_home_based`, `product_batch_yield`). Matches `maps_to` contract in `docs/QUESTIONS.md`. |
| `question_text` | `text` | `not null` | Human-visible prompt at the time of answering. Snapshotted here so a later prompt-copy edit doesn't retroactively change an old answer's context. |
| `answer_text` | `text` | `not null` | Canonical serialized answer. For `select` = the selected option's value; for `multiselect` = JSON array as text; for `number` = the number as text. Storing as text (rather than JSONB) keeps display and eval trivial; the pipeline parses per `input_type` (which it knows from the static bank + dynamic prompt). |
| `position` | `integer` | `not null`, `check (position >= 0)` | Order the question was presented in the wizard. Enables deterministic resume and the summary screen. |
| `created_at` | `timestamptz` | `not null default now()` | |
| `updated_at` | `timestamptz` | `not null default now()` | Bumps when the user edits an answer from the summary screen. |

**Constraints:**

- `unique (idea_id, question_key)` — each question is answered at most once per idea. Editing an answer is an `update`, not an insert. This makes autosave idempotent (`upsert on conflict (idea_id, question_key) do update`).

**Indexes:**

- The `unique (idea_id, question_key)` index already covers per-idea lookups.
- `idx_answers_idea_id_position` — supports "load the wizard state in display order" without a sort.

**RLS policy pattern:**

Answers do not carry an owner column directly. Ownership is inherited from the parent idea. Policies use an `exists` subquery:

- `select`: `exists (select 1 from ideas i where i.id = answers.idea_id and i.owner_id = auth.uid())`.
- `insert`: same predicate on the target `idea_id`.
- `update`: same.
- `delete`: same. (No UI, but safe to allow.)

This pattern (RLS via parent-owner subquery) is deliberate — it keeps ownership in one place (`ideas.owner_id`) and avoids a denormalized `owner_id` on `answers` that could drift.

---

### 2.4 `public.reports`

The async-generated opportunity report for an idea. One idea can have at most one report in MVP — regeneration is an update, not a new row (see design decisions).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | `primary key default gen_random_uuid()` | |
| `idea_id` | `uuid` | `not null`, `references ideas(id) on delete cascade`, `unique` | One report per idea in MVP. The `unique` constraint enforces that at the DB level. |
| `owner_id` | `uuid` | `not null`, `references profiles(id) on delete cascade` | Denormalized from `ideas.owner_id` so RLS policies on `reports` (and on `purchases`, which joins to `reports`) do not have to `exists`-subquery through `ideas`. Set by the server on insert; must equal the parent idea's owner (enforced by app code, not DB — a future migration could add a trigger). |
| `status` | `text` | `not null default 'queued'`, `check (status in ('queued','running','complete','failed'))` | Lifecycle — see §4.2. |
| `sections` | `jsonb` | `not null default '{}'::jsonb` | Full report body — every section, including preview and paid. Section-level unavailability is represented inside the JSON (see §5). |
| `preview_sections` | `jsonb` | `not null default '{}'::jsonb` | Subset of `sections` that is free to view. Duplicated (not referenced) so the read path for the anonymous/no-purchase case is a single column read with zero server-side filtering logic. See design decisions for why this duplication is worth it. |
| `error` | `text` | nullable | Human-readable failure summary when `status = 'failed'`. Not shown verbatim to the user; drives the retry-screen copy. |
| `generation_started_at` | `timestamptz` | nullable | Set when status transitions `queued → running`. |
| `generation_completed_at` | `timestamptz` | nullable | Set when status transitions to `complete` or `failed`. `completed_at - started_at` gives per-report generation duration for cost/quality logging. |
| `model_version` | `text` | nullable | Free-text tag of the model + prompt version used (e.g., `sonnet-4.5+prompts-v3`). Enables post-hoc quality analysis when we swap models. |
| `created_at` | `timestamptz` | `not null default now()` | |
| `updated_at` | `timestamptz` | `not null default now()` | Bumps on each Inngest step's write. |

**Indexes:**

- `unique (idea_id)` — already implied by the column constraint.
- `idx_reports_owner_id_created_at desc` — powers "my reports" page.
- `idx_reports_status` — for background sweeps (stuck-report retry cron, if we add one).

**RLS policy pattern:**

- `select`: `auth.uid() = owner_id`. Full-section content is protected by the *application*, not RLS — see design decisions. RLS guarantees you cannot even see someone else's report row; the client-side split between preview and full sections is enforced by which columns the server chooses to return based on purchase status.
- `insert`: `auth.uid() = owner_id`. Only the server creates reports (via authenticated session).
- `update`: `auth.uid() = owner_id`. In practice only the Inngest worker writes updates; it uses the service role (which bypasses RLS by design) so this policy is only exercised if we ever expose a user-triggered edit.
- `delete`: `auth.uid() = owner_id`. No UI in MVP.

**Note on service-role writes:** the Inngest worker uses the Supabase service role key (server-only) which bypasses RLS. That is intentional and safe as long as the worker never trusts a user-supplied `owner_id`; it derives owner from the parent `idea_id`.

---

### 2.5 `public.purchases`

A completed Stripe Checkout session that unlocks the full sections of a specific report for the buyer.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | `primary key default gen_random_uuid()` | |
| `user_id` | `uuid` | `not null`, `references profiles(id) on delete cascade` | The buyer. Cascades on account deletion — the purchase record goes with the user (Stripe retains its own record on their side). |
| `report_id` | `uuid` | `not null`, `references reports(id) on delete cascade` | The report being unlocked. Cascades — if the underlying report is deleted, so is the local purchase record. Stripe still has the transaction. |
| `stripe_session_id` | `text` | `not null`, `unique` | `cs_test_…` / `cs_live_…`. Uniqueness is what makes webhook processing idempotent — a replayed `checkout.session.completed` event lands as a no-op via `on conflict do nothing`. |
| `stripe_payment_intent_id` | `text` | nullable, `unique` | Captured from the completed session for future refund / reconciliation flows. Nullable because the webhook that creates the row may arrive before the PI is finalized; unique so we never store the same PI twice. Partial unique index (`where stripe_payment_intent_id is not null`) so nulls don't collide. |
| `amount_cents` | `integer` | `not null`, `check (amount_cents >= 0)` | Amount actually charged, in the smallest currency unit. Snapshotted from the Stripe event so a later price change doesn't retroactively alter the record. |
| `currency` | `text` | `not null`, `check (char_length(currency) = 3)` | ISO 4217, lowercase (Stripe convention: `aud`). |
| `status` | `text` | `not null`, `check (status in ('pending','complete','refunded','failed'))` | Lifecycle — see design decisions. MVP unlock check is `status = 'complete'`. |
| `completed_at` | `timestamptz` | nullable | Set when `status` first becomes `complete`. |
| `refunded_at` | `timestamptz` | nullable | Set when `status` becomes `refunded`. |
| `created_at` | `timestamptz` | `not null default now()` | |
| `updated_at` | `timestamptz` | `not null default now()` | |

**Constraints:**

- `unique (stripe_session_id)` — hard idempotency for webhook retries.
- `unique (stripe_payment_intent_id) where stripe_payment_intent_id is not null` — partial unique index; declared in the migration alongside the table.
- **No** `unique (user_id, report_id)` on the raw table — because a purchase may be `refunded` and a user might legitimately re-purchase. Instead, MVP enforces "one active unlock per user-report" at the app layer: the checkout endpoint refuses to create a session when a `complete` purchase already exists for `(user_id, report_id)`. If we later want it in the DB, a partial unique index (`unique (user_id, report_id) where status = 'complete'`) is the correct shape.

**Indexes:**

- `idx_purchases_user_id_created_at desc` — powers "my reports" unlocked-badge lookup.
- `idx_purchases_report_id_status` — powers the per-report "is this unlocked for me?" check on the report viewer server render.

**RLS policy pattern:**

- `select`: `auth.uid() = user_id` — a user sees only their own purchase records.
- `insert`: disallowed for user contexts. The Stripe webhook handler uses the service role key (bypasses RLS) to insert rows. This is deliberate: users cannot ever fabricate a purchase from the client.
- `update`: disallowed for user contexts. Same reason — status transitions come from Stripe webhooks via service role.
- `delete`: disallowed via RLS. Cascades handle account/report deletion.

---

## 3. Relationships — ASCII ER diagram

```
                       +---------------------+
                       |    auth.users       |   (Supabase-managed)
                       |---------------------|
                       | id  (uuid, PK)      |
                       | email               |
                       | ...                 |
                       +----------+----------+
                                  |
                                  | 1:1  (trigger on insert)
                                  v
                       +---------------------+
                       |  public.profiles    |
                       |---------------------|
                       | id (uuid, PK,       |
                       |   FK -> auth.users) |
                       | display_name        |
                       | default_country     |
                       | default_region      |
                       | marketing_opt_in    |
                       | created_at          |
                       | updated_at          |
                       +----------+----------+
                                  |
              +-------------------+---------------------+
              |                                         |
              | 1:N (owner_id)                          | 1:N (user_id)
              v                                         |
    +-------------------+                               |
    |  public.ideas     |                               |
    |-------------------|                               |
    | id (uuid, PK)     |                               |
    | owner_id (FK)     |                               |
    | raw_text          |                               |
    | archetype         |                               |
    | archetype_source  |                               |
    | archetype_conf.   |                               |
    | location_country  |                               |
    | location_region   |                               |
    | restatement       |                               |
    | status            |                               |
    | created_at        |                               |
    | updated_at        |                               |
    +---------+---------+                               |
              |                                         |
      +-------+-------+                                 |
      |               |                                 |
      | 1:N           | 1:1 (unique idea_id)            |
      v               v                                 |
+-----------------+   +-------------------+             |
| public.answers  |   |  public.reports   |             |
|-----------------|   |-------------------|             |
| id (PK)         |   | id (PK)           |             |
| idea_id (FK)    |   | idea_id (FK,uniq) |             |
| question_key    |   | owner_id (FK)     |<-- denormalized from ideas.owner_id
| question_text   |   | status            |             |
| answer_text     |   | sections (jsonb)  |             |
| position        |   | preview_sections  |             |
| created_at      |   | error             |             |
| updated_at      |   | generation_*_at   |             |
+-----------------+   | model_version     |             |
                      | created_at        |             |
                      | updated_at        |             |
                      +---------+---------+             |
                                |                       |
                                | 1:N (report_id)       |
                                v                       v
                              +-----------------------------+
                              |     public.purchases        |
                              |-----------------------------|
                              | id (PK)                     |
                              | user_id (FK -> profiles)    |
                              | report_id (FK -> reports)   |
                              | stripe_session_id (unique)  |
                              | stripe_payment_intent_id    |
                              | amount_cents                |
                              | currency                    |
                              | status                      |
                              | completed_at                |
                              | refunded_at                 |
                              | created_at                  |
                              | updated_at                  |
                              +-----------------------------+
```

**Cardinality summary:**

- `auth.users` 1 ── 1 `profiles` (trigger-enforced on insert).
- `profiles` 1 ── N `ideas` (via `ideas.owner_id`).
- `ideas` 1 ── N `answers` (via `answers.idea_id`, uniqueness on `(idea_id, question_key)`).
- `ideas` 1 ── 1 `reports` (via `reports.idea_id unique`; MVP allows only one report per idea).
- `profiles` 1 ── N `purchases` (via `purchases.user_id`).
- `reports` 1 ── N `purchases` (via `purchases.report_id`; multiple rows possible if a purchase is refunded and re-attempted, but at most one `complete` at a time is enforced by app logic).

**Cascade summary:**

- Deleting `auth.users` → cascades to `profiles` → cascades to `ideas`, `purchases` → cascades to `answers`, `reports` → cascades to `purchases` (via report). Net effect: full account deletion removes all app-side rows in one operation. Stripe's records are unaffected and remain the source of truth for financial history.

---

## 4. Status flows

### 4.1 `ideas.status` state machine

```
   [new row]
       |
       v
   +---------+     wizard opens     +--------------+   all required   +---------------+   report done   +---------+
   |  draft  | -------------------> | questioning  | ---------------> |  researching  | --------------> |  ready  |
   +---------+                      +--------------+   answers saved  +---------------+                 +---------+
       ^                                   |                                  ^
       |                                   |    (user leaves and returns:     |
       |                                   |     status stays 'questioning'   |
       |                                   |     while answers autosave)      |
       |                                   |                                  |
       +----------- (no reverse transitions in MVP) ------------------------- +
```

**Transition rules (enforced by the API layer, not by DB constraints — kept explicit here so any developer/AI can implement them consistently):**

| From | To | Trigger | Notes |
|---|---|---|---|
| — | `draft` | `POST /api/ideas` succeeds and the classifier returns an archetype (or falls back to `other`). | Initial insert. |
| `draft` | `questioning` | User confirms the archetype on the confirmation screen and is routed into the wizard. | Also allowed if the user overrode the archetype. |
| `questioning` | `researching` | Final wizard question is answered AND the user hits "Generate my report". | The transition and the `reports` row insert happen in the same server request so state cannot desync. |
| `researching` | `ready` | Inngest report job reaches `status = 'complete'`. The idea's status update is triggered by the same worker step that marks the report complete. |

**Explicitly disallowed in MVP:** any reverse transition, and any skip (e.g., `draft → researching`). Report regeneration keeps the idea at `ready` and only mutates the `reports` row.

---

### 4.2 `reports.status` state machine

```
   [insert]
       |
       v
   +---------+   worker picks up   +----------+   all steps ok   +-----------+
   | queued  | ------------------> | running  | ---------------> | complete  |
   +---------+                     +----------+                  +-----------+
                                        |
                                        | unrecoverable error
                                        v
                                   +----------+
                                   |  failed  |
                                   +----------+
                                        |
                                        | user hits "retry" (Phase 4.8)
                                        v
                                   +----------+
                                   |  queued  |  (same row, re-queued)
                                   +----------+
```

**Transition rules:**

| From | To | Trigger | Notes |
|---|---|---|---|
| — | `queued` | `POST /api/reports` creates the row and fires the Inngest event. | `generation_started_at` = null. |
| `queued` | `running` | Inngest function's first step begins. | Sets `generation_started_at = now()`. |
| `running` | `complete` | All steps have written their section into `sections` (with per-section availability markers where applicable). | Sets `generation_completed_at = now()` and updates the parent idea to `ready` in the same transaction. |
| `running` | `failed` | An unrecoverable error occurs after retries are exhausted. | Sets `generation_completed_at = now()`, `error = <human summary>`. |
| `failed` | `queued` | User-initiated retry. | Clears `error`, resets `generation_started_at` and `generation_completed_at` to null. The row is reused; no new `reports` row is created. |

**Partial failure vs `failed`:** the pipeline architecture (Phase 4.1) treats a single-section failure as "section unavailable" *inside* `sections`, not as an overall `failed` status. Only pipeline-level failures (e.g., all-sections-failed, catastrophic prompt error, config error) transition the report to `failed`.

---

## 5. JSONB schemas — `reports.sections` and `reports.preview_sections`

Both columns are Postgres `jsonb`. They are not schema-validated by the database; the shape is enforced by the pipeline (Phase 4) and consumed by the report viewer (Phase 4.7) plus the paid-unlock check (Phase 5). Any addition here requires an accompanying update to `docs/REPORT_SPEC.md`.

### 5.1 Section keys and shapes

The canonical top-level keys in `sections`:

| Key | Type | Preview? | Description |
|---|---|---|---|
| `summary` | `string` (markdown) | ✅ preview | 1–2 paragraph plain-language restatement of the idea + the top-line takeaway. |
| `viability_snapshot` | `object` | ✅ preview | See below. |
| `competitors` | `array<object>` | ✅ preview shows first 2 items | Real competitors with source URLs; see below. |
| `cost_breakdown` | `object` \| `null` | ❌ paid | Deterministic cost engine output for product archetypes. `null` for archetypes where it doesn't apply (e.g., `content_education`). |
| `pricing_recommendation` | `object` | ❌ paid | Suggested price + margin logic. |
| `legal_compliance` | `array<object>` | ❌ paid | Compliance flags with official-source links + disclaimer. |
| `risks` | `array<object>` | ❌ paid | Key risks with likelihood + mitigation notes. |
| `next_steps` | `array<string>` | ❌ paid | Ordered action list for the operator. |

**Every section object also carries a `status` field:**

```json
{ "status": "ok" | "unavailable", "reason": "<optional string>" , ...content }
```

If a step fails after retries, its section is written as `{ "status": "unavailable", "reason": "…" }` with no content — the viewer renders a "This section is unavailable" placeholder without failing the whole report (see §4.2).

### 5.2 Detailed shapes

```jsonc
// sections.summary
"summary": "Homemade dog treats sold at local weekend markets ..."   // markdown string

// sections.viability_snapshot
"viability_snapshot": {
  "status": "ok",
  "verdict": "promising" | "mixed" | "challenging",
  "one_line": "Low startup cost, saturated market, differentiate on ingredients.",
  "top_strengths": ["...", "..."],
  "top_concerns": ["...", "..."]
}

// sections.competitors  (array)
"competitors": [
  {
    "status": "ok",
    "name": "Sniff & Bark Treats",
    "url": "https://sniffandbark.example.com",
    "location_scope": "local" | "national" | "global",
    "pricing_note": "~$12 per 200g bag",
    "positioning": "Grain-free, sourced locally in Brisbane.",
    "gap_notes": "No subscription option; weak SEO on 'homemade dog treats Brisbane'."
  }
  // ... more competitors
]

// sections.cost_breakdown  (null for non-product archetypes)
"cost_breakdown": {
  "status": "ok",
  "unit_yield": 40,
  "materials": [
    { "name": "Oat flour", "unit_cost": 0.02, "quantity_per_batch": 500, "cost_per_batch": 10.00, "source": "user" | "estimated" }
  ],
  "power": {
    "watts": 1800,
    "hours_per_batch": 0.75,
    "kwh": 1.35,
    "local_kwh_price": 0.32,
    "cost_per_batch": 0.43
  },
  "labour": {
    "active_minutes_per_batch": 45,
    "hourly_rate": 30.00,
    "cost_per_batch": 22.50,
    "passive_machine_minutes_per_batch": 30   // tracked but not billed
  },
  "packaging_per_unit": 0.35,
  "per_unit_cost": 1.16,
  "notes": ["Estimated ingredient prices where user did not specify."]
}

// sections.pricing_recommendation
"pricing_recommendation": {
  "status": "ok",
  "suggested_price": 8.00,
  "currency": "AUD",
  "margin_pct": 85.5,
  "reasoning": "Priced against 3 competitors at $7–$12; margin sustains market fees + returns."
}

// sections.legal_compliance  (array)
"legal_compliance": [
  {
    "status": "ok",
    "topic": "Food business notification (QLD)",
    "summary": "Selling homemade pet food at markets typically requires council registration.",
    "official_links": [
      { "label": "Queensland Health — food business", "url": "https://..." }
    ],
    "disclaimer": "This is general information, not legal advice."
  }
]

// sections.risks  (array)
"risks": [
  {
    "status": "ok",
    "title": "Ingredient sourcing concentration",
    "likelihood": "medium",
    "impact": "medium",
    "mitigation": "Line up a second wholesaler before scaling past 20 units/week."
  }
]

// sections.next_steps  (array of strings)
"next_steps": [
  "Register your business name and check ABN requirements.",
  "Buy 2 weeks of ingredients and run a costed test batch.",
  "..."
]
```

### 5.3 `preview_sections`

`preview_sections` is a **strict subset copy** of `sections` containing:

- `summary` (full)
- `viability_snapshot` (full)
- `competitors` (first 2 items only)

That's it. Nothing else is duplicated. The report viewer:

- Reads `preview_sections` when the user does **not** hold a `complete` purchase for the report.
- Reads `sections` when the user does.

No client-side filtering is ever trusted. The server chooses which column to include in the response based on a server-side purchase check.

### 5.4 Invariants (enforced by the pipeline, not the DB)

- `preview_sections.summary === sections.summary`
- `preview_sections.viability_snapshot === sections.viability_snapshot`
- `preview_sections.competitors.length <= 2` and each element `===` the corresponding element in `sections.competitors`
- `preview_sections` never contains `cost_breakdown`, `pricing_recommendation`, `legal_compliance`, `risks`, or `next_steps`

---

## 6. Design decisions

### 6.1 Why a `public.profiles` shadow table exists

`auth.users` is managed by Supabase and we should not schema-modify it. But every RLS policy on `public.*` wants to compare `auth.uid()` to *something in our schema*, and we want a place to store app-level user metadata (default country, marketing opt-in). A minimal `profiles` table keyed by the same UUID as `auth.users.id`, populated by an `on auth.users after insert` trigger, gives us both without duplicating email or auth secrets. This is the standard Supabase pattern and everything downstream (RLS on `ideas`, `reports`, `purchases`) is cleaner because of it.

### 6.2 Why `reports.owner_id` is denormalized

`reports` could derive ownership by joining through `ideas.owner_id`. RLS would then need an `exists` subquery on every read. `reports` is on the hot path for the report viewer *and* is joined by `purchases` for RLS. Duplicating `owner_id` on `reports` removes one join from the hottest read, keeps the RLS policy trivially the same shape as `ideas`, and matches how we'll want to write "list this user's reports" queries. The tradeoff is one column of drift risk, mitigated by the fact that only the server writes reports and it derives `owner_id` from the parent idea in the same transaction.

### 6.3 Why `preview_sections` is a separate column, not a computed view

Storing the preview as its own JSONB column costs a few KB per report and buys three concrete things:

1. **Zero-logic paywall read.** When a user hits `/app/reports/[id]` without a purchase, the server sends back `preview_sections` verbatim. There is no server-side filtering step that could bug-out and leak a paid section. If the column is empty, the viewer renders "unavailable"; it never accidentally sends `sections`.
2. **Auditability.** We can inspect any report and see exactly what a non-paying user saw at the time.
3. **Version resilience.** If we later change what counts as "preview" (e.g., include the first risk), old reports keep their historical preview shape; new reports get the new shape. Nothing retroactively changes.

The alternative (compute preview from `sections` on read) is smaller but couples the paywall to a filter function that has to stay correct forever across model/prompt changes. Not worth the risk for a single JSONB column.

### 6.4 One report per idea (`reports.idea_id unique`) — regeneration reuses the row

We deliberately reject "history of report generations" as MVP scope. If a user retries, the same `reports` row is reset to `queued` and re-run. This keeps the "my reports" page trivial (no "which version am I looking at?"), keeps purchases pointed at a stable `report_id`, and keeps the report URL stable across regenerations. If we ever want history, `report_versions` becomes a new table; nothing in the current model needs to move.

### 6.5 `answers.answer_text` as text, not typed columns

Wizard inputs are `text | select | number | multiselect`. We could split by type or use JSONB. We chose a single `text` column because:

- The wizard renderer already knows the `input_type` from the static bank / dynamic prompt; it can parse without a DB-side hint.
- The report pipeline's contract is `maps_to` (documented in `docs/QUESTIONS.md`), not raw column type.
- Debugging in the Supabase UI is trivial when every answer is a plain string.
- `multiselect` values are stored as a JSON-encoded array *inside* the text column (`"[\"a\",\"b\"]"`). Ugly but tolerable at MVP scale.

If wizard analytics ever want structured querying, we add a `answer_value jsonb` column beside `answer_text`; we don't rewrite what's already there.

### 6.6 `answers` uses parent-owner RLS, not a duplicated `owner_id`

Adding `owner_id` to `answers` for faster RLS would optimize a read that isn't hot (we always fetch answers per-idea, not across users). Ownership derivation through `ideas` keeps a single source of truth for who owns what. If autosave latency ever becomes an RLS-subquery problem (it won't at MVP volume), we denormalize then.

### 6.7 `purchases.status` values and why no unique `(user_id, report_id)`

MVP status values: `pending`, `complete`, `refunded`, `failed`.

- `pending` — reserved for the future in case we adopt async payment methods. The MVP's Stripe Checkout flow effectively skips this: rows are inserted directly at `complete` from the `checkout.session.completed` webhook. We keep the status in the enum so we don't have to migrate later.
- `complete` — unlock is live. This is the only status the report viewer checks.
- `refunded` — Stripe refund happened. The unlock is revoked (viewer returns to preview). Historical row is retained for reconciliation.
- `failed` — Stripe reported the payment as failed after initial acceptance (rare; edge case around 3DS and disputes). Included for completeness.

We deliberately did **not** add `unique (user_id, report_id)` on the base table because a `refunded` purchase followed by a new attempt should be allowed. Instead, the checkout endpoint refuses to open a new session when a `complete` purchase already exists — this "one active unlock" invariant lives in application code, close to the Stripe integration where it's easiest to reason about. If we later want the DB to enforce it, the correct form is a partial unique index (`where status = 'complete'`).

### 6.8 `purchases.stripe_session_id unique` is the idempotency mechanism

Stripe delivers webhooks at-least-once. The handler inserts with `on conflict (stripe_session_id) do nothing`. This is simpler and safer than a separate "processed events" table for MVP volume, and it uses the exact identifier Stripe itself uses to dedupe on their side.

### 6.9 Enum-as-check-constraint, not Postgres `enum` type

Postgres `enum` types are painful to modify in a migration (you cannot easily remove or reorder values). Statuses on `ideas`, `reports`, `purchases`, and `archetype` on `ideas` will churn during MVP iteration. Using `text` + `check` lets us alter the constraint with a straight `alter table` — cheap and reversible.

### 6.10 Timestamps and `updated_at` trigger

Every table has `created_at` and `updated_at` maintained by a shared trigger function `set_updated_at()`:

```sql
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;
```

Attached `before update` on all five tables in the initial migration. Written once; forgotten forever.

### 6.11 Where RLS is bypassed on purpose

Two paths use the Supabase **service role key** (server-only) and therefore bypass RLS:

1. The **Inngest worker** writing to `reports.sections` / `status`. It never trusts user-supplied identifiers; it derives owner from the parent idea.
2. The **Stripe webhook handler** writing to `purchases`. It never trusts client input; the session comes verified from Stripe.

Every other write is through the authenticated user's session and hits RLS. No client code holds the service role key.

### 6.12 What's not in this model — and where it would go

For posterity so the next architect doesn't second-guess the absences:

- **No `pitch_decks`, `pitch_rooms`, `supporters`, `investor_intros`, `equity_grants`, `success_fees`.** These are Phase 7 quarantine and carry regulatory risk we are not underwriting. Do not preemptively model them.
- **No `report_versions`.** One report per idea (§6.4).
- **No `report_tiers`.** Single price, single unlock (Phase 5.1).
- **No `idea_comparisons` / `idea_vault`.** Post-MVP.
- **No `experiments` / validation runs.** Post-MVP.
- **No custom `sessions` table.** Supabase Auth owns sessions.

If any of these come back into scope, they land as **new tables** with foreign keys into the existing model — the current tables should not need to change shape to accommodate them.

---

*End of DATA_MODEL.md — this document is the source of truth for the initial schema migration in Phase 1.3.*
