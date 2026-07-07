# Plan B — "change your answers now" nudge before first generation

## Goal
On the review screen (`/app/ideas/[id]/summary`), before a report has ever been
generated, make it explicit that NOW is the free moment to change answers — once a
report is generated, regenerating with edited answers is a new charge.

## Files
- `src/app/app/ideas/[id]/summary/page.tsx`

## Context
The page already branches on `idea.status`:
- `researching` / `ready` → report exists (or is being made): shows "View report →"
  and "Click any answer to edit it".
- otherwise (`questioning`) → pre-generation: shows "← Edit answers" + "Generate report →".

## Steps
In the **pre-generation branch only** (the branch that renders "Generate report →"),
insert a call-out card between the answers list and the action row:

- Card styled like the existing cards (`rounded-2xl border border-white/10
  bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm`) but with an
  indigo accent (e.g. `border-indigo-400/30 bg-indigo-500/10` on dark, matching
  light-mode variants) so it reads as a helpful nudge, not an error.
- Copy (title + body):
  - **"Thought of something else? Change your answers now — it's free."**
  - "Your report is built entirely from these answers. Click any answer above to
    change it, or add detail you thought of while answering. After your report is
    generated, editing answers and regenerating counts as a new report."
- Keep the existing "← Edit answers" link and "Generate report →" button as they are.
- Note: in this branch the per-answer cards already link to
  `/questions?edit=<key>`, so "click any answer above" is accurate.

## Verify
- `npm run lint`, `npx tsc --noEmit`, `npm run build` pass.
- The card must NOT appear when `idea.status` is `researching`/`ready`.
