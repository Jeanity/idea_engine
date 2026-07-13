-- Migration 030: evergreen country x archetype x section research baselines.
-- Run in the Supabase SQL editor after 029_generation_notify.sql. RUN MANUALLY.
--
-- Country-generic research (business registration, tax, consumer law,
-- privacy — "how to start a business in X") was being re-purchased on every
-- report. This table caches that research per country x archetype x section,
-- self-populating: the first report from a new key pays for a dedicated
-- one-time baseline research call and stores the result here; every later
-- report from the same key gets the baseline injected free and spends its
-- AI budget only on idea-specific research (src/lib/inngest/generate-report.ts,
-- src/lib/evergreen.ts).
--
-- Phase 1 only wires the `compliance` section (region always ''). The
-- `section` check constraint already allows 'financing' and 'marketing' so
-- those can adopt the same table later with no schema change — do not read
-- from or write to this table for those sections until that work lands.
--
-- Graceful degradation: until this migration is run, getEvergreenBaseline
-- (src/lib/evergreen.ts) catches the missing-table condition (Postgres
-- 42P01 / PostgREST PGRST205) and returns null — the report pipeline falls
-- straight back through to its pre-existing legacy compliance path, and the
-- admin evergreen queue (/app/admin/evergreen) shows a friendly notice
-- instead of crashing, same pattern as bug_reports (018).
create table public.evergreen_baselines (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  country_code        text not null,            -- upper-cased, e.g. 'AU'
  region              text not null default '', -- '' = country-level (phase 1 always '')
  archetype           text not null,
  section             text not null check (section in ('compliance', 'financing', 'marketing')),
  items               jsonb not null,           -- array of ComplianceItem-shaped objects
  review_status       text not null default 'unreviewed' check (review_status in ('unreviewed', 'approved')),
  reviewed_at         timestamptz null,
  generated_by_model  text not null,
  generation_cost_usd numeric not null default 0,
  source_report_id    uuid null,                -- report whose run filled this entry
  expires_at          timestamptz not null,     -- generation time + 180 days
  unique (country_code, region, archetype, section)
);

create index idx_evergreen_lookup on public.evergreen_baselines (country_code, region, archetype, section);

alter table public.evergreen_baselines enable row level security;
-- No policies: service-role only, same stance as app_settings (013) and
-- bug_reports admin reads (018) — the report pipeline (Inngest worker) and
-- the admin queue both use the service client, and there is no user-facing
-- read or write path for this table.
