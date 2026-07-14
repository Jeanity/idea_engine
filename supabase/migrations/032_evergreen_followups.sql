-- Migration 032: evergreen audit follow-ups — permanent disapproval marker,
-- orphaned usage rows.
-- Run in the Supabase SQL editor after 031_evergreen_lifecycle.sql. RUN MANUALLY.
--
-- Two independent fixes from Fable's post-C audit of the evergreen feature
-- (Workstream D, docs/plan/2026-07-14-evergreen-baselines-and-bug-flagged-reports.md):
--
-- D1: `last_disapproved_at` is a PERMANENT "this key has a disapproval in its
-- history" marker, set alongside `disapproved_at` every time an entry is
-- disapproved (see PATCH /api/admin/evergreen/[id] { action: 'disapprove' }).
-- Unlike `disapproved_at`/`disapprove_note` — which the disapprove/approve/
-- regenerate cycle clears and resets — this column is NEVER cleared, by
-- anything: not `approve`, not `storeEvergreenBaseline` (regenerate). Its only
-- reader is the admin evergreen list, which uses it to decide whether a
-- superseded-revision cohort is a routine refresh (no action needed) or
-- traces back to a key that was once bad enough to disapprove (surface the
-- "Remediate…" control). See src/lib/evergreen.ts and evergreen-list.tsx.
--
-- D2: widen evergreen_report_usage.remediation to allow 'orphaned' — the
-- remediate route (POST /api/admin/evergreen/[id]/remediate) marks a usage
-- row 'orphaned' (not left 'skipped' forever) when its report has been
-- deleted (a successful query that simply finds no row — `!report &&
-- !reportError` — as opposed to a genuine query error, which still leaves the
-- row 'skipped'/retryable). The constraint being widened here was created
-- inline by 031_evergreen_lifecycle.sql (`evergreen_report_usage_remediation_
-- check`, Postgres's default auto-generated name for an unnamed column
-- check). Postgres can't ALTER a check constraint in place — drop and re-add
-- by name (same pattern as 027_contact_billing_category.sql).
--
-- Graceful degradation:
-- - Until this migration is run, PATCH /api/admin/evergreen/[id]
--   { action: 'disapprove' } writes last_disapproved_at in the SAME update
--   as disapproved_at/disapprove_note/review_status, so the whole update
--   fails (42703 undefined_column / PGRST204 "column not found in schema
--   cache") rather than partially applying — same posture as the existing
--   031-not-run case this route already handled (isMissingColumn), just now
--   also covering 032. The route surfaces a friendly "migration not run"
--   notice (503) rather than a 500 or a silently-incomplete disapprove.
-- - The evergreen list's server read tolerates a missing last_disapproved_at
--   column the same way (treats it as null for every row) — the "Remediate…"
--   control then never renders pre-032; every cohort > 0 falls back to the
--   informational "no action needed" line instead. Nothing crashes, nothing
--   regresses versus pre-D behaviour.
-- - Until this migration is run, the remediate route's orphan path (report
--   absent) hits the OLD 2-value check constraint (Postgres 23514
--   check_violation) when it tries to write remediation='orphaned' — it
--   catches that and leaves the row 'skipped'/retryable instead (same
--   behaviour as before this migration existed), rather than crashing the
--   whole remediation run.

-- IF NOT EXISTS / IF EXISTS: unlike 030/031, this migration is deliberately
-- idempotent — an accidental double-run is a harmless no-op (drop+re-add of
-- the identical 3-value constraint) instead of a rolled-back 42701 error.
-- Danny double-ran 031 by accident on 2026-07-14; cheap insurance.
alter table public.evergreen_baselines
  add column if not exists last_disapproved_at timestamptz null;

alter table public.evergreen_report_usage
  drop constraint if exists evergreen_report_usage_remediation_check;

alter table public.evergreen_report_usage
  add constraint evergreen_report_usage_remediation_check
  check (remediation in ('patched', 'notified', 'orphaned'));
