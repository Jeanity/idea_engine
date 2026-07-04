# Phase 02 — Idea Intake & Classification

## Goal ("done" looks like)
A signed-in user types a raw idea in plain language ("home made pet treats"), plus their location, and the app classifies it into one of a fixed set of idea archetypes, shows the classification for confirmation/override, and persists the idea. This is the top of the funnel — it must feel instant and smart.

## Dependencies
Phase 1 complete (auth, schema, `lib/ai.ts`, deploys).

## Tasks (in order)

### 2.1 Define the archetype taxonomy + classification prompt
**Model: Opus** — prompt/taxonomy design; a bad taxonomy here poisons Phases 3–4.
Fixed archetypes for MVP (from the pitch, trimmed): `physical_product`, `local_service`, `software_app`, `ecommerce_brand`, `content_education`, `marketplace`, `invention`, plus `other` as an explicit fallback so nothing is force-fitted. Design the classification prompt: input = raw idea + location; output = strict JSON `{archetype, confidence, one_line_restatement, detected_signals[]}`. Include 10 worked examples in the prompt (the pet-treats example from the pitch must classify as `physical_product`). Output: `lib/prompts/classify.ts` + `docs/ARCHETYPES.md`.

### 2.2 Intake form UI
**Model: Sonnet** — core UX implementation.
`/app/new`: large free-text idea box, location fields (country + city/region — needed later for local competitor research and compliance links), submit. Optimistic loading state ("Reading your idea…").

### 2.3 Classification API route
**Model: Sonnet** — server logic with error handling.
`POST /api/ideas`: validate input, call classify prompt via `lib/ai.ts`, create `ideas` row with archetype + status `draft`. Handle malformed-JSON retries (one retry, then fall back to `other`).

### 2.4 Confirmation screen
**Model: Sonnet** — small but important product moment.
Show the restated idea + detected archetype ("Sounds like a physical product business — homemade pet treats sold locally. Right?"). User can confirm or pick a different archetype from a dropdown. Confirm advances status to `questioning` and routes to the (Phase 3) wizard — stub the destination for now.

### 2.5 Ideas list on dashboard
**Model: Haiku** — simple CRUD list, no ambiguity.
Dashboard lists the user's ideas with archetype badge + status; clicking resumes at the right step.

### 2.6 Classification test set
**Model: Haiku** — repetitive test authoring against a fixed spec.
Script (`scripts/eval-classify.ts`) that runs 20 canned ideas (given in `docs/ARCHETYPES.md`) through the classifier and prints a pass/fail table against expected archetypes. Target: ≥18/20.

## Acceptance criteria
- [ ] Entering "home made pet treats" + an Australian city classifies as `physical_product` and restates the idea sensibly.
- [ ] User can override the archetype and the override is what's stored.
- [ ] Ideas persist and are listed on the dashboard across sessions; another user cannot see them.
- [ ] Classifier eval script passes ≥18/20.
- [ ] Garbage input ("asdf") gets `other` + a gentle "tell us more" nudge, not a crash.

## Solo-operator sizing
~1 week part-time.
