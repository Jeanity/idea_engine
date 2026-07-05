# Universal Idea Production Engine

Turns a raw business idea into a researched, costed, paid opportunity report.

See [docs/plan/INDEX.md](docs/plan/INDEX.md) for the full phased build plan, [docs/DATA_MODEL.md](docs/DATA_MODEL.md) for the schema, and [docs/ARCHETYPES.md](docs/ARCHETYPES.md) / [docs/QUESTIONS.md](docs/QUESTIONS.md) for the idea-classification and question-wizard design.

## Local development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and fill in real Supabase/Anthropic keys — `.env.local` is gitignored and never committed.

## Local dev mode

Set `AI_PROVIDER` in `.env.local` to tweak/test without spending API money:
- `anthropic` (default when unset) — real Claude calls, production behaviour. Production (Vercel) never sets this var, so it always runs this path.
- `mock` — every `callAI` call returns a canned fixture from `src/lib/fixtures/` keyed by tag. Free, instant, fully offline. Regenerate fixtures with `npx tsx scripts/capture-fixtures.ts`.
- `ollama` — routes non-search calls to a local Ollama server (`OLLAMA_BASE_URL`, `OLLAMA_MODEL`). Calls needing web search (competitors/compliance/financing) can't run locally and fall back to the mock fixture instead.

Report generation runs through Inngest. Locally that needs `INNGEST_DEV=1` in `.env.local` **and** the Inngest dev server running alongside `npm run dev`:

```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

Without it, starting a report fails with a 500 (events have nowhere to go). Production uses Inngest cloud and needs neither.

## Repo visibility

This repo is **public** on the Vercel Hobby plan: the private-repo tier blocks deployments when the committing GitHub account isn't the exact account connected to the Vercel project, and no repo secrets are stored in git (see `.gitignore`), so public is the zero-cost fix.
