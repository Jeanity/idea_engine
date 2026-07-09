-- Migration 017: multi-country affiliate links (Block: essential services)
-- Run in the Supabase SQL editor after 016_affiliate_categories.sql. RUN MANUALLY.
--
-- The single `country text` column (migration 016) can't represent a link
-- that legitimately serves multiple countries (e.g. Hnry works in both AU and
-- NZ) without duplicating the row. Replaces it with `countries text[]`.
--
-- Semantics: countries is null or an empty array = global link (unchanged
-- from the old country = null meaning). Non-empty = the list of 2-letter ISO
-- codes the link is scoped to.

alter table public.affiliate_links add column countries text[];

update public.affiliate_links set countries = array[country] where country is not null;

alter table public.affiliate_links drop column country;
