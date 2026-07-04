# Handoff — 2026-07-05 (usage save point)

## State at save
All work is committed and pushed to `main` (deploys via Vercel automatically). Everything below **builds cleanly** (`npx tsc --noEmit` + `npx next build` pass, verified by the wiring subagent) but the financing step has **NOT been tested live** — that was the next action when we stopped.

## What landed this session (Phase 4B work)
1. **Expert-partner persona** — `src/lib/prompts/persona.ts` (`EXPERT_PARTNER_PREAMBLE`), prepended to all report prompts: competitor-research, compliance, cost-estimation, synthesis, financing. Partner-not-judge voice + "know what you don't know" specialist rule.
2. **Specialist-cost rule** in `cost-estimation.ts`: never omit specialist line items (PCB layout etc.), never fake precision — wide range + name the professional who can pin it down.
3. **Budget-gap rule** in `synthesis.ts`: when stated capital < estimated startup cost, at least one risk mitigation + one next step MUST address financing, using funding_options data when present.
4. **Financing-bridge step** (new, conditional) — `src/lib/prompts/financing.ts` + wiring in `generate-report.ts`: runs only when `parseNumber(answers cost.startup_capital) < sum(startup_costs[].estimate_low)`; web search (max 3), finds real grants/incentives/loans with official URLs → `sections.funding_options` → rendered as "Funding Options" card in Costs & Pricing tab → fed into synthesis. Not-triggered = key absent = no card.
5. **Plan docs**: new `docs/plan/PHASE_04B_report_quality_tiers.md` (quality/cost/tier-boundary phase, decision log started); INDEX.md updated (4B row, two-tier pricing note); PHASE_05 rewritten for two tiers (US$19.95 / US$49.95, `report_tier` column, blocked on 4B.4 decision).

## Economics agreed (Danny, 2026-07-05)
- Tier 1 US$19.95, generation cost target ≤US$0.60 (ceiling $1.00)
- Tier 2 US$49.95, generation cost target ≤US$2.00
- Premium-tier candidate steps listed in PHASE_04B (financing deep-dive, 10-search competitors, supplier sourcing, scenario modeling, citations)

## Next actions (in order)
1. **Live-test the financing prompt** (~US$0.10): script ready at
   `C:\Users\w3bt3\AppData\Local\Temp\claude\E--sig\cef12796-a6cd-4254-bd68-39cf7a562410\scratchpad\test-financing.cjs`
   (scratchpad is session-scoped — if gone, it rebuilt the financing system prompt from the two prompt files and called Sonnet with web_search max_uses 3 using the invention scenario: capital $2k–10k vs AUD 13k–60k startup. Recreate in ~20 lines.)
   Check: stop_reason end_turn, valid JSON array, real .gov.au URLs, sensible items.
2. **Regenerate the charger report** in prod (admin button, ~US$0.30–0.60) — verify: financing card appears in Costs & Pricing, synthesis next steps name actual programs, risks have mitigations, cost shown under report (`sections._meta.cost_usd`).
3. **Task 4B.3**: run the 14-report cost/quality matrix (2 ideas × 7 archetypes), log in docs/QUALITY_LOG.md (Haiku script to dump id/archetype/cost/failures from Supabase reports table).
4. **Task 4B.4**: tier-boundary decision from that data → then Phase 5 payments can start (Stripe account setup should begin now-ish regardless — activation takes days).

## Gotchas for the next session
- Prompt JSON schemas must pin exact key names (unpinned risks schema → empty cards; fixed by "EXACT JSON SHAPES" block in synthesis).
- callAI throws on stop_reason=max_tokens; keep maxTokens ≥4096 for JSON-heavy prompts.
- Web search = dominant cost (caps: competitors 5, compliance 3, financing 3). Per-report cost in `sections._meta.cost_usd`, admin-visible under the report.
- Model routing: cheapest capable (Haiku → Sonnet → Fable/Opus for prompt/architecture design only).
