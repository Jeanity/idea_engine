-- Migration 027: add 'billing' to the contact_submissions category enum.
-- Run in the Supabase SQL editor after 026_local_day_graphs.sql. RUN MANUALLY.
--
-- Pre-payments slice of customer support: public /contact gets a "Billing &
-- refunds" category so refund/chargeback-risk mail can be flagged loudly in
-- the admin queue (/app/admin/contact) instead of blending in with 'question'
-- or 'complaint'. The actual refund-action UI, order-confirmation emails, and
-- "My purchases" self-service are deferred to the payments build — this
-- migration only extends the category check constraint.
--
-- Graceful degradation: until this migration is run, a 'billing' submission
-- fails the existing check constraint with Postgres error 23514
-- (check_violation). POST /api/contact catches that specific case (see
-- isBillingCategoryUnsupported in src/app/api/contact/route.ts) and returns a
-- friendly 400 pointing the submitter at hello@hadidea.com directly, rather
-- than a 500 — the public form never crashes because of a pending migration.

alter table public.contact_submissions
  drop constraint contact_submissions_category_check;

alter table public.contact_submissions
  add constraint contact_submissions_category_check
  check (category in ('feedback', 'complaint', 'question', 'partnership', 'billing'));
