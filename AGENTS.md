<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Model economy rule

Use the **cheapest capable model** for any task, app-side and dev-side, unless the task
genuinely requires more:

- App AI calls go through `callAI` (src/lib/ai.ts). Teasers, fallbacks, and admin summaries
  run on Haiku; report generation uses hybrid per-step routing (Haiku for search/extract
  steps, Sonnet for judgment steps). Any NEW AI feature defaults to Haiku first and only
  moves up on demonstrated quality need.
- Dev workflow: delegate well-specced, self-contained implementation tasks to cheaper
  subagents (plan-file → Sonnet/Haiku subagent → senior-model review). Reserve the premium
  model for architecture, fluid specs, security-sensitive changes, and review.
