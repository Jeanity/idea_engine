-- Migration 024: reusable message templates for admin compose modals
-- Run in the Supabase SQL editor after 023_admin_seen.sql. RUN MANUALLY.
--
-- Named, reusable message bodies per compose "kind" (invite email, contact
-- reply, feedback reply). Each kind may have at most one default template
-- (enforced by the partial unique index below), which pre-fills the
-- corresponding compose modal's textarea — still fully editable before send.
-- See src/components/admin/template-picker.tsx for the shared picker UI used
-- in all three compose surfaces.
--
-- Service-role only, same model as contact_replies (022) and feedback_replies
-- (019): RLS is enabled with NO policies, so only the admin API routes
-- (src/app/api/admin/templates/*, after the isAdminEmail gate) can touch this
-- table — never exposed to anon/authenticated clients.
--
-- Graceful degradation: until this migration is run, GET /api/admin/templates
-- returns an empty list with migrationMissing: true, mutations 503, and the
-- picker renders nothing — composing a message never depends on templates
-- existing (same pattern as contact_replies/feedback_replies).

create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('invite', 'contact_reply', 'feedback_reply')),
  name text not null check (char_length(name) between 1 and 80),
  body text not null check (char_length(body) between 1 and 10000),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Partial unique index is the backstop for "at most one default per kind" —
-- the API always clears is_default on the kind's other rows in a separate
-- statement BEFORE setting the new default, so this index should never
-- actually reject a well-formed request; it exists to guarantee the
-- invariant even if that two-step sequence is ever skipped.
create unique index message_templates_one_default_per_kind
  on public.message_templates (kind) where is_default;

alter table public.message_templates enable row level security;

-- No policies — service-role only (see note above).
