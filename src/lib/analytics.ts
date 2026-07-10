// Pure, side-effect-free analytics helpers shared by the tracking beacon and
// (later) the admin dashboard. No DOM, no Supabase — safe to unit-test.
//
// `utcDay`/`enumerateUtcDays`/`fillDailySeries` deal in UTC calendar days,
// matching the migration-005 Postgres aggregation RPCs (which group on
// `(occurred_at at time zone 'UTC')::date`) and the day-LABEL sequence for a
// range (labels are just the requested from/to dates verbatim — tz-agnostic).
// `localDayLabel` is the admin-local-timezone variant used by
// /api/admin/graphs (migration 026) to bucket individual events into those
// labels using the admin's tz offset instead of raw UTC.

/** First-party UTM parameters captured on the first page of a session. */
export interface Utm {
  source?: string
  medium?: string
  campaign?: string
  term?: string
  content?: string
}

const UTM_KEYS = ['source', 'medium', 'campaign', 'term', 'content'] as const

/**
 * Parse `utm_*` params out of a URL query string (e.g. `location.search`).
 * Returns null when none are present so callers can store SQL NULL. Values are
 * trimmed; empty values are ignored.
 */
export function parseUtmParams(search: string): Utm | null {
  const params = new URLSearchParams(search)
  const utm: Utm = {}
  for (const key of UTM_KEYS) {
    const raw = params.get(`utm_${key}`)
    if (raw == null) continue
    const value = raw.trim()
    if (value) utm[key] = value
  }
  return Object.keys(utm).length > 0 ? utm : null
}

/** A single day/count bucket as returned (with gaps) by the aggregation RPCs. */
export interface DailyCount {
  day: string // 'YYYY-MM-DD' (UTC)
  count: number
}

const DAY_MS = 24 * 60 * 60 * 1000

/** The UTC 'YYYY-MM-DD' date part of a timestamp. */
export function utcDay(at: Date): string {
  return at.toISOString().slice(0, 10)
}

/**
 * The 'YYYY-MM-DD' calendar-day label of a UTC instant in an admin's LOCAL
 * timezone, given a `Date.getTimezoneOffset()`-style minute offset (UTC minus
 * local — e.g. Sydney/UTC+10 is -600). Mirrors the admin/graphs route's
 * `localHourLabel`: shift the instant by the offset, then read its UTC date
 * part (identity when tzOffsetMinutes is 0).
 */
export function localDayLabel(at: Date, tzOffsetMinutes: number): string {
  return utcDay(new Date(at.getTime() - tzOffsetMinutes * 60000))
}

/**
 * Every UTC day from `from` to `to` inclusive, as 'YYYY-MM-DD' strings.
 * Both bounds are snapped to their UTC calendar day. Returns [] when to < from.
 */
export function enumerateUtcDays(from: Date, to: Date): string[] {
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate())
  const days: string[] = []
  for (let t = start; t <= end; t += DAY_MS) {
    days.push(new Date(t).toISOString().slice(0, 10))
  }
  return days
}

/**
 * Turn a sparse RPC result into a continuous daily series over [from, to],
 * filling missing days with 0 so charts don't skip empty days. Rows for days
 * outside the range are ignored; duplicate days are summed.
 */
export function fillDailySeries(rows: DailyCount[], from: Date, to: Date): DailyCount[] {
  const byDay = new Map<string, number>()
  for (const { day, count } of rows) {
    byDay.set(day, (byDay.get(day) ?? 0) + count)
  }
  return enumerateUtcDays(from, to).map(day => ({ day, count: byDay.get(day) ?? 0 }))
}

// ── Hourly buckets (single-day admin charts) ─────────────────────
// When the dashboard period is a single day, charts bucket by UTC hour instead
// of showing one lonely point. Labels are 'HH:00' (UTC, matching the day
// boundaries everywhere else in the analytics stack).

/** All 24 hour labels, '00:00' … '23:00'. */
export const UTC_HOUR_LABELS: string[] = Array.from({ length: 24 }, (_, h) =>
  `${String(h).padStart(2, '0')}:00`
)

/** The 'HH:00' UTC hour label of a timestamp. */
export function utcHourLabel(at: Date): string {
  return `${String(at.getUTCHours()).padStart(2, '0')}:00`
}

/** Continuous 24-bucket hourly series from a label→count map. */
export function fillHourlySeries(counts: Map<string, number>): DailyCount[] {
  return UTC_HOUR_LABELS.map(day => ({ day, count: counts.get(day) ?? 0 }))
}
