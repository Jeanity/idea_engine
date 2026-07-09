# Plan — "Essential services" block (affiliate-aware, render-time, on Legal & Compliance)

Date: 2026-07-09. Danny's request, refined. Execute on Sonnet.

## Core principle (binding)
This block is **injected at render time**, never stored in report sections and never
touched by the AI pipeline. Zero AI cost, appears retroactively on every existing
report, links always reflect the current affiliate table.

## Data — migration 016_affiliate_categories.sql
Extend the existing `affiliate_links` table:
```sql
alter table affiliate_links add column category text;
alter table affiliate_links add column country text;  -- 2-letter ISO, null = global
alter table affiliate_links add column note text;     -- e.g. "Best for sole traders and freelancers"
```
No new RLS needed if the table already restricts reads (check) — the user-facing block
reads links through a service-client lib helper that selects ONLY active rows and only
the safe fields (name, slug, category, country, note).

## Category registry — `src/lib/essential-services.ts`
Static, code-defined list (order = display order). Each entry:
`{ id, heading, blurb (one line, plain, factual), searchQuery, extraSearches?: {label, query}[] }`
1. accountants — "Accountants & tax" — search "accountants near me"
2. accounting_software — "Accounting software" — search "small business accounting software"
3. legal — "Legal advice" — search "business lawyers near me"; extraSearches:
   "IP lawyers near me", "trademark lawyers near me"
4. banking — "Business bank accounts" — search "business bank accounts"
5. insurance — "Business insurance" — search "business insurance quotes"
6. registration — "Business registration" — search "how to register a business" (blurb
   notes registration is free or low-cost directly through government in many countries)
7. payments — "Taking payments" — search "card payment reader small business"
8. website — "Website & domain" — search "small business website builder"
9. branding — "Logo & branding" — search "logo design service"
10. promotional_material — "Promotional material" — search "business cards and flyers printing"
11. government_advisory — "Free government support" — search "free small business advice government"
Search links: `https://www.google.com/search?q=<encoded>` in a new tab.

## Link resolution — `src/lib/essential-services.ts` helper
`resolveEssentialServices(service, countryCode)`:
- Fetch active affiliate_links where category is not null.
- Per category: prefer an affiliate with `country = countryCode`, else `country is null`
  (global), else fall back to the Google search link. Affiliate links go through the
  existing `/go/[slug]` redirect so admin click-tracking keeps working.
- Returns the ordered category list with, per category: either
  `{ kind: 'affiliate', name, href: '/go/<slug>', note }` or `{ kind: 'search', ... }`,
  plus extraSearches always rendered as small secondary links where defined.
- Must degrade gracefully: any query error (incl. missing columns pre-migration —
  42703/PGRST204) → all categories fall back to search links. The block NEVER crashes
  a report.

## Web rendering
- Bottom of the **Legal & Compliance tab** in the report view (report-client.tsx), as a
  titled block: heading "Your support team", one-line intro ("Every business ends up
  needing most of these — a head start on where to look."), then the categories as a
  compact 2-column grid (1-col mobile): heading, blurb, primary link (affiliate name or
  "Search: accountants near me"), optional note in small text, extra search links inline.
- **Mandatory disclosure line** at the bottom of the block, small + quiet:
  "Some links may earn Idea Engine a commission. This never changes what you pay, and
  never changes what we recommend."
- Affiliate links visually distinguishable only by carrying the provider's name (e.g.
  "Hnry — online accountant"); external-link icon per the existing convention; all links
  `target="_blank" rel="noopener noreferrer"` (the /go route handles the affiliate hop).
- Data is fetched in the report page's SERVER component (report-page-content.tsx) using
  the resolver above with the idea's `location_country`, passed down as a prop — the
  sample-report public page must NOT include the block.
- Shows on both initial-report and full-report views if the compliance tab exists on
  both — anchor it to wherever legal/compliance content renders; if the initial report
  has no compliance tab, full report only. Voice: never "teaser".

## PDF
- Same block as a section at the end of the compliance page in `ReportDocument`
  (src/lib/pdf/), including the disclosure line. Resolve links in the PDF route before
  rendering. Affiliate hrefs must be ABSOLUTE (`<origin>/go/<slug>`) — find how the app
  derives its public origin (env var / request origin in the PDF route) and reuse;
  fall back to request origin. Remember react-pdf gotchas documented in HANDOFF
  (no style cascade into nested Text, use the existing LinkIcon/ExternalLink helpers).

## Admin
- `/app/admin/affiliates` create/edit forms gain: category (select from the registry
  list + "None (content link)" for existing rewrite-style links), country (the COUNTRIES
  list from src/lib/countries.ts, blank = global), note (short text). List view shows
  category + country chips.
- Update the admin affiliates API route to accept/validate the new fields (category must
  be a known registry id or null; country 2-letter or null; note ≤ 120 chars).

## Also check
`src/lib/affiliate-rewrite.ts` exists (URL-rewriting machinery) — read it first; reuse
anything sensible (e.g. how /go/ URLs are built) and make sure nothing there assumes
category/country are absent. Do not break its tests.

## Verification (all must pass, in E:\idea-engine)
```
npx tsc --noEmit
npx next build
npx vitest run
```
Unit-test `resolveEssentialServices`'s selection logic (country-specific beats global
beats search; error fallback) with a mocked fetch function — structure the resolver so
the selection is a pure function over fetched rows.

## Commit
ONE commit on main:
`feat(report): essential-services block on compliance — affiliate-aware with search fallbacks`
ending with `Co-Authored-By: Claude <noreply@anthropic.com>`. DO NOT push.

## Out of scope
Per-country search-engine variation · gov-link directories per country · storing the
block in sections · sample-report page inclusion.
