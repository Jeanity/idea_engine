# Phase 01 — Foundation

## Goal ("done" looks like)
A deployed, empty-but-real web app: `https://<yourapp>.vercel.app` loads a branded shell, users can sign in with a magic link, the Postgres schema for the whole MVP exists, and every future phase has a place to plug in. No product features yet.

## Dependencies
None. This is the starting phase.

## Tasks (in order)

### 1.1 Commit product + data vocabulary
**Model: Opus** — one-time architecture decision that everything else hangs off.
Define the core entities and their lifecycle before any code:
- `users` (Supabase-managed)
- `ideas` (raw_text, archetype, location, status: `draft → questioning → researching → ready`)
- `answers` (idea_id, question_key, question_text, answer_text)
- `reports` (idea_id, status: `queued → running → complete → failed`, sections JSONB, preview_sections JSONB, error)
- `purchases` (user_id, report_id, stripe_session_id, status)
Output: `docs/DATA_MODEL.md` in the repo with the entity diagram and status flows. **Deliberately no tables for pitches, supporters, or equity** (Phase 7 quarantine).

### 1.2 Scaffold the repo
**Model: Sonnet** — standard implementation with a few judgment calls (folder layout, config).
`create-next-app` (Next.js 15, App Router, TypeScript, Tailwind). Add ESLint + Prettier. Create the folder skeleton: `app/`, `lib/` (with stub `lib/ai.ts`, `lib/db.ts`), `components/`. First commit + GitHub repo.

### 1.3 Supabase project + schema migration
**Model: Sonnet** — implementation of the 1.1 design.
Create Supabase project (free tier). Write SQL migration implementing 1.1. Enable Row Level Security so users only read their own ideas/reports. Wire `lib/db.ts` with the Supabase server client.

### 1.4 Magic-link auth
**Model: Sonnet** — well-trodden integration, still needs care around middleware/session.
Supabase Auth email magic links (no passwords — less code, less risk). Auth middleware protecting `/app/*` routes; public marketing routes stay open. Sign-in page + signed-in header state.

### 1.5 Central AI module stub
**Model: Sonnet** — small but load-bearing.
`lib/ai.ts`: one function wrapping the Anthropic SDK (model name, max tokens, and per-request cost logging in one place). All later phases call through this. Add `ANTHROPIC_API_KEY` env handling.

### 1.6 Deploy to Vercel
**Model: Sonnet** — config + env plumbing.
Connect GitHub repo to Vercel, set env vars (Supabase URL/keys, Anthropic key), confirm production deploy on every push to `main`.

### 1.7 App shell + placeholder landing
**Model: Haiku** — pure boilerplate/layout, zero ambiguity once 1.2–1.4 exist.
Header/footer layout, placeholder landing page ("coming soon" hero + email sign-in CTA), empty `/app` dashboard page for signed-in users.

## Acceptance criteria
- [ ] Visiting the production URL shows the landing page; `/app` redirects to sign-in when logged out.
- [ ] You can sign in via magic link with your real email and land on the dashboard.
- [ ] All tables from `docs/DATA_MODEL.md` exist in Supabase with RLS enabled (verify: a second test user cannot query the first user's rows).
- [ ] A test API route that calls `lib/ai.ts` returns a Claude completion in production.
- [ ] Pushing to `main` auto-deploys.

## Solo-operator sizing
~1 week part-time. If auth fights you, timebox it — Supabase magic link is the fallback-free path; don't add OAuth providers now.
