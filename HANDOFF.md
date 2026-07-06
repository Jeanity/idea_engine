# Handoff — 2026-07-06

## Current state
Cosmetic sprint COMPLETE and Danny-approved. Local dev mode active: `AI_PROVIDER=mock` in .env.local (all AI calls return fixtures, $0, instant). Dev servers via .claude/launch.json in E:\sig: `idea-engine` (port 3000) + `idea-engine-inngest` (port 8288 — required for report generation locally). Back to real AI: set `AI_PROVIDER=anthropic` (or remove), restart dev server.

## Shipped and verified (all pushed to main → Vercel)
- **Theming**: dark futuristic default across the ENTIRE site (landing, sign-in, sample report, full signed-in app); light mode toggle on every page (sun/moon in headers; persisted, no-flash init; `light:` variant via @custom-variant in globals.css). Contrast rule: translucent dark pills become solid pastels in light (`bg-{c}-100 text-{c}-700`). Engine-bay generating screen stays dark in BOTH themes by design. Report print stays black-on-white (`.print-force-light`).
- **Public sample report** (`/sample-report`, linked from landing hero + report-anatomy section): Sydney mobile coffee van, hand-curated in `src/lib/sample-report.ts`, rendered through the real FullReportViewer. Fictional competitors, all links '#' + click-neutralized, banner explains real reports have live links. Thesis showcases the product: "a site-acquisition business that happens to sell coffee."
- **Landing**: marquee with privacy-redacted cards (blur covers NONSENSE text only), score rings via `src/lib/score-bands.ts` (amber floor, NO red), demo stats in DEMO_STATS (TODO: real numbers at launch).
- **App UX**: inline idea intake on dashboard ("Start the engine"), engine-bay progress screen (gears, fuel line, console ticker, bouncing blobs), My ideas/New idea/My account nav, account identity banner, Google OAuth + magic link (both landing on /app).
- **Pipeline**: expert-partner persona + no-discouragement + banned AI-isms; "Things to consider"/"How to handle it" naming; financing-bridge step (runs on budget gap, ≤3 searches, 4096 tokens); search caps (5/3/3); per-report cost in sections._meta.cost_usd (admin-visible); stale queued/running reports auto-recover after 10 min.

## Next actions (priority order)
1. **Danny visual pass** on light mode across the tour (landing → sample → sign-in → app) — automated checks passed; final feel is his call. DONE per Danny "works perfectly" 2026-07-06, but flag anything on re-look.
2. **Switch to Anthropic mode and regenerate the charger report** (~US$0.30–0.75): verify funding-options card renders live, partner voice in synthesis, engine bay at real speed, cost line under report.
3. **Task 4B.3 — cost/quality matrix**: 14 ideas (2/archetype) through the wizard on Anthropic mode; `npx tsx scripts/dump-quality-log.ts` → paste into docs/QUALITY_LOG.md → Danny grades → 4B.4 tier-boundary decision (locks $19.95/$49.95 split; all update-pricing figures are placeholders until then).
4. **Stripe account signup** — start now; activation review takes days and it's the only external blocker for Phase 5.
5. **Phase 5 build** (after 4B.4): two-tier checkout, webhook unlock, PDF download (task 5.5, @react-pdf/renderer), paid report updates + "what's new" diff (5.6b — Opus/Fable designs the diff), email delivery, my-reports polish.
6. Backlog: wizard privacy-consent question (public showcase opt-in, location-only visibility); URL liveness checks for report links; headline-score derivation for real reports (4B.5); re-capture fixtures after next real report (`npx tsx scripts/capture-fixtures.ts`).

## Gotchas
- Mock mode renders the charger fixture for EVERY idea — plumbing only; judge report quality ONLY on Anthropic mode.
- Prompts must pin exact JSON key names; callAI throws on max_tokens truncation (keep ≥4096 for JSON-heavy calls).
- Web search = dominant report cost. Sample-report page must never gain real/fabricated URLs (link-rot + fabrication policy).
- Public blur = nonsense text underneath, always (devtools removes blur).
- Model routing: cheapest capable — Haiku (boilerplate) → Sonnet (implementation, all UI agents) → Fable/Opus (prompts, architecture, diff design, sales copy).
- Preview-browser screenshots time out on animated pages — verify with snapshots/eval/inspect instead.
