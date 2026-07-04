# Phase 06 — Launch Readiness

## Goal ("done" looks like)
The app is safe to put in front of strangers who pay: real landing page, legal pages and in-product disclaimers, cost/abuse guardrails so a traffic spike can't bankrupt your API bill, basic analytics and error visibility, and a completed QA pass. Ends with the public launch.

## Dependencies
Phase 5 complete (payments live-verified).

## Tasks (in order)

### 6.1 Landing page
**Model: Sonnet** for structure + primary copy (conversion copy is judgment work); **Haiku** for headline/tagline variants to choose from.
Hero (use a pitch tagline, e.g. "Turn any idea into a researched, costed, actionable opportunity"), how-it-works (enter idea → answer questions → get your report), an example report screenshot or redacted sample, single price, FAQ, CTA into sign-up. No blog, no about page.

### 6.2 Legal pages + in-product disclaimers
**Model: Sonnet** — drafting from the pitch's own trust-and-safety section; needs coherent legal-adjacent writing.
Terms of Service, Privacy Policy, Refund Policy pages; the standard disclaimer block (from `docs/REPORT_SPEC.md`) rendered on every report and in the report email: estimates not guarantees, not legal/financial/tax advice, verify permits with authorities, user owns their idea and their data. **Flag: have a human professional review these before spending on ads — LLM-drafted terms are a starting point, not a shield.**

### 6.3 Cost & abuse guardrails
**Model: Sonnet** — small but must be right.
In `lib/ai.ts` + report API: per-user daily report-generation cap (e.g. 3 free previews/day), global daily LLM spend kill-switch (env-configured, refuses new generations past the cap with an honest message), rate limiting on all AI-calling routes. Reports are the expensive path — previews must be cheap or capped.

### 6.4 Analytics + error monitoring
**Model: Haiku** — drop-in integrations.
Plausible (or Vercel Analytics) for page/funnel views; Sentry free tier for server + client errors; log every report generation with cost. You need to see: visits → sign-ups → previews → purchases.

### 6.5 Full QA pass
**Model: Sonnet** — exploratory judgment.
Fresh-account walkthrough of the entire funnel on desktop + phone, including: bad inputs, back-button abuse, expired magic links, mid-wizard abandonment, generation failure recovery, paying from the email link. File and fix everything severity-high; log the rest in `docs/KNOWN_ISSUES.md`.

### 6.6 Launch checklist + go-live
**Model: Haiku** — checklist assembly; the launching is you.
Custom domain, Stripe live keys, webhook endpoint re-pointed at prod domain, env vars audited, Supabase backups confirmed on, support email in footer, `docs/LAUNCH.md` checklist executed. Then post it where your first users are (small: a niche community, not Product Hunt on day 1).

## Acceptance criteria
- [ ] A stranger can go URL → sign up → idea → questions → preview → pay → full report with zero intervention from you.
- [ ] Every report and report email carries the disclaimer block; ToS/Privacy/Refund pages linked in footer and at checkout.
- [ ] Kill-switch verified: with the spend cap set to $0, new generations refuse gracefully.
- [ ] Sentry captures a deliberately thrown test error; analytics shows the funnel steps.
- [ ] Site works on a real phone over mobile data.
- [ ] First real (non-you) paid report delivered.

## Solo-operator sizing
~1–1.5 weeks part-time. Resist scope creep here — everything not on this list is post-launch.
