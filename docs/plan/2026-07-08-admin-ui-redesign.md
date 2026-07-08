# Plan — Admin UI redesign (sidebar shell, snapshot dashboard, pagination, error log, drag-reorder)

Target look: modern SaaS admin (ref screenshots: Apex/Zenith/Nalika/Adminty) — left
sidebar nav, full-width, light+dark, KPI cards w/ sparklines, overview chart w/ tabs,
side widgets (donut, progress, latest lists). Project palette: indigo `#6366f1` /
violet `#8b5cf6` accents, emerald positive, **amber for negative/warning, NO RED**.

## Ground rules (unchanged)
Next 16 App Router + TS + Supabase + Tailwind (dark slate-950 default + `light:`),
React 19, recharts already installed. Every admin API route self-gates isAdminEmail;
service-role only after. Deletion always confirms. Cheapest capable model. Verify each
block: `npx tsc --noEmit`, `npm run lint` (must stay 0 after the lint-cleanup task),
`npm run build`. Commit per block. Preview is bound to E:\sig this session, so Danny
verifies the look locally.

## Block R1 — Shell + design system (Opus; foundation, sets the visual language)
- Replace the top-tab `admin-nav.tsx` + `layout.tsx` with a **sidebar shell**:
  - Left sidebar ~240px (collapsible to icons; state in localStorage). Brand/logo top;
    grouped nav with uppercase section labels + icon rows, active item = accent pill:
    - OVERVIEW: Dashboard, Analytics (the Block 8 graphs)
    - MANAGEMENT: Users, Affiliates, Offers, Feedback
    - FINANCE: Sales
    - SYSTEM: Errors (Block R4)
  - Admin identity + sign-out pinned at the sidebar bottom.
  - Top bar: page title slot, ThemeToggle (REUSE existing `theme-toggle.tsx` — do NOT
    edit it), admin email/avatar. Mobile: sidebar collapses to a drawer (hamburger).
  - Content area full-width (drop the max-w-5xl), padded, subtle page bg.
- Establish reusable primitives in `src/components/admin/`: `AdminCard`, `StatCard`
  (label, big value, icon chip, %-change pill emerald/amber, optional sparkline via
  recharts), `WidgetCard` (title + optional period control + body), `SectionLabel`.
  All theme-aware (dark + `light:`). Everything else reuses these.
- Keep all existing admin routes working; only the chrome changes here.

## Block R2 — Snapshot dashboard + drag-reorder (Opus; builds on R1)
- Rebuild `/app/admin` as a widget grid using R1 primitives:
  - **KPI row** (StatCards w/ sparkline + %-change): Users online, Reports today,
    Signups (period), Revenue (period). Reuse `/api/admin/stats` + graphs data.
  - **Overview chart** (recharts area/line) with tab toggles (Reports / Signups /
    Sessions), sharing the PeriodPicker.
  - **Quick-view widgets** (each its OWN period control where noted):
    - *Report costs* — avg / hourly / daily / weekly / month / custom (new
      `/api/admin/costs` or extend stats; reads `reports.cost_usd`).
    - *Today's sales* — with 7d / month / custom toggle (reuse sales route).
    - *Latest affiliate links* — recent N w/ click counts (link to Affiliates).
    - *Latest feedback* — recent N ratings + snippet (link to Feedback).
  - Donut (report types or traffic sources) + a small goals/progress widget if useful.
- **Drag-to-reorder + resize (span-based grid)**: add `@dnd-kit/core` +
  `@dnd-kit/sortable` (`npm install`). Dashboard is a **4-column grid**; each widget
  has BOTH:
  - a draggable handle to reposition (grid reflows/packs around it), and
  - a **width control** snapping to ¼ / ½ / ¾ / full (column span 1–4), so the admin
    can lay widgets out e.g. two-across-two-down. On mobile everything stacks to full
    width regardless of saved span.
  Per-widget **order AND span** persist to localStorage keyed per admin id; a "Reset
  layout" control restores defaults. Keyboard-accessible (dnd-kit supports it). This is
  pure client layout state — server data untouched. (NOT free-form pixel resize — snap
  to the 4-col grid for robustness on React 19.)

## Block R3 — Pagination on all admin lists (Sonnet)
- Add pagination (page size ~25, prev/next + page count) to: Users, Affiliates,
  Offers, Feedback lists. Prefer server-side `.range()` on the Supabase queries with a
  total count; reflect page in the URL (`?page=`). Reuse a shared `Pagination`
  component in `src/components/admin/`. No endless scroll.

## Block R4 — Error log (Sonnet; has a migration) — ✅ BUILT 2026-07-08 (migration 009 run ✅)
- Migration **009**: `error_log` table (id, occurred_at, source text, message text,
  detail jsonb null, path text null, user_id null). RLS on, service-role only.
- `src/lib/log-error.ts`: `logError({source, message, detail, path, userId})` —
  best-effort service-role insert, never throws (so logging can't break a request).
  Wire it into the `catch` blocks of the admin API routes + the Inngest report
  functions (minimal, additive) so real failures get recorded.
- Admin **Errors** page (`/app/admin/errors`): paginated list (reuse R3 pagination),
  newest first, filter by source, each row expandable to full detail, and a
  **"Copy"** button (copies the row — or the visible page — as text so Danny can paste
  it here). Admin-gated route `/api/admin/errors` (read; optional clear-all behind a
  typed confirm per the deletion rule).

## Order & models
R1 (Opus) → R2 (Opus) → R3 (Sonnet) → R4 (Sonnet). R1 first so the design system exists
before the rest reuse it. Commit each. Danny verifies the look locally after R1/R2.
