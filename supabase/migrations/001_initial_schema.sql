-- Migration 001: initial schema
-- Implements docs/DATA_MODEL.md — run once in the Supabase SQL editor.

-- ============================================================
-- Shared trigger function for updated_at
-- ============================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- 1. public.profiles
-- ============================================================
create table public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  display_name     text,
  default_country  text check (default_country is null or char_length(default_country) = 2),
  default_region   text,
  marketing_opt_in boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-provision profile row whenever a new auth user is created
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

create policy "profiles: select own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id);

-- ============================================================
-- 2. public.ideas
-- ============================================================
create table public.ideas (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null references public.profiles(id) on delete cascade,
  raw_text             text not null check (char_length(raw_text) between 1 and 4000),
  archetype            text not null check (archetype in (
                         'physical_product', 'local_service', 'software_app',
                         'ecommerce_brand', 'content_education', 'marketplace',
                         'invention', 'other')),
  archetype_source     text not null default 'classifier'
                         check (archetype_source in ('classifier', 'user_override')),
  archetype_confidence numeric(3,2)
                         check (archetype_confidence is null
                             or (archetype_confidence >= 0 and archetype_confidence <= 1)),
  location_country     text not null check (char_length(location_country) = 2),
  location_region      text,
  restatement          text,
  status               text not null default 'draft'
                         check (status in ('draft', 'questioning', 'researching', 'ready')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index idx_ideas_owner_id_created_at on public.ideas (owner_id, created_at desc);
create index idx_ideas_status              on public.ideas (status);

create trigger set_ideas_updated_at
  before update on public.ideas
  for each row execute function public.set_updated_at();

alter table public.ideas enable row level security;

create policy "ideas: select own"  on public.ideas for select  using (auth.uid() = owner_id);
create policy "ideas: insert own"  on public.ideas for insert  with check (auth.uid() = owner_id);
create policy "ideas: update own"  on public.ideas for update  using (auth.uid() = owner_id);
create policy "ideas: delete own"  on public.ideas for delete  using (auth.uid() = owner_id);

-- ============================================================
-- 3. public.answers
-- ============================================================
create table public.answers (
  id            uuid primary key default gen_random_uuid(),
  idea_id       uuid not null references public.ideas(id) on delete cascade,
  question_key  text not null check (char_length(question_key) between 1 and 80),
  question_text text not null,
  answer_text   text not null,
  position      integer not null check (position >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (idea_id, question_key)
);

create index idx_answers_idea_id_position on public.answers (idea_id, position);

create trigger set_answers_updated_at
  before update on public.answers
  for each row execute function public.set_updated_at();

alter table public.answers enable row level security;

-- Ownership inherited from parent idea via exists subquery
create policy "answers: select own"
  on public.answers for select
  using (exists (
    select 1 from public.ideas i
    where i.id = answers.idea_id and i.owner_id = auth.uid()
  ));

create policy "answers: insert own"
  on public.answers for insert
  with check (exists (
    select 1 from public.ideas i
    where i.id = answers.idea_id and i.owner_id = auth.uid()
  ));

create policy "answers: update own"
  on public.answers for update
  using (exists (
    select 1 from public.ideas i
    where i.id = answers.idea_id and i.owner_id = auth.uid()
  ));

create policy "answers: delete own"
  on public.answers for delete
  using (exists (
    select 1 from public.ideas i
    where i.id = answers.idea_id and i.owner_id = auth.uid()
  ));

-- ============================================================
-- 4. public.reports
-- ============================================================
create table public.reports (
  id                      uuid primary key default gen_random_uuid(),
  idea_id                 uuid not null unique references public.ideas(id) on delete cascade,
  owner_id                uuid not null references public.profiles(id) on delete cascade,
  status                  text not null default 'queued'
                            check (status in ('queued', 'running', 'complete', 'failed')),
  sections                jsonb not null default '{}'::jsonb,
  preview_sections        jsonb not null default '{}'::jsonb,
  error                   text,
  generation_started_at   timestamptz,
  generation_completed_at timestamptz,
  model_version           text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index idx_reports_owner_id_created_at on public.reports (owner_id, created_at desc);
create index idx_reports_status              on public.reports (status);

create trigger set_reports_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

alter table public.reports enable row level security;

create policy "reports: select own"  on public.reports for select  using (auth.uid() = owner_id);
create policy "reports: insert own"  on public.reports for insert  with check (auth.uid() = owner_id);
create policy "reports: update own"  on public.reports for update  using (auth.uid() = owner_id);
create policy "reports: delete own"  on public.reports for delete  using (auth.uid() = owner_id);

-- ============================================================
-- 5. public.purchases
-- ============================================================
create table public.purchases (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.profiles(id) on delete cascade,
  report_id                uuid not null references public.reports(id) on delete cascade,
  stripe_session_id        text not null unique,
  stripe_payment_intent_id text,
  amount_cents             integer not null check (amount_cents >= 0),
  currency                 text not null check (char_length(currency) = 3),
  status                   text not null
                             check (status in ('pending', 'complete', 'refunded', 'failed')),
  completed_at             timestamptz,
  refunded_at              timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- Partial unique index so null payment_intent_ids don't collide
create unique index idx_purchases_payment_intent_not_null
  on public.purchases (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create index idx_purchases_user_id_created_at on public.purchases (user_id, created_at desc);
create index idx_purchases_report_id_status   on public.purchases (report_id, status);

create trigger set_purchases_updated_at
  before update on public.purchases
  for each row execute function public.set_updated_at();

-- Inserts and updates come only from the Stripe webhook (service role), not user sessions
alter table public.purchases enable row level security;

create policy "purchases: select own"
  on public.purchases for select
  using (auth.uid() = user_id);
