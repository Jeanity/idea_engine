# Plan — Public site batch: footer, legal pages, contact, FAQ, account dropdown, header links

Date: 2026-07-09. From the HANDOFF spec "Public site: footer, socials, blog/FAQ, contact form,
account nav" (pieces 1, 2, 4, 5, 6). Blog/Articles (piece 3) is deliberately EXCLUDED — own
session later. Social icons (piece 7) EXCLUDED — no real handles yet, do not fabricate links.
Execute on Sonnet.

## Decisions taken (binding)

### 1. Footer (shared component)
- New `src/components/site-footer.tsx` (server component, no data needs): brand line,
  link columns: Product (Sample report, FAQ, Pricing→`/#pricing` if a pricing section exists on
  the homepage, else omit), Company (About, Contact), Legal (Terms, Privacy).
  Copyright line stays: `© {year} Idea Engine. All rights reserved.`
- Used on: homepage (`src/app/page.tsx`, replacing the bare one-liner), `/sample-report`,
  `/sign-in`, and the new static pages. NOT on `/app/*` (signed-in shell) for now.
- Style: matches the landing page's dark design language + `light:` variants.

### 2. Static pages: /terms, /privacy, /about
- Server components with `generateMetadata`/`metadata` (title + description).
- Shared simple prose layout (narrow column, headings, footer at bottom, minimal header with
  wordmark linking home — look at how /sample-report structures its public header and reuse).
- **Terms**: draft real-looking ToS covering: service description (AI-generated business research
  reports), reports are informational not professional/legal/financial advice, user retains all
  IP in their submitted ideas (Danny's standing product promise), payment/refund section marked
  "to be finalised", account deletion is permanent, limitation of liability, governing law
  Queensland/Australia. Top banner: "Draft — under legal review."
- **Privacy**: what's collected (account email, profile, ideas/answers, analytics events),
  processors (Supabase, Vercel, Anthropic API for report generation, Inngest), no selling of
  data, deletion = permanent erasure via account deletion, contact email for privacy requests
  (link to /contact). Same draft banner.
- **About**: short honest page — what Idea Engine does (turn a raw idea into a researched,
  actionable report), the product philosophy (no idea ever dismissed; facts not verdicts;
  encouragement grounded in evidence — mirror persona.ts language), built by a small independent
  team in Australia. No fabricated team bios, no fake stats.
- Product voice everywhere: never "teaser"; no AI-isms; facts not verdicts.

### 3. Contact form — /contact + admin queue
- Migration `supabase/migrations/012_contact_submissions.sql` (011 is taken by sample_reports):
  ```sql
  create table contact_submissions (
    id uuid primary key default gen_random_uuid(),
    category text not null check (category in ('feedback','complaint','question','partnership')),
    name text not null,
    email text not null,
    message text not null,
    user_id uuid references auth.users(id) on delete set null,
    status text not null default 'open' check (status in ('open','replied','closed')),
    created_at timestamptz not null default now()
  );
  ```
  RLS: enable; INSERT-only policy for anon + authenticated (with a sane message length CHECK
  or validate server-side); NO select/update/delete policies (admin reads via service role).
- Public page `/contact`: category selector (radio cards or select) with labels
  "Feedback" / "Complaint" / "General question" / "Partnership & advertising", name, email,
  message. Signed-in users get name/email pre-filled (server component passes them; still
  editable). Submits to `POST /api/contact` (validates category enum, field lengths ≤
  200/200/5000, basic email shape; inserts with the per-request client so the RLS insert
  policy is what authorises it; attach user_id when signed in). Success state on the page.
  Rate limiting: simple honeypot hidden field (reject if filled) — no captcha in v1.
- Admin page `/app/admin/contact` + `GET/PATCH /api/admin/contact` (standard admin gate
  pattern): list with category filter chips (mirror /app/admin/errors), status controls
  (open/replied/closed), newest first, pagination if the existing admin pagination helper
  fits. **Partnership rows get a highlighted amber chip** — commercially time-sensitive.
- Admin nav: add "Contact" (Mail icon) to the Management group in admin-shell.tsx.
- Email-to-Danny notification: OUT OF SCOPE (blocked on SMTP — noted in HANDOFF as a shared
  dependency; the queue is the v1 delivery).

### 4. FAQ — /faq
- Static accordion page, no DB. Native `<details>/<summary>` elements (accessible, no JS state).
- Draft honest content (~8-10 questions) from product truth: What is Idea Engine / What do I
  get in a report / initial vs full report / How accurate is it (AI estimates to validate,
  links may be verified but always double-check) / Who owns my idea (user retains all IP,
  ideas never shared) / What does it cost (pricing being finalised) / Can I delete my data
  (yes, permanent) / What idea types are supported (the 7 archetypes, plain-English) /
  How long does a report take. Facts only, no hype.
- Footer links to it (piece 1).

### 5. Homepage header links
- Public homepage header (`src/app/page.tsx`): add "FAQ" and "Contact" links beside the
  existing auth link. Keep it minimal; leave room for Blog later. Wrap for mobile.

### 6. Signed-in header: account icon + dropdown (`src/components/app-header.tsx`)
- Replace the top-right "My account" text link with a `CircleUserRound` icon button opening a
  dropdown: My account (→ /app/account), My ideas (→ /app/account, only when hasIdeas),
  New idea (→ /app), divider, Sign out (moves INTO the dropdown; remove the standalone
  sign-out if one exists in this header).
- Remove the top-left "My ideas" / "New idea" text links per Danny's explicit ask — wordmark
  + any Admin badge/Demo pill stay top-left.
- AppHeader is an async Server Component — the dropdown is a new small client subcomponent
  (`'use client'`, receives hasIdeas/isAdmin as props), click-outside + Escape to close,
  aria-expanded. Follow the existing SignOutButton component for how sign-out is performed
  (reuse it inside the menu if it composes cleanly).
- Admins: include an "Admin panel" item (→ /app/admin) in the dropdown, admin-only.

## Graceful degradation
`/contact` must not crash if migration 012 hasn't run: POST returns a friendly 503-style
error ("Contact form isn't available right now"), admin page shows the run-migration notice
(same pattern as /app/admin/samples).

## Verification (all must pass, in E:\idea-engine)
```
npx tsc --noEmit
npx next build
npx vitest run
```
Public pages (/terms, /privacy, /about, /faq, /contact, homepage footer) can be visually
spot-checked with the preview tools if the dev server runs — they're unauthenticated.

## Commit
ONE commit on main:
`feat(site): footer, terms/privacy/about, contact form + admin queue, FAQ, account dropdown`
ending with `Co-Authored-By: Claude <noreply@anthropic.com>`. DO NOT push.

## Out of scope
Blog/Articles (own plan later) · social icons (no handles yet) · SMTP/email notifications ·
captcha · footer on /app/* pages.
