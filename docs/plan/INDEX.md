# Universal Idea Production Engine — Build Plan Index

**Product (MVP):** User enters a raw business idea → app classifies it and asks targeted follow-up questions → runs competitor research and cost estimation → produces a structured opportunity report → free preview, one paid tier unlocks the full report.

**Stack (committed):** Next.js 15 (App Router, TypeScript) on Vercel · Supabase (Postgres + magic-link auth) · Claude API (Sonnet for generation, with built-in web search tool for research) · Inngest (async report jobs) · Stripe Checkout (payments) · Resend (email) · Tailwind CSS.

**Explicitly OUT of MVP (see PHASE_07):** pitch generator, pitch rooms, supporter/investor marketplace, equity/success-fee features, idea vault comparisons, validation experiments.

**Pricing (revised 2026-07-05, supersedes the single-tier note above):** two tiers — US$19.95 full report (current pipeline, cost target ≤US$0.60/report) and US$49.95 premium report (deeper research pass, cost target ≤US$2.00/report). Boundary locked by measurement in Phase 4B before Stripe work begins.

## Phases in build order

| # | File | One-liner | Depends on |
|---|------|-----------|------------|
| 1 | [PHASE_01_foundation.md](PHASE_01_foundation.md) | Repo, schema, auth, deploy pipeline, app shell — a live (empty) app at a real URL | — |
| 2 | [PHASE_02_idea_intake.md](PHASE_02_idea_intake.md) | Idea entry form + AI classification into idea archetypes, persisted per user | Phase 1 |
| 3 | [PHASE_03_guided_questions.md](PHASE_03_guided_questions.md) | Archetype-specific follow-up question wizard with save/resume | Phase 2 |
| 4 | [PHASE_04_report_pipeline.md](PHASE_04_report_pipeline.md) | Async research + cost estimation + report generation, viewable with preview/locked sections | Phase 3 |
| 4B | [PHASE_04B_report_quality_tiers.md](PHASE_04B_report_quality_tiers.md) | Expert-partner persona, financing-bridge step, cost/quality test matrix, $19.95/$49.95 tier boundary decision | Phase 4 |
| 5 | [PHASE_05_payments.md](PHASE_05_payments.md) | Stripe Checkout (two tiers), full-report unlock, email delivery, "my reports" page | Phase 4B (task 4B.4) |
| 6 | [PHASE_06_launch.md](PHASE_06_launch.md) | Landing page, legal pages/disclaimers, analytics, abuse/cost controls, QA, launch | Phase 5 |
| 7 | [PHASE_07_post_mvp_quarantine.md](PHASE_07_post_mvp_quarantine.md) | **NOT BUILT NOW.** Pitch generator, pitch rooms, marketplace, equity — legal-risk quarantine notes | Post-launch |

## Post-phase feature plans

- [2026-07-14-evergreen-baselines-and-bug-flagged-reports.md](2026-07-14-evergreen-baselines-and-bug-flagged-reports.md) — self-populating per-country evergreen research cache (compliance first) + admin inspector for bug-flagged reports

## Rules of the road

- Each phase ends in something you can click and demo. Do not start a phase until the previous phase's acceptance criteria pass.
- Model routing: **Opus** = architecture / schema / prompt design only. **Sonnet** = default for all implementation. **Haiku** = boilerplate, copy variants, repetitive tests.
- Money burn guardrail: every LLM call goes through one server-side module (`lib/ai.ts`) so cost caps and model swaps are one-file changes (established in Phase 1).
- Nothing in Phases 1–6 may store, model, or promise investor connections, equity, or success fees. Keep the schema clean of it (see Phase 7 for why).
