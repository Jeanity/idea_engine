# Local Dev Mode — AI Provider Switch (anthropic | ollama | mock)

Added 2026-07-05 (Danny's request, scoped per Fable's assessment). Goal: tweak and test the app without spending API money, then flip one env var back for production.

## Decision & scope
- **`AI_PROVIDER=anthropic`** (default; unset = anthropic) — production path, exactly today's behavior. Vercel never sets the var, so prod cannot accidentally run local mode.
- **`AI_PROVIDER=mock`** — every `callAI` returns a canned fixture keyed by the call's `tag`, captured from real production outputs. Free, instant, offline. For UI/pipeline/flow work.
- **`AI_PROVIDER=ollama`** — non-search calls go to a local Ollama server (`OLLAMA_BASE_URL`, default http://localhost:11434; `OLLAMA_MODEL`, default `qwen2.5:14b-instruct`). Calls that request web-search tools CANNOT run locally → they return the mock fixture instead, with a console warning.
- **Not in scope (deliberately):** local web search, prompt-quality tuning against local models (small-model output is not evidence about Sonnet's output), any prod use of non-Anthropic providers.

## Why not full Ollama parity
Competitors/compliance/financing depend on Anthropic's server-side web search — no local equivalent without building a second search stack that behaves differently. And prompt-quality conclusions drawn from 7–14B local models don't transfer to Sonnet. Local mode is for *plumbing and UI*, Anthropic mode is for *quality judgment* (the 4B.3 matrix stays on Anthropic).

## Tasks
1. **Fixture capture script** (`scripts/capture-fixtures.ts`) — Sonnet. Pulls the latest complete report + its idea from Supabase and writes one JSON fixture per tag into `src/lib/fixtures/` (`report-competitors.json`, `report-compliance.json`, `report-costs.json`, `report-synthesis.json`, `report-financing.json`, plus `classify.json`, `dynamic-questions.json`, `teaser.json` with hand-rolled realistic samples if no capture source exists). Fixture = the raw text `callAI` would have returned (JSON string), so the normal parse path still runs.
2. **Provider routing in `lib/ai.ts`** — Sonnet. `callAI` branches on `AI_PROVIDER`; mock loads fixture by tag (throws a clear error naming the missing file if absent); ollama POSTs to `/api/chat` (stream false, `format: 'json'` when the prompt demands JSON output — i.e. always for report calls), maps to the same `AIResult` shape with `costUsd: 0`; the `ai_call` log line gains a `provider` field. Tools requested + provider=ollama → mock fallback + `console.warn`.
3. **Env plumbing** — `.env.example` gains the three vars with comments; README gets a short "Local dev mode" section.
4. **Verification** — tsc + build; `AI_PROVIDER=mock npx tsx` smoke script proving a mock callAI round-trip parses.

## Acceptance
- [ ] `AI_PROVIDER=mock npm run dev` → full report flow works offline, $0, all sections render from fixtures
- [ ] `AI_PROVIDER=ollama` with Ollama running → classify/questions/costs/synthesis generate locally; search steps visibly fall back to fixtures
- [ ] Unset var (prod) → behavior byte-identical to today; `provider:"anthropic"` in logs
- [ ] No fixture or provider code path can run in a Vercel deploy unless someone deliberately sets the env var there
