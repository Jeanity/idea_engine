# Handoff — updated 2026-07-05 (financing step now live-tested)

## State at save
All work is committed and pushed to `main` (deploys via Vercel automatically). Financing prompt **live-tested and passing**: 6 real QLD/AU programs (R&D Tax Incentive, Ignite Ideas, CSIRO Kick-Start…), correct JSON keys, US$0.16/run with 3 searches. Test found and fixed two issues: (1) 2048-token cap truncated search-enabled output → financing step now 4096; (2) model constructs stale deep-links from memory (CSIRO URL 404'd) → financing + compliance prompts now require URLs copied exactly from search results. `scripts/dump-quality-log.ts` added for the 4B.3 matrix.

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
1. ~~Live-test the financing prompt~~ ✅ DONE 2026-07-05 — passed (see State above).
2. **Regenerate the charger report** in prod (Danny: admin button, ~US$0.30–0.75) — verify: Funding Options card appears in Costs & Pricing, synthesis next steps name actual programs, risks have mitigations + partner voice, generation cost shown under report (`sections._meta.cost_usd`).
3. **Task 4B.3**: run the 14-report cost/quality matrix (2 ideas × 7 archetypes — Danny enters them through the wizard). Then `npx tsx scripts/dump-quality-log.ts` prints the markdown table for docs/QUALITY_LOG.md; Danny fills the Grade column.
4. **Task 4B.4**: tier-boundary decision from that data → then Phase 5 payments can start (Stripe account setup should begin now-ish regardless — activation takes days).
5. Consider later (4B backlog): server-side URL liveness check (drop 404/410s, keep 403s — bot-blockers) for financing/compliance/competitor links.

## Gotchas for the next session
- Prompt JSON schemas must pin exact key names (unpinned risks schema → empty cards; fixed by "EXACT JSON SHAPES" block in synthesis).
- callAI throws on stop_reason=max_tokens; keep maxTokens ≥4096 for JSON-heavy prompts.
- Web search = dominant cost (caps: competitors 5, compliance 3, financing 3). Per-report cost in `sections._meta.cost_usd`, admin-visible under the report.
- Model routing: cheapest capable (Haiku → Sonnet → Fable/Opus for prompt/architecture design only).
