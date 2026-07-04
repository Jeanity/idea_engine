# Future Features — Post-Launch Product Enhancements

Product improvements that are deliberately deferred until after launch. These are not legally risky (unlike Phase 7) — they are cut for speed and focus. Re-open when there is paying-user signal to prioritise them.

---

## 1. Editable ideas + re-run reports

**User problem:** After receiving a report, the user may have:
- Additional context they didn't include in the original idea entry (e.g. a partner joining, a new location, a larger budget)
- Completed some of the action-plan steps and want a refreshed report that reflects their progress
- Changed direction slightly (e.g. pivoting from physical retail to online-only)

**What to build:**
- An "Edit idea" screen (accessible from the account page and the report page) that lets the user update key fields:
  - The original idea description (or a "new information" addendum field so the original is preserved)
  - Wizard answers — re-open the wizard pre-filled with existing answers so the user can change specific ones without re-answering everything
  - Progress notes: a free-text field per next-step in the report where the user can mark steps done/in-progress/blocked
- After editing, offer to purchase a new report (at the standard price) that incorporates the updated inputs
- The old report is preserved (version history); only the latest is shown by default

**Data considerations:**
- The current `unique (idea_id)` on reports will need relaxing to allow multiple report versions per idea, or a `report_versions` table alongside the existing `reports` row
- Wizard answers use `upsert on conflict (idea_id, question_key)` — updating them is already supported; the UI just needs to allow it post-completion
- Progress tracking on next-steps could be a new `report_progress` JSONB column on `reports` or a separate `step_progress` table

**Revenue angle:** each "updated report" after editing is a new purchase — a natural upsell that doesn't require subscription infrastructure.

---

## 2. Ideas list on the account page

**User problem:** The dashboard already lists ideas, but the account page is currently profile-only. Users may expect to manage everything from one place.

**What to build:**
- A section on `/app/account` below the profile form listing the user's ideas with status badges, the same as the dashboard list
- Each idea links to its report or wizard as appropriate
- Delete idea option (with confirmation — irreversible, cascades to answers + report)

**Notes:** This is low effort since the data fetch and components already exist on the dashboard. It's a layout choice more than a feature.

---

## 3. Report progress tracker

**User problem:** The report's next-steps section gives an ordered action list, but there's no way to mark progress without re-reading the whole report.

**What to build:**
- Checkboxes or status toggles (todo / in progress / done) on each next-step in the full report view
- Progress is persisted to the DB (new column on `reports` or linked table)
- A summary progress indicator ("3 of 6 steps complete") shown on the dashboard ideas list

**Pairs with:** Feature 1 — when the user marks enough steps done, prompt them with "Update your idea and get a new report."

---

## Re-entry criteria

Reopen any of these when:
- At least 20 paying customers have purchased full reports
- User interviews or support requests mention the specific pain point
- The payment + unlock flow (Phase 5) is stable and not the primary support burden
