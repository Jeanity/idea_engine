-- Migration 010: per-admin report model override (model experiments)
-- Run in Supabase SQL editor after 009_error_log.sql. RUN MANUALLY.
--
-- Lets the admin pick which Claude model generates FULL reports for ideas
-- owned by their own account, to compare quality vs cost across models
-- (e.g. "what does a Haiku report look like?"). NULL = app default
-- (claude-sonnet-5). Only settable via the ADMIN_EMAIL-gated
-- /api/profile/report-model route, same pattern as demo_mode — a non-admin
-- user's value is never written and would only affect their own reports
-- anyway. Teaser generation stays on Haiku regardless (already the cheapest).

alter table public.profiles add column report_model text null;
