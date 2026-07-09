-- Migration 012: contact form submissions (public site batch)
-- Run in Supabase SQL editor after 011_sample_reports.sql. RUN MANUALLY.
--
-- Public /contact page inserts here directly with the per-request (anon or
-- authenticated) client, so the RLS insert policy below is what authorises
-- the write — not app code. There are deliberately NO select/update/delete
-- policies: nobody, including a signed-in submitter, can read these rows back
-- through the API. The admin queue (/app/admin/contact) reads and updates via
-- the service client only, behind isAdminEmail (same pattern as error_log).
--
-- Graceful degradation: until this migration is run, the contact_submissions
-- table does not exist. POST /api/contact and the admin queue page both catch
-- that condition (Postgres error 42P01) and fail gracefully rather than
-- crashing — see src/app/api/contact/route.ts and
-- src/app/app/admin/contact/page.tsx.

create table public.contact_submissions (
  id          uuid primary key default gen_random_uuid(),
  category    text not null check (category in ('feedback', 'complaint', 'question', 'partnership')),
  name        text not null check (char_length(name) between 1 and 200),
  email       text not null check (char_length(email) between 3 and 200),
  message     text not null check (char_length(message) between 1 and 5000),
  user_id     uuid references auth.users(id) on delete set null,
  status      text not null default 'open' check (status in ('open', 'replied', 'closed')),
  created_at  timestamptz not null default now()
);

create index idx_contact_submissions_created_at on public.contact_submissions (created_at desc);
create index idx_contact_submissions_status on public.contact_submissions (status);
create index idx_contact_submissions_category on public.contact_submissions (category);

alter table public.contact_submissions enable row level security;

-- Anyone (signed out or signed in) can submit the contact form. No select,
-- update, or delete policy exists for anon/authenticated — submitters cannot
-- read their own or anyone else's row back; only the service role can.
create policy "contact_submissions: public insert"
  on public.contact_submissions for insert
  to anon, authenticated
  with check (true);
