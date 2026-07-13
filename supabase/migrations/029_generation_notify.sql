-- Migration 029: engine kill switch notify list.
-- Run in the Supabase SQL editor after 028_promo_surveys.sql. RUN MANUALLY.
--
-- generation_notify holds the opt-in list of users who asked to be emailed
-- when the engine kill switch (app_settings 'service_mode' row, migration
-- 013, src/lib/service-mode.ts) flips back off. The switch itself needs no
-- migration — it's just another app_settings row — but the notify list needs
-- its own table since it stores per-user rows.
--
-- One row per user (UNIQUE user_id): POST /api/generation-notify upserts on
-- that conflict, so opting in again while already on the list just no-ops.
-- notified_at is set once the batch mailer
-- (src/lib/inngest/notify-engine-resumed.ts) has sent — or tried and failed
-- to send — that user's "we're back" email; NULL means still pending. The
-- partial index only covers pending rows, which is all the mailer ever
-- queries.
--
-- Service-role only, same stance as app_settings (013) — no policies. The
-- opt-in route only ever inserts/updates via the service client; there's no
-- user-facing read path.
create table public.generation_notify (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references public.profiles(id) on delete cascade,
  email       text not null,
  created_at  timestamptz not null default now(),
  notified_at timestamptz
);

alter table public.generation_notify enable row level security;
-- No policies: service-role only, same stance as app_settings (013).

create index idx_generation_notify_pending on public.generation_notify (created_at) where notified_at is null;
