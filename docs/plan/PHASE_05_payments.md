# Phase 05 — Payments & Unlock

> **Revised 2026-07-05:** two tiers replace the original single-tier plan — **US$19.95** full report (current pipeline) and **US$49.95** premium report (deeper pass; step list in PHASE_04B). The exact section split comes from Phase 4B's measured decision (task 4B.4) — do not start 5.1 before that is logged.

## Goal ("done" looks like)
Two paid tiers. A user with a generated report picks a tier, pays via Stripe Checkout, and the corresponding sections open immediately; they also get the report link by email. You can take real money.

## Dependencies
Phase 4 complete; **Phase 4B task 4B.4 (tier boundary decision) logged**. Requires a Stripe account (business details, bank account) — **start the Stripe account setup at the beginning of this phase; activation review can take days.**

## Tasks (in order)

### 5.1 Pricing setup (two tiers)
**Model: Sonnet** — operational config; the pricing decision itself comes from Phase 4B.
Two Stripe products in test mode: **US$19.95 full report** and **US$49.95 premium report**. Add `report_tier` ('full' | 'premium') to the `purchases` table; premium purchases trigger the premium pipeline steps (PHASE_04B list) for that report. Document in `docs/PRICING.md` with the measured per-report costs from 4B.3 (targets: ≤$0.60 tier 1, ≤$2.00 tier 2).

### 5.2 Checkout integration
**Model: Sonnet** — well-documented integration, needs correctness care.
"Unlock full report" → `POST /api/checkout` creates a Stripe Checkout Session (report_id in metadata) → redirect to Stripe-hosted page (no custom card UI, no PCI scope) → success/cancel URLs back to the report.

### 5.3 Webhook + unlock logic
**Model: Sonnet** — the correctness-critical piece.
`/api/webhooks/stripe` verifies signature, on `checkout.session.completed` creates the `purchases` row. Report viewer renders full sections iff a completed purchase exists (server-side check — never trust the client). Handle: duplicate webhook delivery (idempotent), user paying twice (block with "already unlocked"), webhook arriving before redirect (success page polls briefly).

### 5.4 Email delivery
**Model: Sonnet** — small integration.
Resend (free tier): on purchase, email "Your report is ready" with a link to the report (behind auth — no public URLs in MVP). Plain, deliverable HTML.

### 5.5 PDF download (added 2026-07-05, reverses the earlier "print stylesheet is enough" cut)
**Model: Sonnet** — library integration with layout care.
Purchased reports get a "Download PDF" button. Approach: `@react-pdf/renderer` (pure JS, no headless browser — Puppeteer/Playwright is too heavy for Vercel serverless) rendering the same section data as the web viewer into a clean branded document; API route `GET /api/reports/[id]/pdf` checks purchase server-side, streams the file. All sections included per the buyer's tier; disclaimer block on every PDF. The print stylesheet stays as a fallback.

### 5.6 "My reports" page
**Model: Haiku** — simple list against existing data.
Dashboard section listing reports with status + unlocked badge + Download PDF link for purchased reports; Stripe's receipt email covers receipts — build nothing custom.

### 5.6b Report updates & paid regeneration (added 2026-07-05, Danny)
**Model: Opus/Fable (flow + diff design) + Sonnet (implementation).**
Users with an existing report can reopen the wizard ("Update details"), change answers, and pay to regenerate:
- **Teaser refresh — indicative US$1** (⚠ pricing flag: Stripe takes ~$0.33 of a $1 charge, and a teaser run costs ~$0.02–0.05 — net ~$0.60. Consider $1.95, or free teaser refresh bundled with any full-report purchase. Decide at 5.1 with the 4B.3 cost data.)
- **Updated full report — US$9.95** (upgrade pricing vs $19.95 new — rewards returning users)

Build requirements:
1. **Reopen flow**: "Update details" action on ready ideas (dashboard + report page) transitions status back to `questioning` with answers editable; the questions page currently hard-redirects `ready` ideas away — that guard becomes tier-aware.
2. **Snapshot before regeneration**: copy the current `sections` to a `previous_sections` column (or a report_versions table) so nothing is lost and diffing is possible.
3. **"What's new" treatment**: the regeneration pipeline receives the previous report content and the changed answers; prompts must NOT re-present unchanged findings as fresh insight. Viewer highlights genuinely new/changed items (badge or a "New since your last report" box per section). This is the diff-design piece for Opus/Fable.
4. Purchases rows carry type: `new_full` | `teaser_refresh` | `full_update`.

### 5.7 Payment-flow tests
**Model: Haiku** — scripted, low-ambiguity.
Test-mode E2E with Stripe test cards: success unlocks, cancel leaves locked, webhook replay stays idempotent, second user cannot access first user's unlocked report.

## Acceptance criteria
- [ ] Full test-mode purchase: pay with `4242…` card → locked sections open without manual refresh weirdness → email arrives with working link.
- [ ] Declined card and abandoned checkout leave the report locked with a clear retry path.
- [ ] Replaying the same webhook event does not create duplicate purchases.
- [ ] Unlock check is server-side (verify: editing client state does not reveal paid sections).
- [ ] Live mode verified with one real self-purchase per tier (then refund via Stripe dashboard).
- [ ] Premium purchase triggers the premium pipeline steps and renders their sections; a $19.95 purchase does not.
- [ ] Purchased report downloads as a clean PDF (all tier sections + disclaimer); non-purchasers get 403 from the PDF route.

## Solo-operator sizing
~1 week part-time, assuming Stripe account activation isn't blocking (hence: start it day 1).

## Compliance note (MVP-level, not Phase 7)
You're selling digital reports, likely from Australia: check GST registration threshold obligations and put your business identity + refund policy on the site (Phase 6 covers the pages; the policy decision is yours). Stripe Checkout keeps you out of PCI scope — do not build custom card forms.
