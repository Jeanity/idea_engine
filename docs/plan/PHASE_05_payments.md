# Phase 05 — Payments & Unlock

## Goal ("done" looks like)
One paid tier. A user with a generated report hits "Unlock full report", pays via Stripe Checkout, and the locked sections open immediately; they also get the report link by email. You can take real money.

## Dependencies
Phase 4 complete (reports with preview/locked sections). Requires a Stripe account (business details, bank account) — **start the Stripe account setup at the beginning of this phase; activation review can take days.**

## Tasks (in order)

### 5.1 Pricing decision + Stripe setup
**Model: Sonnet** — operational config with a recommendation, not architecture.
Single tier at **A$19** per full report (between the pitch's $9.95 and $49.95 tiers; one price = one decision for the buyer and one code path for you — add tiers post-launch only if data demands it). Create the Stripe product/price in test mode. Document in `docs/PRICING.md` including the per-report LLM cost from Phase 4.9 to confirm margin.

### 5.2 Checkout integration
**Model: Sonnet** — well-documented integration, needs correctness care.
"Unlock full report" → `POST /api/checkout` creates a Stripe Checkout Session (report_id in metadata) → redirect to Stripe-hosted page (no custom card UI, no PCI scope) → success/cancel URLs back to the report.

### 5.3 Webhook + unlock logic
**Model: Sonnet** — the correctness-critical piece.
`/api/webhooks/stripe` verifies signature, on `checkout.session.completed` creates the `purchases` row. Report viewer renders full sections iff a completed purchase exists (server-side check — never trust the client). Handle: duplicate webhook delivery (idempotent), user paying twice (block with "already unlocked"), webhook arriving before redirect (success page polls briefly).

### 5.4 Email delivery
**Model: Sonnet** — small integration.
Resend (free tier): on purchase, email "Your report is ready" with a link to the report (behind auth — no public URLs in MVP). Plain, deliverable HTML.

### 5.5 "My reports" page
**Model: Haiku** — simple list against existing data.
Dashboard section listing reports with status + unlocked badge; Stripe's receipt email covers receipts — build nothing custom.

### 5.6 Payment-flow tests
**Model: Haiku** — scripted, low-ambiguity.
Test-mode E2E with Stripe test cards: success unlocks, cancel leaves locked, webhook replay stays idempotent, second user cannot access first user's unlocked report.

## Acceptance criteria
- [ ] Full test-mode purchase: pay with `4242…` card → locked sections open without manual refresh weirdness → email arrives with working link.
- [ ] Declined card and abandoned checkout leave the report locked with a clear retry path.
- [ ] Replaying the same webhook event does not create duplicate purchases.
- [ ] Unlock check is server-side (verify: editing client state does not reveal paid sections).
- [ ] Live mode verified with one real A$19 self-purchase (then refund it via Stripe dashboard).

## Solo-operator sizing
~1 week part-time, assuming Stripe account activation isn't blocking (hence: start it day 1).

## Compliance note (MVP-level, not Phase 7)
You're selling digital reports, likely from Australia: check GST registration threshold obligations and put your business identity + refund policy on the site (Phase 6 covers the pages; the policy decision is yours). Stripe Checkout keeps you out of PCI scope — do not build custom card forms.
