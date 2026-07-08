// Shared page-size + range helpers for admin list pagination (Block R3).
// Every paginated admin list (Users, Affiliates, Offers, Feedback) uses the
// same page size and the same `?page=` URL convention, so keep the math in
// one place rather than re-deriving it per list.

export const ADMIN_PAGE_SIZE = 25

/** Parses a raw `?page=` search-param value into a safe 1-indexed page number. */
export function parsePage(raw: string | undefined): number {
  const n = Number(raw)
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1
}

/** `[from, to]` inclusive indices for a Supabase `.range(from, to)` call. */
export function pageRange(page: number, pageSize: number = ADMIN_PAGE_SIZE): { from: number; to: number } {
  const from = (page - 1) * pageSize
  return { from, to: from + pageSize - 1 }
}

/** Total page count for a given row count. Always at least 1 so "Page 1 of 1" renders cleanly when empty. */
export function totalPageCount(count: number, pageSize: number = ADMIN_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(count / pageSize))
}
