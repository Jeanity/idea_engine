-- Migration 009: error log (Block R4)
-- Run in Supabase SQL editor after 008_report_cost.sql. RUN MANUALLY.
--
-- Append-only diagnostic log of server-side failures so the admin can see and
-- copy real errors from /app/admin/errors. RLS is ON with NO policies → the
-- table is service-role ONLY: logError() (service client) writes it, and the
-- admin Errors page + /api/admin/errors (service client, behind isAdminEmail)
-- read/clear it. There is no user-facing access, ever.
--
-- user_id is intentionally NOT a foreign key: logging is best-effort and must
-- never fail because an id is unknown, and logs should survive user deletion.

create table public.error_log (
  id            uuid primary key default gen_random_uuid(),
  occurred_at   timestamptz not null default now(),
  source        text not null,          -- e.g. 'inngest:generate-report', 'api:admin/offers'
  message       text not null,          -- short human-readable error message
  detail        jsonb null,             -- optional structured context (ids, step, stack)
  path          text null,              -- request path or step id, when relevant
  user_id       uuid null               -- actor/owner when known (no FK — see note above)
);

create index idx_error_log_occurred_at on public.error_log (occurred_at desc);
create index idx_error_log_source on public.error_log (source);

alter table public.error_log enable row level security;
-- No policies → service-role only (same write model as offers / affiliate_links).
