-- Migration 014: report-end surveys (question bank + responses)
-- Run in Supabase SQL editor after 013_promo_mode.sql. RUN MANUALLY.
--
-- On/off switch lives in app_settings key 'survey' (migration 013), default
-- off — see src/lib/survey.ts.
--
-- Graceful degradation: until this migration is run, both tables below don't
-- exist. Survey reads must treat that as "survey off" (see isMissingTable in
-- src/lib/app-settings.ts, 42P01/PGRST205) rather than crashing.

create table public.survey_questions (
  id          uuid primary key default gen_random_uuid(),
  prompt      text not null,
  qtype       text not null check (qtype in ('text', 'rating', 'multiple_choice')),
  options     jsonb,               -- string[] for multiple_choice, null otherwise
  sort_order  int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.survey_responses (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.survey_questions(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  report_id   uuid references public.reports(id) on delete set null,
  answer      text not null,
  created_at  timestamptz not null default now()
);

create index idx_survey_responses_question_id on public.survey_responses (question_id);
create index idx_survey_responses_user_id on public.survey_responses (user_id);

alter table public.survey_questions enable row level security;
alter table public.survey_responses enable row level security;

-- Anyone (including signed-out visitors, for parity with other public reads)
-- can see the active question set — needed to render the survey card.
create policy "survey_questions: public select active"
  on public.survey_questions for select
  to anon, authenticated
  using (active);

-- Authenticated users can submit their own responses...
create policy "survey_responses: authenticated insert own"
  on public.survey_responses for insert
  to authenticated
  with check (user_id = auth.uid());

-- ...and can read back ONLY their own rows (so the report page can tell
-- whether this user has already answered, without exposing anyone else's
-- responses). No update/delete policy — responses are immutable once submitted.
create policy "survey_responses: authenticated select own"
  on public.survey_responses for select
  to authenticated
  using (user_id = auth.uid());
