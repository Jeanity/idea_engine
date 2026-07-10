-- Migration 025: survey v2 — multiple surveys, groups, targeting
-- Run in Supabase SQL editor after 024_message_templates.sql. RUN MANUALLY.
--
-- Replaces the single global survey (migration 014). Every survey now targets
-- a placement (where it renders) and an audience (who sees it); the old
-- app_settings 'survey' on/off flag is retired in favour of per-survey
-- `active` (the flag's current value seeds the default survey below, and the
-- app_settings row is left in place but no longer read).
--
-- Graceful degradation: until this migration is run, the surveys table does
-- not exist — survey reads must treat 42P01/PGRST205 as "no survey to show"
-- (see src/lib/survey.ts) rather than crashing. NOTE: if a v1 survey is live
-- when the code deploys, it will not be shown again until this migration runs.

create table public.survey_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table public.surveys (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  group_id    uuid references public.survey_groups(id) on delete set null,
  active      boolean not null default false,
  placement   text not null check (placement in ('full_report_end', 'initial_report_end', 'account', 'post_purchase')),
  audience    text not null check (audience in ('all', 'first_report', 'first_purchase', 'promo_users', 'repeat_users')),
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create index idx_surveys_group_id on public.surveys (group_id);
create index idx_surveys_active_placement on public.surveys (placement) where active;

-- ── Default survey: adopt the v1 question bank ──────────────────────────
-- Fixed uuid so the backfill below can reference it without plpgsql.
-- Its active state carries over from the old app_settings flag, so a live
-- v1 survey stays live once this migration runs.
insert into public.surveys (id, name, placement, audience, active)
values (
  'a0000000-0000-4000-8000-000000000025',
  'Launch survey',
  'full_report_end',
  'all',
  coalesce((select (value ->> 'enabled')::boolean from public.app_settings where key = 'survey'), false)
);

alter table public.survey_questions add column survey_id uuid references public.surveys(id) on delete cascade;
update public.survey_questions set survey_id = 'a0000000-0000-4000-8000-000000000025';
alter table public.survey_questions alter column survey_id set not null;

alter table public.survey_responses add column survey_id uuid references public.surveys(id) on delete cascade;
update public.survey_responses r
  set survey_id = q.survey_id
  from public.survey_questions q
  where q.id = r.question_id;
alter table public.survey_responses alter column survey_id set not null;

create index idx_survey_questions_survey_id on public.survey_questions (survey_id);
create index idx_survey_responses_survey_id on public.survey_responses (survey_id);

alter table public.survey_groups enable row level security;
alter table public.surveys enable row level security;
-- survey_groups: no policies — service-role only (admin organisational data).

-- Active surveys are publicly readable — the report/account pages resolve
-- which survey to show with the per-request client.
create policy "surveys: public select active"
  on public.surveys for select
  to anon, authenticated
  using (active);

-- Tighten the v1 question policy: a question is only visible while its
-- parent survey is active too (v1 checked question.active alone).
drop policy "survey_questions: public select active" on public.survey_questions;
create policy "survey_questions: public select active"
  on public.survey_questions for select
  to anon, authenticated
  using (
    active
    and exists (select 1 from public.surveys s where s.id = survey_id and s.active)
  );
