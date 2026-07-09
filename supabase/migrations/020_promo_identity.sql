-- Migration 020: promo abuse identity tracking (email/browser/IP reuse signals)
-- Run in the Supabase SQL editor after 019_feedback_replies.sql. RUN MANUALLY.
--
-- Promo mode (migration 013) gives every signed-in user a free full report.
-- Nothing stops someone creating fresh accounts to claim repeat freebies —
-- this table records a lightweight identity fingerprint (normalized email,
-- hashed IP, anti-abuse browser cookie) per promo generation so
-- src/lib/promo.ts can flag likely duplicate accounts before granting a new
-- one. This raises the effort required above the reward; it is not meant to
-- be airtight (the admin-set spend/report caps already bound total damage).
--
-- Graceful degradation: until this migration is run, promo continues to work
-- exactly as it does today — src/lib/promo-abuse.ts's I/O wrapper catches the
-- missing-table condition (Postgres 42P01 / PostgREST PGRST205) and skips the
-- email/browser/IP reuse checks entirely rather than failing the request.

create table public.promo_identity (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  normalized_email text not null,
  ip_hash          text,
  ab_id            text,               -- anti-abuse cookie id (ie_ab)
  created_at       timestamptz not null default now()
);

create index on public.promo_identity (normalized_email);
create index on public.promo_identity (ip_hash);
create index on public.promo_identity (ab_id);

alter table public.promo_identity enable row level security;
-- No policies: service-role only, same model as app_settings (migration 013).
