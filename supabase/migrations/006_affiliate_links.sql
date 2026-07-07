-- Migration 006: affiliate links + click tracking (Block 4)
-- Run in the Supabase SQL editor after 005_analytics_events.sql. RUN MANUALLY.
--
-- Two tables:
--   affiliate_links  — the catalogue of partner links (/go/<slug> → target_url),
--                      plus the match_domains the delivery-time rewrite engine
--                      uses to swap report URLs for /go/<slug> links.
--   affiliate_clicks — append-only click log, written best-effort by the
--                      /go/<slug> redirect route (service role).
--
-- RLS decision (recorded here + in the plan HANDOFF):
--   affiliate_links: RLS enabled. WRITES are service-role only (no write
--   policies — admin CRUD goes through an isAdminEmail-gated API route that
--   uses the service client). READS: a single public SELECT policy exposes
--   ONLY rows where active = true. This is intentional — the rewrite engine
--   runs on every report view/PDF build and only ever needs the active links,
--   and affiliate links are non-secret marketing URLs. It lets the delivery
--   points load links with the ordinary per-request client (no service client
--   in the hot path). Inactive links stay invisible to anon/authenticated.
--
--   affiliate_clicks: RLS enabled, NO policies at all → service-role only.
--   Clicks are private analytics; nothing reads them except admin (service
--   role) surfaces.

-- ============================================================
-- 1. public.affiliate_links
-- ============================================================
create table public.affiliate_links (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,                       -- /go/<slug>
  name          text not null,                              -- "Vistaprint"
  target_url    text not null,                              -- full affiliate URL incl. tracking params
  match_domains text[] not null default '{}',               -- ["vistaprint.com","vistaprint.co.uk"]
  match_terms   text[] not null default '{}',               -- v2 stretch (plain-text mentions); unused in v1
  active        boolean not null default true,
  notes         text null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_affiliate_links_active on public.affiliate_links (active) where active = true;

alter table public.affiliate_links enable row level security;

-- Public/anon + authenticated: read ONLY active links (for the rewrite engine).
-- No INSERT/UPDATE/DELETE policies → writes are service-role only.
create policy "affiliate_links: public select active"
  on public.affiliate_links for select
  using (active = true);

-- ============================================================
-- 2. public.affiliate_clicks
-- ============================================================
create table public.affiliate_clicks (
  id            bigint generated always as identity primary key,
  link_id       uuid not null references public.affiliate_links(id) on delete cascade,
  occurred_at   timestamptz not null default now(),
  context       text null,        -- e.g. 'report:<idea_id>', 'homepage'
  user_id       uuid null,        -- filled when the clicker has a session
  referrer_path text null
);

create index idx_affiliate_clicks_link_id on public.affiliate_clicks (link_id);
create index idx_affiliate_clicks_occurred_at on public.affiliate_clicks (occurred_at);

alter table public.affiliate_clicks enable row level security;
-- No policies: service-role only (redirect route inserts, admin reads counts).
