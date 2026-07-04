# Phase 04B — Report Quality, Cost Envelope & Tier Boundary

Inserted between the report pipeline (Phase 4) and payments (Phase 5) after the first real report runs (July 2026). Goal: lock the quality bar and the cost envelope of the $19.95 report, and decide the exact $19.95 / $49.95 tier boundary from measured data — BEFORE Stripe integration bakes prices in.

## Economics guardrails (agreed 2026-07-05)
- **Tier 1 full report: US$19.95** — target generation cost **≤ US$0.60**, hard ceiling US$1.00.
- **Tier 2 premium report: US$49.95** — target generation cost **≤ US$2.00** (Danny's stated ceiling), giving room for hosting/ads/Stripe fees and profit.
- Per-report cost is now measured automatically (`sections._meta.cost_usd`, shown to admins under each report).

## Goal ("done" looks like)
Tier-1 report consistently good across archetypes at ≤ $0.60; a written tier boundary in this file's decision log; premium-tier step list costed with real measurements, ready to build alongside Phase 5 payments.

## Tasks (in order)

### 4B.1 Expert-partner persona + specialist-humility prompt rules — ✅ DONE 2026-07-05
**Model: Fable (prompt design).**
Shared `EXPERT_PARTNER_PREAMBLE` (src/lib/prompts/persona.ts) prepended to all report prompts: partner-not-judge voice, never abandon an idea without showing the path around the obstacle, mark specialist-dependent figures (PCB layout, food chemistry, IP strength…) as wide-range estimates naming the professional who can verify. Cost prompt gained the SPECIALIST-COST RULE; synthesis gained the BUDGET GAP RULE.

### 4B.2 Financing-bridge step — ✅ DONE 2026-07-05
**Model: Fable (prompt) + Sonnet (wiring).**
Conditional pipeline step: when stated capital < estimated startup low-bound, run web-search funding research (max 3 searches) → real grants/incentives/loans/crowdfunding with official links → `sections.funding_options`, rendered in Costs & Pricing tab, fed into synthesis so risks/next steps reference actual programs. Adds ~US$0.05–0.15 only to reports that need it.

### 4B.3 Cost & quality test matrix
**Model: the app itself + Danny grading; Haiku for the dump script.**
Run 2 ideas per archetype (14 reports ≈ US$6–10 total) through the full pipeline. A small script dumps report id / archetype / cost_usd / section-failure flags from Supabase into docs/QUALITY_LOG.md; Danny grades usefulness per section (keep / tweak / cut). This is the data the tier boundary decision needs.

### 4B.4 Tier boundary decision
**Model: human (Danny), with a Fable recommendation memo from the 4B.3 data.**
Decide exactly which sections/steps are Tier 1 vs Tier 2. Record the decision + rationale in the log below. Feeds directly into Phase 5 (two Stripe prices, `report_tier` on purchases, tier-gated pipeline steps).

## Premium-tier ($49.95) candidate steps — build with/after Phase 5, NOT before
Each is one extra search-enabled or reasoning-heavy call (~US$0.20–0.50 each, measure in 4B.3 style before locking):
1. **Financing deep-dive** — expanded version of 4B.2 (more searches, application requirements, deadlines) for every premium report, not just budget-gap ones.
2. **Expanded competitors** — search cap 5 → 10, deeper per-competitor detail.
3. **Supplier/manufacturer sourcing** (product/invention archetypes) — real supplier leads, not just cost lines.
4. **Scenario modeling** — best / worst / most-likely cost & margin cases.
5. **Full source citations** — every claim traceable; the "down to the best-guessed penny" promise.

## Dependencies
Phase 4 complete. Blocks the pricing parts of Phase 5 (task 5.1) — do not create Stripe products until 4B.4 is logged.

## Acceptance criteria
- [ ] 14-report matrix run with costs logged in docs/QUALITY_LOG.md
- [ ] Tier-1 average cost ≤ US$0.60, no single report > US$1.00 (else: tighten caps or move a step to Tier 2)
- [ ] Budget-gap ideas produce funding_options with ≥2 real official-source links
- [ ] No confident specialist figures without an "est. — verify with X" style flag
- [ ] Tier boundary decision recorded below

## Decision log
- 2026-07-05 — Two tiers confirmed (Danny): $19.95 ≈ current pipeline tightened; $49.95 = premium pass. Cost ceilings: $0.60 / $2.00.
