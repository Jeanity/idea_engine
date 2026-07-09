-- Migration 022: contact submission replies (admin → submitter, emailed)
-- Run in the Supabase SQL editor after 021_admin_dashboard_layout.sql. RUN MANUALLY.
--
-- Lets an admin reply to a /app/admin/contact submission from a modal. The
-- reply is ALWAYS emailed to the submitter — the email is the submitter's
-- only copy, since (per migration 012) submitters can never read their own
-- contact_submissions row back through the API. There is deliberately NO
-- select/insert/update/delete policy for anon/authenticated: this table is
-- service-role only, written by POST /api/admin/contact/replies after the
-- isAdminEmail gate passes (same model as feedback_replies in 019).
--
-- emailed_at stays null when the send fails — the reply row is still saved
-- (never lost just because SMTP hiccuped), and the admin UI shows a
-- sent/failed badge per reply.
--
-- Graceful degradation: until this migration is run, POST /api/admin/contact/replies
-- and the admin contact page both catch the missing-table condition (Postgres
-- 42P01, PostgREST PGRST205) and fail gracefully rather than crashing.

create table public.contact_replies (
  id             uuid primary key default gen_random_uuid(),
  submission_id  uuid not null references public.contact_submissions(id) on delete cascade,
  body           text not null check (char_length(body) between 1 and 10000),
  created_by     text not null,
  emailed_at     timestamptz,
  created_at     timestamptz not null default now()
);

create index idx_contact_replies_submission_id on public.contact_replies (submission_id);

alter table public.contact_replies enable row level security;

-- No policies — service-role only (see note above).
