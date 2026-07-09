-- Migration 016: essential-services categorisation for affiliate links (Block: essential services)
-- Run in the Supabase SQL editor after 015_teaser_completed_at.sql. RUN MANUALLY.
--
-- Extends affiliate_links so a subset of rows can double as the resolver
-- backing the render-time "Your support team" block (src/lib/essential-services.ts).
-- category maps to a fixed id in the code-defined registry (accountants, legal,
-- banking, ...); links with category = null are unaffected — they keep working
-- as ordinary content-rewrite links (src/lib/affiliate-rewrite.ts).
--
-- No RLS changes needed: migration 006 already exposes a public SELECT policy
-- on rows where active = true, which covers these new columns too.

alter table public.affiliate_links add column category text;
alter table public.affiliate_links add column country text;  -- 2-letter ISO, null = global
alter table public.affiliate_links add column note text;     -- e.g. "Best for sole traders and freelancers"

create index idx_affiliate_links_category on public.affiliate_links (category) where category is not null;
