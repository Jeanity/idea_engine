-- Migration 026: local-day admin graphs (multi-day charts bucket by the
-- ADMIN'S LOCAL calendar day, not UTC). Run in the Supabase SQL editor after
-- 025_survey_v2.sql. RUN MANUALLY.
--
-- Single-day/hourly admin charts already bucket in the admin's local
-- timezone (see /api/admin/graphs — the `tz` query param, browser
-- Date.getTimezoneOffset() minutes, shifts the day window and the route
-- buckets hours in JS). Multi-day charts were still grouping by UTC calendar
-- date via the per-day RPCs from migration 005: for a non-UTC admin (e.g.
-- Sydney, UTC+10) events land on the wrong day and the day boundary is off
-- by the full tz offset.
--
-- This migration adds LOCAL-DAY versions of the three per-day RPCs the
-- graphs route actually calls for its "traffic" charts — sessions, unique
-- visitors, returning visitors — each taking an extra tz_offset_minutes
-- parameter (Date.getTimezoneOffset() semantics: UTC minus local, e.g.
-- Sydney = -600) and grouping by the tz-shifted calendar date instead of the
-- raw UTC date. (analytics_pageviews_per_day has no local-day counterpart —
-- the graphs route never calls it.)
--
-- These are NEW FUNCTION NAMES, not new overloads of the migration-005
-- functions — the old functions are left completely untouched, so in-flight
-- requests against them during a rolling deploy can't break. The graphs
-- route (src/app/api/admin/graphs/route.ts, `perLocalDay`) tries the new
-- function first and falls back to the migration-005 UTC-day function —
-- queried over the literal UTC day range, so its output still lines up with
-- the chart's day-label keys — if the new one 404s (Postgres 42883
-- undefined_function / PostgREST PGRST202 "function not found"), i.e. before
-- this migration has been run in a given environment. That fallback is the
-- pre-026 (UTC-day) behaviour, not a 500.

-- Sessions started per LOCAL day (distinct new-session events).
create or replace function public.analytics_sessions_per_local_day(
  from_ts timestamptz, to_ts timestamptz, tz_offset_minutes int default 0
)
returns table (day date, count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select ((occurred_at - (tz_offset_minutes || ' minutes')::interval) at time zone 'UTC')::date as day,
         count(distinct session_id) as count
  from public.page_events
  where occurred_at >= from_ts and occurred_at < to_ts
    and is_new_session
  group by 1
  order by 1;
$$;

-- Unique visitors per LOCAL day (distinct visitor_id).
create or replace function public.analytics_unique_visitors_per_local_day(
  from_ts timestamptz, to_ts timestamptz, tz_offset_minutes int default 0
)
returns table (day date, count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select ((occurred_at - (tz_offset_minutes || ' minutes')::interval) at time zone 'UTC')::date as day,
         count(distinct visitor_id) as count
  from public.page_events
  where occurred_at >= from_ts and occurred_at < to_ts
    and visitor_id is not null
  group by 1
  order by 1;
$$;

-- Returning visitors per LOCAL day: distinct visitors active on a local day
-- whose first-ever event predates that same LOCAL day (the tz shift is
-- applied to both sides of the comparison — mirrors
-- analytics_returning_visitors_per_day, just with local dates instead of
-- UTC dates on both the "first seen" and "active on" sides).
create or replace function public.analytics_returning_visitors_per_local_day(
  from_ts timestamptz, to_ts timestamptz, tz_offset_minutes int default 0
)
returns table (day date, count bigint)
language sql
stable
security definer
set search_path = public
as $$
  with firsts as (
    select visitor_id, min(occurred_at) as first_seen
    from public.page_events
    where visitor_id is not null
    group by visitor_id
  )
  select ((e.occurred_at - (tz_offset_minutes || ' minutes')::interval) at time zone 'UTC')::date as day,
         count(distinct e.visitor_id) as count
  from public.page_events e
  join firsts f on f.visitor_id = e.visitor_id
  where e.occurred_at >= from_ts and e.occurred_at < to_ts
    and e.visitor_id is not null
    and ((f.first_seen - (tz_offset_minutes || ' minutes')::interval) at time zone 'UTC')::date
      < ((e.occurred_at - (tz_offset_minutes || ' minutes')::interval) at time zone 'UTC')::date
  group by 1
  order by 1;
$$;

-- Lock the new RPCs down to the service-role client only, same as migration 005.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.analytics_sessions_per_local_day(timestamptz, timestamptz, int)',
    'public.analytics_unique_visitors_per_local_day(timestamptz, timestamptz, int)',
    'public.analytics_returning_visitors_per_local_day(timestamptz, timestamptz, int)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated;', fn);
    execute format('grant execute on function %s to service_role;', fn);
  end loop;
end;
$$;
