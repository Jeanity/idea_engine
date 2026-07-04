# ARCHETYPES — Universal Idea Production Engine

> Status: Committed. The eight archetype values are frozen in the DB schema (`ideas.archetype` check constraint in `docs/DATA_MODEL.md` §2.2). Do not add, remove, or rename. This document is the source of truth for what each value means, how the classifier decides between them, and how we evaluate classifier quality.

---

## 1. Archetype definitions

Each archetype has: a two-sentence definition, three example ideas, and the "tells" the classifier looks for. Tells are heuristic — one strong tell can outweigh several weak ones from another archetype.

### 1.1 `physical_product`

**Definition.** A business built around making a tangible item and selling it — food, crafts, packaged consumables, manufactured goods. The operator is (usually) the maker, and distribution runs through markets, wholesale, direct-to-customer local channels, or a mix that includes physical touchpoints.

**Example ideas.**
- Homemade dog treats sold at Brisbane weekend markets.
- Small-batch hot sauce jarred in a home kitchen and wholesaled to specialty grocers.
- Handmade leather wallets stitched to order and sold at craft fairs plus a small Etsy store.

**Tells.**
- Words: "homemade", "handmade", "small-batch", "baked", "brewed", "at a market", "wholesale to shops".
- A tangible noun the operator personally produces.
- Distribution mentions markets, pop-ups, wholesale, or a mix of local + online.
- The operator's cost equation includes ingredients, packaging, labour, and often kitchen/space overhead.

---

### 1.2 `local_service`

**Definition.** A service the operator delivers in person or within a specific geographic area. The operator's time and location (or their crew's time and location) is the deliverable.

**Example ideas.**
- Residential lawn mowing across Manchester on a recurring weekly schedule.
- Mobile car detailing that visits customer driveways in the Denver metro area.
- After-school maths tutoring for high school students, in-home in North Sydney.

**Tells.**
- Words: "in <city>", "mobile", "on-site", "at customers' homes", "in-person", "residential", "commercial".
- A service verb ("mow", "clean", "tutor", "detail", "install") plus geography.
- Even if the idea mentions a booking app, the underlying deliverable is a person showing up.
- The cost equation is dominated by labour hours and travel/vehicle time.

---

### 1.3 `software_app`

**Definition.** A software product the customer uses — web, mobile, or desktop — including SaaS, single-purpose tools, and internal-workflow apps sold as software. The deliverable is code.

**Example ideas.**
- A web app for freelancers to track billable hours and generate client invoices.
- A mobile app that helps runners plan and log training weeks.
- A desktop tool for indie authors to manage manuscripts, revisions, and beta reader feedback.

**Tells.**
- Words: "app", "web app", "mobile app", "SaaS", "dashboard", "tool for", "platform for X to do Y" (single-sided workflow, not two-sided marketplace).
- The end user interacts primarily through a screen; no physical good ships and no operator delivers a service in person.
- Revenue model is usually subscription, per-seat, or one-time license.

---

### 1.4 `ecommerce_brand`

**Definition.** An online-only product brand where the operator sources, curates, or designs but does not personally manufacture at scale, and delivery is by post/courier — not in-person. Dropship, print-on-demand, white-label, DTC subscription boxes all live here.

**Example ideas.**
- Custom-designed phone cases sold through Shopify with print-on-demand fulfillment.
- A DTC skincare brand contract-manufactured overseas and shipped from a 3PL.
- A monthly subscription box of small-batch hot sauces curated from independent makers.

**Tells.**
- Words: "online store", "Shopify", "dropship", "print on demand", "white label", "DTC", "subscription box".
- No signal that the operator personally manufactures (contrast with `physical_product`).
- No signal that the operator delivers anything in person (contrast with `local_service`).
- Distribution is postal/courier, nationally or globally.

---

### 1.5 `content_education`

**Definition.** A business whose product is content, audience attention, or teaching — YouTube channels, newsletters, podcasts, online courses, coaching programs, paid communities. Revenue comes from ads, sponsorships, subscriptions, course sales, coaching fees, or a mix.

**Example ideas.**
- A YouTube cooking channel focused on 15-minute weeknight dinners.
- A paid weekly newsletter analyzing indie SaaS launches.
- An online course teaching product managers how to run better roadmap reviews.

**Tells.**
- Words: "YouTube", "newsletter", "podcast", "course", "coaching", "community", "teach", "audience".
- The deliverable is not a physical good, not software the user operates as a tool, and not an in-person service.
- Even ambiguous "coaching" ideas often land here in a modern-online context — see §2 for the disambiguation rule.

---

### 1.6 `marketplace`

**Definition.** A platform whose value comes from connecting two or more distinct sides — buyers and sellers, hosts and guests, freelancers and clients, walkers and owners. The operator brokers; they do not personally deliver the underlying service or produce the underlying good.

**Example ideas.**
- A platform connecting dog owners with local dog walkers for on-demand walks.
- A marketplace matching independent film composers with indie game studios.
- A regional site connecting small farms with restaurant chefs who buy produce weekly.

**Tells.**
- Words: "platform for X and Y", "connects X with Y", "matches", "two-sided", "Uber for", "Airbnb for".
- Two clearly distinct user groups with different needs and different sign-up flows.
- The operator's role is trust, matching, and payments — not delivery.

---

### 1.7 `invention`

**Definition.** A novel, potentially patentable device, process, or technology that is not yet a shipping product or established service. The idea's core claim is that the mechanism or approach is new.

**Example ideas.**
- A self-cleaning litter box with a patented rotating drum mechanism.
- A new textile treatment process that makes cotton naturally water-repellent without PFAS.
- A hardware sensor that detects early-stage electrical faults inside residential wiring.

**Tells.**
- Words: "patented", "novel", "new mechanism", "prototype", "I invented", "haven't seen anything like it".
- The operator describes the *thing* by its novelty, not by a distribution plan.
- If the same idea is already an existing product category with no novelty claim, prefer `physical_product` or `software_app`.

---

### 1.8 `other`

**Definition.** Explicit fallback for inputs that do not describe a business idea at all (empty, nonsense, off-topic) or that describe something so unusual none of the seven real archetypes fit. Not a catch-all for classifier uncertainty.

**Example ideas.**
- "asdf" or an empty string.
- "my cat is really cute today".
- A one-of-a-kind personal project the operator explicitly says they never plan to monetize.

**Tells.**
- Input reads as nonsense, spam, or off-topic chatter.
- Input is too vague to place anywhere (`"a business"`, `"make money"`).
- No archetype's tells apply, even weakly.

**Confidence rule.** `other` should carry confidence <= 0.30. If confidence would be higher than that, the idea probably fits a real archetype and you should pick it.

---

## 2. Classification rules (decision guide)

Apply these in order. The first rule that fires wins. This is the same order the classifier prompt uses so behavior stays consistent between the prompt and human review.

1. **Nonsense / non-idea input → `other`.**
   Empty, "asdf", off-topic, or too vague to say anything about. Confidence <= 0.30.

2. **Explicit novelty / patent language → `invention`.**
   "Patented", "novel mechanism", "I invented", "prototype of a new kind of…". If the same idea is a normal existing product category without novelty language, skip this rule.

3. **Two distinct user sides being connected → `marketplace`.**
   "Platform connecting X with Y". Both sides are separately targeted users. The operator does not perform the underlying transaction. Uber, Airbnb, TaskRabbit patterns.

4. **Software is the deliverable → `software_app`.**
   The end user interacts with code the operator built. Not just "we'll have an app for booking" — the app itself must be the product.

5. **Content, teaching, coaching, audience → `content_education`.**
   Deliverable is a channel, publication, course, community, or coaching program.

6. **Service delivered in person or in a geographic area → `local_service`.**
   Even if there is also a booking app or a website — the core product is the operator showing up. Lawn mowing "with an app" is still `local_service`.

7. **Tangible good the operator personally makes → `physical_product`.**
   Homemade, handmade, small-batch, brewed, baked. Distribution can be local, online, or both — the *making* is the tell.

8. **Tangible good sold online with no manufacturing and no local delivery → `ecommerce_brand`.**
   Dropship, print-on-demand, white-label, DTC subscription. Operator curates or designs; someone else makes; couriers ship.

9. **Nothing above cleanly applies → `other`.**
   With honest confidence.

### 2.1 Common ambiguity pairs

| Situation | Rule |
|---|---|
| Physical product sold online only, operator does not manufacture. | `ecommerce_brand`, not `physical_product`. |
| Physical product the operator makes, sold online only. | `physical_product`. The making is the identity. |
| Service delivered in person, booked through an app the operator built. | `local_service`, not `software_app`. The app is a channel; the service is the product. |
| App for freelancers to manage their own work (single-sided workflow). | `software_app`, not `marketplace`. No second side. |
| Paid coaching program delivered 1:1 online. | `content_education`. |
| Paid coaching program delivered 1:1 in person at a local gym only. | `local_service`. If mixed, prefer `content_education` (modern default). |
| YouTube channel that also sells merch. | `content_education`. Primary revenue driver is the audience. |
| A novel device the operator plans to manufacture at scale. | `invention` if the novelty is the pitch; `physical_product` if the pitch is the manufacture-and-sell plan. |
| A subscription newsletter that costs money. | `content_education`. |
| An internal tool the operator sells to businesses as SaaS. | `software_app`. |
| A directory site listing local businesses (no transactions). | `other` for MVP — directories are not truly marketplaces (no two active sides transacting) and not obviously any other archetype. Confidence around 0.35. |

### 2.2 Confidence

- 0.90–1.00: unambiguous. Multiple strong tells; no meaningful competing archetype.
- 0.70–0.89: clear best fit; a competing archetype is plausible but weaker.
- 0.60–0.69: real ambiguity but a best fit exists; commit.
- 0.30–0.59: weak signal; commit to the least-bad real archetype rather than falling to `other`.
- 0.00–0.29: reserved for `other` on nonsense/empty/off-topic.

The classifier is instructed to always commit to its best guess (not stall in `other`) whenever any real archetype fits even weakly.

### 2.3 Location's role

Location is passed to the classifier but rarely changes the archetype. It matters mainly for:

- Disambiguating `local_service` — an explicit city/region reinforces the archetype.
- Distinguishing `physical_product` (local channels) from `ecommerce_brand` (national/global online only) when the wording is otherwise ambiguous.

Location never triggers `other` on its own.

---

## 3. Eval test set

The following block is the exact test set consumed by `scripts/eval-classify.ts` (Phase 2.6). It exercises clear cases, ambiguous cases, and the `other` fallback. The pet-treats example is included as required.

Format: JSON array of objects, importable directly (`import evalCases from '../docs/ARCHETYPES.md'` will not work — the eval script parses the fenced JSON block below, or reads a mirrored `docs/archetype-eval.json` if we later split it out).

```json
[
  {
    "id": "eval-01-pet-treats",
    "idea": "home made pet treats",
    "location": "Brisbane, Australia",
    "expected_archetype": "physical_product",
    "reasoning": "Operator personally makes a tangible consumable; canonical maker-at-markets pattern with a clear location."
  },
  {
    "id": "eval-02-lawn-mowing",
    "idea": "I want to start a lawn mowing business for residential customers",
    "location": "Manchester, UK",
    "expected_archetype": "local_service",
    "reasoning": "In-person service bounded to a city; operator's labour is the product."
  },
  {
    "id": "eval-03-freelancer-saas",
    "idea": "a web app for freelancers to track billable hours and generate invoices",
    "location": "Berlin, Germany",
    "expected_archetype": "software_app",
    "reasoning": "Deliverable is software the user operates; single-sided workflow, not a marketplace."
  },
  {
    "id": "eval-04-print-on-demand-cases",
    "idea": "selling custom phone cases online through Shopify with print on demand",
    "location": "Austin, Texas, USA",
    "expected_archetype": "ecommerce_brand",
    "reasoning": "Online-only, no in-house manufacturing (POD), no local delivery — textbook ecommerce brand."
  },
  {
    "id": "eval-05-youtube-cooking",
    "idea": "a YouTube cooking channel focused on 15-minute weeknight dinners",
    "location": "Toronto, Canada",
    "expected_archetype": "content_education",
    "reasoning": "Audience-first video content; monetized via ads and sponsorships."
  },
  {
    "id": "eval-06-dog-walker-marketplace",
    "idea": "a platform connecting dog owners with local dog walkers in their neighborhood",
    "location": "Chicago, Illinois, USA",
    "expected_archetype": "marketplace",
    "reasoning": "Two distinct user sides being connected; operator brokers, does not walk dogs."
  },
  {
    "id": "eval-07-patent-litter-box",
    "idea": "a self-cleaning litter box with a patented rotating drum mechanism I designed",
    "location": "Osaka, Japan",
    "expected_archetype": "invention",
    "reasoning": "Explicit patent + novel mechanism language; not yet a shipping product."
  },
  {
    "id": "eval-08-nonsense",
    "idea": "asdf",
    "location": "Sydney, Australia",
    "expected_archetype": "other",
    "reasoning": "Nonsense input; confidence must be <= 0.30."
  },
  {
    "id": "eval-09-hot-sauce-subscription",
    "idea": "a subscription box of small-batch hot sauces from independent makers, mailed monthly",
    "location": "Portland, Oregon, USA",
    "expected_archetype": "ecommerce_brand",
    "reasoning": "Operator curates rather than manufactures; national mail delivery; DTC subscription pattern."
  },
  {
    "id": "eval-10-craft-brewery-local",
    "idea": "a craft brewery selling my own beer at the local taproom and to nearby bottle shops",
    "location": "Portland, Maine, USA",
    "expected_archetype": "physical_product",
    "reasoning": "Operator brews the product; distribution is a mix of taproom and local wholesale."
  },
  {
    "id": "eval-11-mobile-detailing",
    "idea": "a mobile car detailing service that visits customers at their homes on weekends",
    "location": "Denver, Colorado, USA",
    "expected_archetype": "local_service",
    "reasoning": "Explicit mobile in-person service; operator's time and vehicle is the product."
  },
  {
    "id": "eval-12-newsletter-paid",
    "idea": "a paid weekly newsletter analyzing indie SaaS launches and revenue milestones",
    "location": "Lisbon, Portugal",
    "expected_archetype": "content_education",
    "reasoning": "Subscription content business; audience-first monetization."
  },
  {
    "id": "eval-13-fitness-coaching-ambiguous",
    "idea": "fitness coaching",
    "location": "Denver, Colorado, USA",
    "expected_archetype": "content_education",
    "reasoning": "Ambiguous between local PT and online coaching; modern default lands in content_education. Local_service is acceptable if the eval scorer treats it as a soft match; confidence should reflect the ambiguity."
  },
  {
    "id": "eval-14-freelance-marketplace",
    "idea": "a marketplace matching indie film composers with small game studios that need original scores",
    "location": "Los Angeles, California, USA",
    "expected_archetype": "marketplace",
    "reasoning": "Two clearly distinct sides — composers and studios — with the operator brokering."
  },
  {
    "id": "eval-15-shopify-jewellery-handmade",
    "idea": "handmade sterling silver jewellery I forge in my home studio and sell on Etsy and Instagram",
    "location": "Auckland, New Zealand",
    "expected_archetype": "physical_product",
    "reasoning": "Even though sales are online (Etsy/IG), the operator personally makes the product — physical_product, not ecommerce_brand."
  },
  {
    "id": "eval-16-tutoring-in-person",
    "idea": "after-school maths tutoring for year 10 and 11 students, at their homes",
    "location": "North Sydney, Australia",
    "expected_archetype": "local_service",
    "reasoning": "In-person tutoring in a bounded geography; operator's time is the product. Content_education would be wrong because delivery is in-person and location-bound."
  },
  {
    "id": "eval-17-desktop-writer-tool",
    "idea": "a desktop app for indie novelists to manage manuscripts, revisions, and beta reader feedback",
    "location": "Edinburgh, UK",
    "expected_archetype": "software_app",
    "reasoning": "Software product with a single-sided workflow; no marketplace second side."
  },
  {
    "id": "eval-18-new-textile-process",
    "idea": "a new textile treatment process that makes cotton naturally water-repellent without PFAS chemicals",
    "location": "MilanItaly",
    "expected_archetype": "invention",
    "reasoning": "Novel process, no established product category; falls under invention despite typo in location."
  },
  {
    "id": "eval-19-off-topic",
    "idea": "my cat is really cute today and I love her",
    "location": "Melbourne, Australia",
    "expected_archetype": "other",
    "reasoning": "Not a business idea; classifier should fall to other with low confidence."
  },
  {
    "id": "eval-20-ambiguous-app-service",
    "idea": "an app that lets people book house cleaners in their city — I want to run the cleaning crews too",
    "location": "Vancouver, Canada",
    "expected_archetype": "local_service",
    "reasoning": "Operator runs the cleaning crews themselves; the app is a booking channel. Core product is the in-person service. Not marketplace (no independent second side of cleaners) and not software_app (app is not the deliverable)."
  }
]
```

**Scoring notes for `scripts/eval-classify.ts`.**

- Exact-match on `expected_archetype` is the primary metric.
- For `eval-13-fitness-coaching-ambiguous`, `local_service` may be treated as a soft-pass if the scorer supports partial credit; the prompt is instructed to commit to `content_education` as the modern default but either is defensible.
- `eval-08-nonsense` and `eval-19-off-topic` must additionally have `confidence <= 0.30`; a correct archetype with too-high confidence should count as a partial failure so we catch overconfident `other` predictions.
- No test case should trigger `other` for a real business idea. If a real idea maps to `other` in production output, that is a bug in the classifier, not the taxonomy.

---

*End of ARCHETYPES.md — this document plus `src/lib/prompts/classify.ts` are the classification contract. Changing the taxonomy requires changing both plus the `ideas.archetype` DB check constraint.*
