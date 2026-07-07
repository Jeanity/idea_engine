-- Migration 004: report feedback & ratings (Block 9)
-- Run in Supabase SQL editor after 003_edit_log_and_demo_mode.sql

create table public.report_feedback (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid not null references public.reports(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  rating       int not null check (rating between 1 and 5),
  comment      text null,
  allow_public boolean not null default false,  -- user consent to quote
  featured     boolean not null default false,  -- admin picked for homepage
  created_at   timestamptz not null default now(),
  unique (report_id)
);

create index idx_report_feedback_user_id on public.report_feedback (user_id);
create index idx_report_feedback_featured on public.report_feedback (featured) where featured = true;

alter table public.report_feedback enable row level security;

-- Owner: select/insert/update their own feedback row.
create policy "report_feedback: select own"
  on public.report_feedback for select
  using (auth.uid() = user_id);

create policy "report_feedback: insert own"
  on public.report_feedback for insert
  with check (auth.uid() = user_id);

create policy "report_feedback: update own"
  on public.report_feedback for update
  using (auth.uid() = user_id);

-- Public/anon: select ONLY rows explicitly admin-featured AND user-consented,
-- so the homepage testimonials section can read with the normal (anon) client
-- without ever exposing unfeatured or non-consented feedback. Admin writes
-- (setting `featured`) go through the service-role client, never this policy.
create policy "report_feedback: public select featured"
  on public.report_feedback for select
  using (featured = true and allow_public = true);

-- No delete policy: feedback rows are not user-deletable in this block.
