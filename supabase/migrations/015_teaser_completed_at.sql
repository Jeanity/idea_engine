-- Migration 015: track the initial (teaser) report's own completion time
-- Run in Supabase SQL editor after 014_surveys.sql. RUN MANUALLY.
--
-- Bug: each idea has ONE row in `reports`. The initial report (teaser)
-- completes and sets generation_completed_at; when the user later upgrades to
-- a full report, the SAME row is reset (generation_completed_at cleared) and
-- re-completed by the full pipeline. Result: the teaser's own completion
-- timestamp is overwritten and the admin stats/graphs lose the "1 initial
-- report" event entirely once an idea is upgraded — it only ever counts as
-- "1 full report".
--
-- Fix: a dedicated teaser_completed_at column, set once by generate-teaser.ts
-- and never touched again (the full-report reset in
-- src/app/api/reports/full/route.ts and the full pipeline in
-- src/lib/inngest/generate-report.ts only ever clear/set
-- generation_started_at / generation_completed_at). An upgraded idea now
-- contributes both a teaser_completed_at event and a generation_completed_at
-- (full) event from the same row.
--
-- Graceful degradation: until this migration is run, admin stats/graphs
-- queries that reference teaser_completed_at will fail with Postgres 42703
-- (undefined_column) or PostgREST PGRST204 — those routes catch that and fall
-- back to the pre-migration row-state-based counting so the dashboard never
-- breaks. See src/app/api/admin/stats/route.ts and
-- src/app/api/admin/graphs/route.ts.

alter table public.reports add column teaser_completed_at timestamptz;

-- Backfill existing rows so historical data isn't blank for the new column.
--
-- (a) Teaser-only rows: never upgraded to a full report. Their
--     generation_completed_at IS the teaser's own completion time (it was
--     never overwritten), so copy it straight across. Identified by: sections
--     is empty or lacks a 'competitors' key (i.e. not a full report, matching
--     isFullReport() in the admin routes), preview_sections is populated (the
--     teaser step always writes preview_sections), and generation_completed_at
--     is set (the teaser actually finished).
update public.reports
set teaser_completed_at = generation_completed_at
where teaser_completed_at is null
  and generation_completed_at is not null
  and preview_sections is not null
  and preview_sections <> 'null'::jsonb
  and preview_sections <> '{}'::jsonb
  and (
    sections is null
    or sections = 'null'::jsonb
    or sections = '{}'::jsonb
    or not (sections ? 'competitors')
  );

-- (b) Full-report rows: sections has a 'competitors' key, so
--     generation_completed_at is the FULL report's completion time — the
--     original teaser completion was overwritten by the full-report reset
--     (src/app/api/reports/full/route.ts) before this migration existed, and
--     is not recoverable exactly. Every full report in this flow was
--     necessarily preceded by a completed teaser (generate-teaser.ts is the
--     only producer of the initial report; the "generate full" route requires
--     an existing report row) whose generation_started_at is still on the
--     row from that first run... except generation_started_at is ALSO reset
--     by the upgrade. The best available approximation left on the row is
--     generation_started_at, which reflects the START of whichever run most
--     recently touched the row (the full run) rather than the teaser's true
--     completion — this is a best-effort backfill approximation, not an exact
--     historical reconstruction. New rows going forward get an exact value
--     from generate-teaser.ts directly.
update public.reports
set teaser_completed_at = generation_started_at
where teaser_completed_at is null
  and generation_started_at is not null
  and sections ? 'competitors';
