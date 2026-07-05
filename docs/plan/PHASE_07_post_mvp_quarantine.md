# Phase 07 — Post-MVP Quarantine (NOT BUILT NOW)

## Purpose of this file
Everything from the pitch that is **deliberately excluded** from the MVP lives here, with the reasons — so it stays out of the schema, the prompts, and the marketing copy until it's a conscious, resourced decision. Nothing in this file has tasks or model assignments; it is not scheduled.

## Quarantined features

### A. Pitch generator & pitch decks
Deferred, low legal risk. Genuinely useful later, but it's a second product bolted onto the first. Build only after paid-report revenue proves demand. When built, it reads from the existing `reports` JSONB — no MVP schema change needed, which is why it costs nothing to defer.

### B. Pitch rooms / shareable pitches
Deferred, **moderate legal/product risk**. Public/link-shared idea content immediately raises: idea-theft anxiety (the pitch itself proposes NDA-style controls, viewer logs, request-access workflows — each a real feature), privacy obligations, and content moderation of user-published material. MVP keeps all reports private behind auth; there are intentionally **no public URLs** in Phases 1–6.

### C. Supporter / investor marketplace
Deferred, **high legal risk**. Connecting founders with investors, taking connection fees, or featuring pitches to investors can constitute regulated activity: in Australia this walks toward AFSL (Australian Financial Services Licence) territory and ASIC-regulated fundraising/intermediary rules; in the US, broker-dealer registration and SEC exposure. "Carefully structured" (the pitch's words) means **lawyers before code**. Also carries fraud, spam, and platform-liability surface.

### D. Equity participation / success fees / revenue share
Deferred, **highest legal risk — do not touch without counsel**. Taking equity or success fees for facilitating investment is the most heavily regulated idea in the pitch (securities law, financial-intermediary licensing, potential managed-investment-scheme issues). The pitch itself flags this as later-stage; this plan hardens that: **no schema fields, no ToS clauses, no marketing promises that presuppose it.** Adding it later is a legal project first and a software project second.

### E. Smaller cut features (deferred for speed, not risk)
- **Idea Vault / idea comparison & scoring across ideas** — MVP has a plain ideas list; comparison is a feature to sell to power users later.
- ~~**Three report tiers ($1.95 / $9.95 / $49.95)** — MVP ships free preview + one A$19 tier.~~ **Superseded 2026-07-05:** two tiers (US$19.95 / US$49.95) locked — see PHASE_04B.
- **Validation experiments** (landing-page tests, demand tests) — a whole coaching product; the MVP report's "next steps" section covers the advice-level version.
- ~~**Report export libraries (PDF generation)** — print stylesheet covers export at MVP quality.~~ **Un-deferred 2026-07-05** (Danny): downloadable PDF is part of the paid product — now task 5.5 in PHASE_05.
- **Team/agency accounts, saved templates, API access** — no signal yet that anyone wants them.

## Architecture guarantees that keep the quarantine cheap
1. Reports are structured JSONB — pitch generation later is a new consumer of existing data, not a migration.
2. All sharing is auth-gated in MVP — adding public sharing later is additive (a `shares` table), not a rework.
3. No money flows between users in MVP — Stripe setup is simple merchant checkout; marketplace payments (Stripe Connect) would be a separate integration, cleanly added later.
4. The `purchases` model is per-report — subscriptions or credits can be layered on without unwinding it.

## Re-entry criteria (when to reopen this file)
- A/B: after ~50 paid reports and repeated user requests for pitching/sharing.
- C/D: only with revenue that justifies specialist legal advice in your operating jurisdiction, obtained **before** design work begins.
