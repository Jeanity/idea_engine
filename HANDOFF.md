# Handoff — 2026-07-05 end of day (cosmetic sprint + light mode)

## Where things stand
Local dev mode active: `AI_PROVIDER=mock` in .env.local (all AI calls return fixtures, $0; reports finish instantly). Dev servers via .claude/launch.json in E:\sig: `idea-engine` (port 3000) + `idea-engine-inngest` (port 8288 — REQUIRED for report generation locally, see README "Local dev mode"). Switch back to real AI: remove/set `AI_PROVIDER=anthropic`, restart dev server.

## Today's completed work (all pushed to main, deploys to Vercel)
- **Landing page**: dark futuristic hero (blobs, dot grid, demo stat badge in DEMO_STATS const), seamless report-card marquee incl. 2 privacy-redacted cards (blur covers NONSENSE text — never real ideas), score donut rings via `src/lib/score-bands.ts` (amber floor, NO red — editable config), consistent location lines.
- **Voice**: EXPERT_PARTNER_PREAMBLE now bans discouragement + AI-isms; "Key Risks" → "Things to consider" / "How to handle it" everywhere user-facing.
- **Sign-in**: dark reskin + Google OAuth (working; Supabase redirect allowlist configured for localhost + prod).
- **Dashboard**: inline idea intake ("What's the idea?" / "Start the engine"), location prefill, /app/new redirects to /app.
- **Nav**: My ideas / New idea / My account links; account page identity banner.
- **Engine bay generating screen**: full-bleed dark, spinning gears, fuel-line steps, console ticker, bouncing glow blobs (BouncingBlob in report-client.tsx).
- **Whole signed-in app converted to dark theme** (commit 642244e): all screens + report viewer. **Print stays black-on-white** via `.print-force-light` + @media print rule in globals.css.
- **Fixes**: Inngest local setup (INNGEST_DEV=1 + dev server), stale queued/running report auto-recovery (10-min threshold in /api/reports), readable error messages on generation failure.

## Light mode — ✅ DONE (commit 340af0d, 2026-07-06)
Dark is the default; sun/moon toggle in the AppHeader (persisted in localStorage('theme'), no-flash init script in layout.tsx, `@custom-variant light` in globals.css). Every signed-in screen has `light:` overrides. Deliberate choices: the generating "engine bay" stays dark in BOTH themes (signature moment); landing + sign-in are dark-only for now (extend later if Danny wants). Danny has NOT yet visually reviewed light mode — first thing to sanity-check next session.

## Standing queue (unchanged)
1. Regenerate charger report on Anthropic mode (~US$0.30–0.75) — verify funding options card + partner voice + engine bay animation at real speed.
2. Task 4B.3: 14-idea cost/quality matrix (2/archetype, Danny via wizard) → `npx tsx scripts/dump-quality-log.ts` → grade → 4B.4 tier boundary decision → unblocks Phase 5 payments.
3. Stripe account signup (activation takes days — start early).
4. Phase 5 additions specced: PDF download (5.5), paid report updates + "what's new" diff (5.6b, prices are placeholders).
5. Wizard privacy-consent question (HANDOFF item 7 → now in this queue): public-visibility opt-in + private-but-location-visible checkbox; blurred public content must cover nonsense text.
6. Backlog: URL liveness checking for report links; headline-score derivation for real reports (4B.5); light mode for landing/sign-in if Danny wants it.

## Gotchas
- Mock mode: every report renders charger-report fixture content regardless of idea — plumbing test only; judge prompt/report quality ONLY on Anthropic mode.
- Prompt JSON schemas must pin exact key names; callAI throws on max_tokens truncation (keep ≥4096 for JSON-heavy, financing included).
- Web search caps: competitors 5 / compliance 3 / financing 3. Cost per report in sections._meta.cost_usd (admin-visible under report).
- Model routing: cheapest capable (Haiku → Sonnet → Fable/Opus only for prompts/architecture/diff-design).
