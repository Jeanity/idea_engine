-- Migration 005: analytics foundation (Block 2)
-- Append-only page-event log + sessions/visitor identity + first-touch
-- attribution columns + aggregation RPCs. Run in the Supabase SQL editor
-- after 004_report_feedback.sql. RUN MANUALLY.
--
-- Privacy stance (docs/plan/2026-07-07-admin-backend-master-plan.md, Block 2):
-- store NO IP and NO user-agent. Event fields are kept minimal. The session
-- (ie_sid) and visitor (ie_vid) cookies are functional-only. No third-party
-- analytics.
--
-- Decision recorded (open-decision "b"): we keep the functional cookies to get
-- returning-visitor precision, so page_events carries a `visitor_id` column
-- (the plan explicitly leaves this to the implementer — "store visitor id in
-- the event too if the implementer prefers; decide and document"). Without it
-- the returning-visitor RPC cannot be computed.

-- ============================================================
-- 1. public.page_events — append-only, service-role-written
-- ============================================================
create table public.page_events (
  id             bigint generated always as identity primary key,
  occurred_at    timestamptz not null default now(),
  session_id     uuid not null,          -- anonymous, cookie-held (ie_sid)
  visitor_id     uuid null,              -- persistent cookie (ie_vid); returning-visitor counts
  user_id        uuid null,              -- filled when signed in
  path           text not null,
  referrer       text null,              -- document.referrer, first page of session only
  utm            jsonb null,             -- {source,medium,campaign,term,content}, first page only
  is_new_session boolean not null default false
);

create index page_events_occurred_idx on public.page_events (occurred_at);
create index page_events_session_idx  on public.page_events (session_id, occurred_at);
create index page_events_visitor_idx  on public.page_events (visitor_id, occurred_at);

-- RLS enabled with NO policies: the table is reachable only through the
-- service-role client (which bypasses RLS). No anon/authenticated access.
alter table public.page_events enable row level security;

-- ============================================================
-- 2. profiles: last-seen heartbeat + first-touch acquisition
-- ============================================================
alter table public.profiles add column last_seen_at timestamptz null;
alter table public.profiles add column acquisition  jsonb null; -- first-touch {referrer, utm, landing_path}

-- ============================================================
-- 3. Aggregation RPCs (SECURITY DEFINER, service-role only)
-- ============================================================
-- All buckets are UTC calendar days. Every function is revoked from public/
-- anon/authenticated and granted only to service_role — Block 3's admin API
-- (which re-checks isAdminEmail) calls them through the service-role client.

-- Sessions started per day (distinct new-session events).
create or replace function public.analytics_sessions_per_day(from_ts timestamptz, to_ts timestamptz)
returns table (day date, count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select (occurred_at at time zone 'UTC')::date as day,
         count(distinct session_id) as count
  from public.page_events
  where occurred_at >= from_ts and occurred_at < to_ts
    and is_new_session
  group by 1
  order by 1;
$$;

-- Pageviews per day (every event).
create or replace function public.analytics_pageviews_per_day(from_ts timestamptz, to_ts timestamptz)
returns table (day date, count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select (occurred_at at time zone 'UTC')::date as day,
         count(*) as count
  from public.page_events
  where occurred_at >= from_ts and occurred_at < to_ts
  group by 1
  order by 1;
$$;

-- Unique visitors per day (distinct visitor_id).
create or replace function public.analytics_unique_visitors_per_day(from_ts timestamptz, to_ts timestamptz)
returns table (day date, count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select (occurred_at at time zone 'UTC')::date as day,
         count(distinct visitor_id) as count
  from public.page_events
  where occurred_at >= from_ts and occurred_at < to_ts
    and visitor_id is not null
  group by 1
  order by 1;
$$;

-- Returning visitors per day: distinct visitors active on a day whose first-ever
-- event predates that day (UTC). New visitors on their first day are excluded.
create or replace function public.analytics_returning_visitors_per_day(from_ts timestamptz, to_ts timestamptz)
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
  select (e.occurred_at at time zone 'UTC')::date as day,
         count(distinct e.visitor_id) as count
  from public.page_events e
  join firsts f on f.visitor_id = e.visitor_id
  where e.occurred_at >= from_ts and e.occurred_at < to_ts
    and e.visitor_id is not null
    and (f.first_seen at time zone 'UTC')::date < (e.occurred_at at time zone 'UTC')::date
  group by 1
  order by 1;
$$;

-- Top referrers over the range (host extracted from document.referrer),
-- counted by sessions (new-session events carry the referrer).
create or replace function public.analytics_top_referrers(from_ts timestamptz, to_ts timestamptz, max_rows int default 20)
returns table (referrer_host text, count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(substring(referrer from '^[a-z]+://([^/]+)'), referrer) as referrer_host,
         count(*) as count
  from public.page_events
  where occurred_at >= from_ts and occurred_at < to_ts
    and is_new_session
    and referrer is not null
    and referrer <> ''
  group by 1
  order by count desc, referrer_host
  limit max_rows;
$$;

-- Top UTM campaigns over the range (source + campaign), counted by sessions.
create or replace function public.analytics_top_utm_campaigns(from_ts timestamptz, to_ts timestamptz, max_rows int default 20)
returns table (source text, campaign text, count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select utm->>'source'   as source,
         utm->>'campaign' as campaign,
         count(*)         as count
  from public.page_events
  where occurred_at >= from_ts and occurred_at < to_ts
    and is_new_session
    and utm is not null
    and coalesce(utm->>'campaign', '') <> ''
  group by 1, 2
  order by count desc, campaign
  limit max_rows;
$$;

-- Lock the RPCs down to the service-role client only.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.analytics_sessions_per_day(timestamptz, timestamptz)',
    'public.analytics_pageviews_per_day(timestamptz, timestamptz)',
    'public.analytics_unique_visitors_per_day(timestamptz, timestamptz)',
    'public.analytics_returning_visitors_per_day(timestamptz, timestamptz)',
    'public.analytics_top_referrers(timestamptz, timestamptz, int)',
    'public.analytics_top_utm_campaigns(timestamptz, timestamptz, int)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated;', fn);
    execute format('grant execute on function %s to service_role;', fn);
  end loop;
end;
$$;
