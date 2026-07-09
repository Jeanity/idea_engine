# Plan — "Getting set up" report tab (expands + relocates the essential-services block)

Date: 2026-07-09. Danny approved all five design points. Execute on Sonnet.
Builds directly on `741b03c` (essential-services block) — same render-time, zero-AI-cost,
retroactive architecture. NO new migration (affiliate_links already has category/country/note;
the registry is code).

## What changes

### 1. New report tab: "Getting set up"
- Add a tab to the full report view (report-client.tsx) positioned immediately AFTER the
  Legal & Compliance tab (before/next to "Getting the Word Out" marketing tab).
- MOVE the existing `EssentialServicesBlock` out of the compliance panel into this tab —
  compliance goes back to purely legal content. No duplication.
- Tab intro line: one sentence, roadmap framing ("The practical pieces every business needs —
  in roughly the order you'll need them.").
- PDF: same move — the block leaves the compliance page and becomes its own "Getting set up"
  page/section in ReportDocument (respect existing react-pdf gotchas from HANDOFF).
- The teaser/initial-report view is unchanged (no compliance tab there today; do not add).

### 2. Grouped registry
Extend `src/lib/essential-services.ts` with a `group` field per category and a group registry
(order = display order):
- **Get set up**: registration, banking, accountants, accounting_software
- **Get protected**: insurance, legal (keeps IP/trademark extraSearches)
- **Get online**: domain, website_diy, website_hire, app_development, socials (special — see #4)
- **Get customers**: branding, promotional_material, payments
- **Free support**: government_advisory
New/changed categories:
- `domain` — "Domain name" — search "domain name registration"
- `website_diy` — "Website — build it yourself" — search "small business website builder"
- `website_hire` — "Website — hire a designer" — search "web designers near me"
- `app_development` — "App development" — search "app development services"
- The old single `website` category id is REPLACED by website_diy/website_hire. If any
  affiliate row already uses category='website' keep accepting it (map it to website_diy)
  so nothing breaks — note this in code.
Render: group heading (SectionLabel-style), categories as the existing compact cards
within each group. 2-col grid desktop, 1-col mobile, both themes.

### 3. Archetype-aware relevance
- Registry entries gain optional `archetypes?: string[]` (when present, the category only
  renders for reports whose idea archetype is in the list; absent = always shown).
- Initial tuning (conservative — hide only clear noise):
  - app_development: software_app, marketplace, invention only
  - payments: local_service, physical_product, ecommerce_brand, marketplace only
  - promotional_material: hide for software_app and content_education
  - Everything else: always shown.
- The resolver already receives the idea — thread `archetype` through
  `resolveEssentialServices`/`selectEssentialServices` (pure function → extend its unit
  tests: filtered category hidden for wrong archetype, shown for matching, always-on ones
  unaffected).

### 4. "Set up your socials" card
- One special card in **Get online** (not a search/affiliate category): five official
  business-signup links, hardcoded (platform top-level pages — allowed under the
  no-fabricated-URLs rule):
  - Facebook — https://www.facebook.com/business
  - Instagram — https://business.instagram.com
  - LinkedIn — https://www.linkedin.com/company/setup/new/
  - TikTok — https://www.tiktok.com/business
  - X — https://business.x.com
- Tip line on the card: "Secure the same handle on every platform early — even the ones
  you won't use yet."
- All target=_blank rel=noopener noreferrer, external-link icon convention.
- PDF: render the same five links + tip.

### 5. Disclosure + admin
- The affiliate-disclosure line renders ONCE at the bottom of the tab (moves with the block).
- Admin affiliates category select: options come from the registry — verify it picks up the
  new/renamed categories automatically; if the select hardcodes ids, fix it to import from
  the registry. Grouped optgroups in the select are a nice-to-have, not required.

## Verification (all must pass, in E:\idea-engine)
```
npx tsc --noEmit
npx next build
npx vitest run
```
Extend the essential-services tests (grouping intact, archetype filtering, website legacy
mapping). Existing tests must keep passing.

## Commit
ONE commit on main:
`feat(report): "Getting set up" tab — grouped, archetype-aware essential services + socials`
ending with `Co-Authored-By: Claude <noreply@anthropic.com>`. DO NOT push.

## Out of scope
New affiliate integrations · per-country social links · initial-report tab changes ·
new migrations.
