-- Migration 011: admin-managed sample reports (Block "sample report management")
-- Run in Supabase SQL editor after 010_report_model.sql. RUN MANUALLY.
--
-- Danny curates a rotating set of sample reports from the admin area
-- (/app/admin/samples). Each row is a standalone COPY of a real completed
-- report's content — cloning does not create any FK relationship back to the
-- source report (source_report_id is provenance only, so the source report
-- can later be edited or deleted without affecting the sample).
--
-- RLS decision (mirrors offers/007):
--   Writes are service-role only (no write policies at all) — admin CRUD goes
--   through an isAdminEmail-gated API route (/api/admin/samples) that uses
--   the service client, same pattern as offers/affiliates.
--   Reads: one narrow SELECT policy — public (anon) can read rows where
--   active = true. Inactive samples are only visible via the service client
--   (admin list).
--
-- Graceful degradation: until this migration is run, the sample_reports table
-- does not exist. The public /sample-report page and the admin
-- /app/admin/samples page both catch that condition (Postgres error 42P01 /
-- a failed query) and fall back gracefully rather than crashing — see
-- src/app/sample-report/page.tsx and src/app/app/admin/samples/page.tsx.

create table public.sample_reports (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,                -- card headline, admin-written
  archetype         text not null,                -- idea type key (matches ARCHETYPE_LABELS)
  restatement       text not null,                -- the idea one-liner shown on card + report header
  sections          jsonb not null,                -- full report sections (same schema as reports.sections)
  headline_score    int not null,                  -- derived via deriveHeadlineScore() at clone time, so cards can show the score ring cheaply
  source_report_id  uuid,                           -- provenance only; no FK (the source report may be deleted later)
  active            boolean not null default false,
  sort_order        int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_sample_reports_active_sort on public.sample_reports (active, sort_order) where active = true;

alter table public.sample_reports enable row level security;

-- Public/anon: gallery + modal on /sample-report. Only active rows.
create policy "sample_reports: public read active"
  on public.sample_reports for select
  to anon
  using (active = true);

-- Signed-in users get the same public visibility (the page is unauthenticated
-- but nothing prevents a logged-in visitor from viewing it too).
create policy "sample_reports: authenticated read active"
  on public.sample_reports for select
  to authenticated
  using (active = true);

-- No insert/update/delete policies → writes are service-role only.
