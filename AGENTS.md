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

# Delegation workflow (tiered — Danny, 2026-07-10)

Fable orchestrates; agent definitions live in `.claude/agents/`.

- **Sonnet tier** — `researcher` (read-only fact-finding) and `implementer` (one
  well-specced, self-contained build per run, verified + committed in its worktree,
  never pushed). Low-level tasks and research go here by default.
- **Opus tier** — `reviewer`: first-pass review of implementer diffs (APPROVE/REJECT
  with specifics), synthesis of research into build-ready specs, and judgment tasks
  that don't need Fable.
- **Fable tier** — final say on everything: architecture, fluid/ambiguous specs,
  security-sensitive changes, final review of every diff, merge and push to main.

Anti-fan-out rules:
- At most 1–2 agents in flight at once, and only for genuinely independent tasks.
- One agent = one tight task with only the context it needs. No open-ended mandates.
- Agents never spawn agents. Prefer the sequential pipeline
  (research → spec → implement → review → finalize) over parallel swarms.
- Trivial changes (a default, copy, one-liner) skip the pipeline — Fable does them
  directly; spinning up an agent costs more than the task.
