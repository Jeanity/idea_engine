-- Migration 008: report cost tracking (Block 7)
-- Run in Supabase SQL editor after 007_offers.sql. RUN MANUALLY.
--
-- Total AI spend (USD) on this report row to date. Both generate-teaser.ts
-- and generate-report.ts write here when their run finalizes, adding their
-- run's cost to whatever was already recorded — so the column always reflects
-- cumulative spend on the row, not just the latest run (e.g. a teaser rerun
-- followed by a full-report upgrade accumulates both).

alter table public.reports add column cost_usd numeric null;
