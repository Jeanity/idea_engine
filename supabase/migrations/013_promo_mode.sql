-- Migration 013: promo mode (app-wide free full reports within admin caps)
-- Run in Supabase SQL editor after 012_contact_submissions.sql. RUN MANUALLY.
--
-- app_settings is a tiny generic key/value store for app-global config that
-- doesn't warrant its own table (promo caps today; the survey on/off flag in
-- migration 014 reuses it too). It is service-role only — no RLS policies —
-- because it can carry operational numbers (spend caps) that regular users
-- should never read directly. User-visible state derived from it is exposed
-- through purpose-built API routes (GET /api/promo-status) that return only
-- what's safe.
--
-- Graceful degradation: until this migration is run, app_settings does not
-- exist and reports.is_promo does not exist. Promo reads must treat that as
-- "promo off" (see src/lib/promo.ts, isMissingTable check on 42P01/PGRST205)
-- rather than crashing.

create table public.app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table public.app_settings enable row level security;
-- No policies: service-role only.

alter table public.reports add column is_promo boolean not null default false;

create index idx_reports_is_promo on public.reports (is_promo) where is_promo;
