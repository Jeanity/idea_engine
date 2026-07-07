-- Migration 007: discounts & special offers (Block 6)
-- Run in Supabase SQL editor after 006_affiliate_links.sql. RUN MANUALLY.
--
-- Pre-Stripe scaffolding: this table is CREATE + DISPLAY only. Phase 5 maps
-- `code` to a real Stripe promotion code (stripe_promotion_code_id) and
-- handles redemption/enforcement — neither happens here.
--
-- RLS decision (recorded here + in the plan HANDOFF):
--   Writes are service-role only (no write policies at all) — admin CRUD goes
--   through an isAdminEmail-gated API route (/api/admin/offers) that uses the
--   service client, same pattern as affiliate_links.
--   Reads: two narrow SELECT policies, both scoped to "live" offers
--   (active = true AND now() within [starts_at, coalesce(ends_at, 'infinity')]):
--     - public (anon): only rows with show_on_homepage = true AND audience in
--       ('new_users','everyone') — the homepage banner reads these with the
--       public (anon) client. Offers aren't secret, so this is safe.
--     - authenticated: only rows with show_in_account = true (no audience
--       filter here) — the account banner applies the FULL audience rule in
--       app code ('everyone' and 'account_holders' always shown to a signed-in
--       viewer; 'new_users' only if profile.created_at is within the new-user
--       window). That decision needs profile.created_at, which RLS can't see
--       from the offers table alone, so this policy stays audience-agnostic
--       and the app is the actual gate for 'new_users' rows.

create type public.offer_audience as enum ('new_users', 'account_holders', 'everyone');

create table public.offers (
  id                      uuid primary key default gen_random_uuid(),
  code                    text not null unique,                 -- "LAUNCH20"
  description             text not null,                        -- shown to users
  percent_off             int null check (percent_off between 1 and 100),
  amount_off_cents        int null,                              -- alternative to percent
  audience                public.offer_audience not null default 'everyone',
  show_on_homepage        boolean not null default false,
  show_in_account         boolean not null default false,
  starts_at               timestamptz not null default now(),
  ends_at                 timestamptz null,
  max_redemptions         int null,
  redemption_count        int not null default 0,
  active                  boolean not null default true,
  stripe_promotion_code_id text null,                            -- filled by Phase 5
  created_at              timestamptz not null default now()
);

create index idx_offers_active on public.offers (active) where active = true;

alter table public.offers enable row level security;

-- Public/anon: homepage banner. Only live, homepage-flagged offers whose
-- audience includes signed-out visitors (new_users or everyone).
create policy "offers: public select homepage"
  on public.offers for select
  to anon
  using (
    active = true
    and now() >= starts_at
    and now() <= coalesce(ends_at, 'infinity'::timestamptz)
    and show_on_homepage = true
    and audience in ('new_users', 'everyone')
  );

-- Authenticated: account banner. Only live, account-flagged offers — NOT
-- filtered by audience here (see note above); the account banner applies the
-- full audience rule (incl. the 'new_users' <7-day cutoff) in app code.
create policy "offers: authenticated select account"
  on public.offers for select
  to authenticated
  using (
    active = true
    and now() >= starts_at
    and now() <= coalesce(ends_at, 'infinity'::timestamptz)
    and show_in_account = true
  );

-- No insert/update/delete policies → writes are service-role only.
