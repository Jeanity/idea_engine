-- Migration 018: bug report widget (in-report "Report a bug" + admin queue)
-- Run in the Supabase SQL editor after 017_affiliate_countries.sql. RUN MANUALLY.
--
-- Lets a signed-in user flag a bug from inside a report (initial or full
-- viewer) with an optional screenshot, straight into an admin-only queue.
-- Table RLS mirrors contact_submissions (migration 012): insert-only for the
-- submitter, no select/update/delete for anon/authenticated — only the
-- service role (admin queue at /app/admin/bugs, POST /api/bug-report) can
-- read or update rows.
--
-- This migration also creates the `bug-screenshots` Storage bucket and its
-- object policies inline, so no separate Supabase dashboard step is needed.
-- The bucket is private (public = false); screenshots are only ever served
-- back to admins via short-lived signed URLs from the service client.
--
-- Graceful degradation: until this migration is run, POST /api/bug-report
-- and /app/admin/bugs both catch the missing-table condition (Postgres
-- 42P01 / PostgREST PGRST205) and fail gracefully rather than crashing.

create table public.bug_reports (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  user_id          uuid null references auth.users(id) on delete set null,
  idea_id          uuid null,
  report_id        uuid null,
  report_tab       text null,
  description      text not null check (char_length(description) between 1 and 5000),
  screenshot_path  text null,
  browser_info     text null,
  page_url         text null,
  status           text not null default 'open' check (status in ('open', 'triaged', 'resolved', 'wontfix')),
  admin_notes      text null
);

create index idx_bug_reports_created_at on public.bug_reports (created_at desc);
create index idx_bug_reports_status on public.bug_reports (status);

alter table public.bug_reports enable row level security;

-- Signed-in users can submit a report for themselves. No select, update, or
-- delete policy exists for anon/authenticated — submitters cannot read their
-- own or anyone else's row back; only the service role can (admin queue).
create policy "bug_reports: authenticated insert own"
  on public.bug_reports for insert
  to authenticated
  with check (user_id = auth.uid());

-- Storage bucket for screenshot attachments. Private — no public read.
insert into storage.buckets (id, name, public)
values ('bug-screenshots', 'bug-screenshots', false)
on conflict (id) do nothing;

-- Authenticated users may upload only into a path prefixed with their own
-- uid (client uploads to `<uid>/<timestamp>-<filename>`). No select, update,
-- or delete policy — uploaders can't read back or overwrite objects, and
-- admins read via the service client's createSignedUrl, which bypasses RLS.
create policy "bug-screenshots: authenticated insert own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'bug-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
