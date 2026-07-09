// Shared between src/components/admin/mark-seen.tsx (dispatches, once its
// POST /api/admin/nav-status/seen settles) and
// src/app/app/admin/admin-shell.tsx (listens, to trigger one immediate extra
// nav-status refetch). Without this, the badge for the page you just visited
// wouldn't clear until the next 60s poll — the route-change refetch that
// admin-shell already does fires the instant the page mounts, which is
// almost always BEFORE the mark-seen POST has resolved, so it still sees the
// stale (pre-mark-seen) count.
export const ADMIN_NAV_SEEN_EVENT = 'admin-nav:seen'
