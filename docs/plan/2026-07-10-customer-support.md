# Customer support feature (2026-07-10)

Danny's ask, surfaced by Stripe signup: customers must be able to reach us about a charge,
and billing mail must never sit unseen (unanswered billing mail becomes chargebacks).

## Phase 1 — buildable now (DELEGATED to Sonnet subagent, this date)

1. Migration 027: add `'billing'` to the contact_submissions category check.
2. Public /contact form: "Billing & refunds" reason option + refund-policy hint linking /terms.
3. /api/contact: accept billing; admin notification subject `[Contact — BILLING]`;
   graceful 400 (not 500) if migration 027 hasn't run (23514 check violation).
4. Admin contact queue: Billing filter chip + red/rose highlighted row treatment (louder
   than partnership — time-sensitive money).

## Phase 2 — build WITH payments (blocked on Stripe integration)

5. **Refund workflow in admin**: on a purchase row (admin user detail page already lists
   purchases), a "Refund" action → Stripe refund API → set purchases.status='refunded' +
   refunded_at (columns already exist). Typed confirm (destructive-ish money action).
   Cross-link: a billing contact submission should link to the submitter's purchases
   (match on user_id/email) so Danny can act without hunting.
6. **Order-confirmation email** (payments build) must carry support contact
   (hello@hadidea.com) + link to /contact — mirrors what Stripe puts on its receipts.
7. **"My purchases" in the account area** (optional, v2): list purchases with a "get help
   with this order" link that pre-fills /contact with category=billing + order reference.

## Notes
- Refund policy is live in /terms §5; the contact form hint links there.
- Stripe-side support email (hello@) and statement descriptor already configured (2026-07-10).
