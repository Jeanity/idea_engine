-- Migration 031: evergreen lifecycle — disapprove state + exposure tagging.
-- Run in the Supabase SQL editor after 030_evergreen_baselines.sql. RUN MANUALLY.
--
-- Reframes evergreen_baselines to match how it already behaves: entries are
-- live (served) the moment they're generated — 'unreviewed' (displayed as
-- "New") and 'approved' rows are served identically. This migration adds the
-- one review outcome that DOES change serving: 'disapproved' — Danny attaches
-- a note explaining what's wrong, and the pipeline stops serving that entry
-- (falls back to the pre-evergreen legacy per-report compliance search) until
-- he explicitly regenerates it (a later build, not this migration). Expiry
-- must never resurrect a disapproved entry into regeneration — see the
-- quad-state lookup in src/lib/evergreen.ts.
--
-- Also adds evergreen_report_usage: one row per report that was served an
-- evergreen baseline, so a bad entry has a known exposure cohort — which
-- reports consumed it, and whether they consumed it before or after Danny
-- approved that revision (approved_at_use). remediated_at/remediation are
-- written by the later regenerate-and-notify build (Workstream C2); this
-- migration only creates the columns/table they'll use.
--
-- See src/lib/evergreen.ts (quad-state lookup + storeEvergreenBaseline),
-- src/lib/inngest/generate-report.ts (evergreen-usage-record step), and
-- docs/plan/2026-07-14-evergreen-baselines-and-bug-flagged-reports.md
-- (Workstream C) for the application-code design.
--
-- Postgres can't ALTER a check constraint in place — drop and re-add by name
-- (same pattern as 027_contact_billing_category.sql). The name below is
-- Postgres's default auto-generated name for an inline column check
-- (`<table>_<column>_check`) on the unnamed constraint from 030.
--
-- Graceful degradation: until this migration is run, PATCH
-- /api/admin/evergreen/[id] { action: 'disapprove' } fails the (still
-- 2-value) review_status check constraint (Postgres 23514) — the route
-- surfaces a friendly error rather than a 500, same pattern as billing (027).
-- evergreen_report_usage doesn't exist yet (42P01 / PGRST205) — the
-- pipeline's evergreen-usage-record step catches that and logs + continues
-- (never fails the report, same isMissingTable convention as bug_reports/018
-- and evergreen_baselines/030), and the admin evergreen page's per-row usage
-- counts read as zero.

alter table public.evergreen_baselines
  drop constraint evergreen_baselines_review_status_check;

alter table public.evergreen_baselines
  add constraint evergreen_baselines_review_status_check
  check (review_status in ('unreviewed', 'approved', 'disapproved'));

alter table public.evergreen_baselines
  add column disapproved_at timestamptz null,
  add column disapprove_note text null;

create table public.evergreen_report_usage (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  evergreen_id          uuid not null references public.evergreen_baselines(id) on delete cascade,
  report_id             uuid not null,
  user_id               uuid not null,
  evergreen_updated_at  timestamptz not null, -- revision snapshot: the baseline's updated_at at time of use
  approved_at_use       boolean not null,     -- was review_status 'approved' at the moment this report was generated?
  remediated_at         timestamptz null,     -- written by C2's patch/notify actions
  remediation           text null check (remediation in ('patched', 'notified'))
);

create index idx_evergreen_report_usage_lookup on public.evergreen_report_usage (evergreen_id, evergreen_updated_at);

alter table public.evergreen_report_usage enable row level security;
-- No policies: service-role only, same posture as evergreen_baselines (030)
-- — only the report pipeline (Inngest worker, evergreen-usage-record step)
-- and the admin evergreen page ever read/write this table.
