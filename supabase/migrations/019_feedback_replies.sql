-- Migration 019: feedback replies + moderation (hide, publish approval)
-- Run in the Supabase SQL editor after 018_bug_reports.sql. RUN MANUALLY.
--
-- Lets an admin reply to a user's report feedback (each reply independently
-- public-or-private), hide abusive/spammy feedback from the admin list and
-- from public display, and gate public display behind an explicit admin
-- publish decision (`admin_public`) separate from the user's own consent
-- (`allow_public`). Email-on-reply is a later phase (blocked on SMTP) —
-- `emailed_at` ships now and stays null until that's wired up.
--
-- Graceful degradation: until this migration is run, the admin feedback page,
-- the report-page reply surface, and the homepage testimonials query all
-- catch the missing-table/-column conditions (Postgres 42P01/42703,
-- PostgREST PGRST205/PGRST204) and fail gracefully rather than crashing.

alter table public.report_feedback
  add column hidden boolean not null default false,
  add column admin_public boolean not null default false;

-- Preserve current homepage content: anything already admin-featured was an
-- implicit publish decision, so it keeps showing under the new rule.
update public.report_feedback set admin_public = true where featured = true;

create table public.feedback_replies (
  id          uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.report_feedback(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 5000),
  is_public   boolean not null default false,
  created_at  timestamptz not null default now(),
  created_by  text not null,
  emailed_at  timestamptz null
);

create index idx_feedback_replies_feedback_id on public.feedback_replies (feedback_id);

alter table public.feedback_replies enable row level security;

-- No insert/update/delete policy for anon/authenticated — replies are
-- written only by the admin API route via the service-role client (which
-- bypasses RLS entirely), same model as the admin `featured` toggle.

-- Owner: a signed-in user may read replies to their OWN feedback, public or
-- private — the report page always shows a reply to its recipient.
create policy "feedback_replies: select own via feedback"
  on public.feedback_replies for select
  to authenticated
  using (
    exists (
      select 1 from public.report_feedback rf
      where rf.id = feedback_replies.feedback_id
        and rf.user_id = auth.uid()
    )
  );

-- Public/anon: only replies marked public on feedback that is itself fully
-- public (same four-way rule as the homepage testimonials query), so the
-- homepage can optionally read replies with the anon client.
create policy "feedback_replies: public select public replies on public feedback"
  on public.feedback_replies for select
  using (
    is_public = true
    and exists (
      select 1 from public.report_feedback rf
      where rf.id = feedback_replies.feedback_id
        and rf.admin_public = true
        and rf.allow_public = true
        and rf.hidden = false
        and rf.featured = true
    )
  );

-- Public display rule tightened: was featured + allow_public, now also
-- requires the admin's own publish decision (admin_public) and not hidden.
-- Existing featured+consented rows keep showing because of the backfill
-- above (admin_public was set true for every currently-featured row).
drop policy "report_feedback: public select featured" on public.report_feedback;

create policy "report_feedback: public select featured"
  on public.report_feedback for select
  using (
    featured = true
    and allow_public = true
    and admin_public = true
    and hidden = false
  );
