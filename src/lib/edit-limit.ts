// Answer-edit rate limiting (applies only once a completed report exists).
//
// An "edit session" is a burst of saves: any save within SESSION_WINDOW_MS of
// the most recent counted timestamp belongs to that same session, so editing
// several answers in one sitting counts once. At most LIMIT sessions are
// allowed in a rolling LIMIT_WINDOW_MS. Timestamps older than the window are
// pruned on every write.

const SESSION_WINDOW_MS = 15 * 60_000
const LIMIT_WINDOW_MS = 60 * 60_000
const LIMIT = 2

export interface EditLimitResult {
  allowed: boolean
  /** Pruned log with the new session timestamp appended — present only when a new session is recorded. */
  updatedLog?: string[]
  /** Minutes until the user may start another session — present only when blocked. */
  retryAfterMinutes?: number
}

export function evaluateEditLimit(log: unknown, nowMs: number): EditLimitResult {
  const times = (Array.isArray(log) ? log : [])
    .map(t => new Date(String(t)).getTime())
    .filter(t => Number.isFinite(t) && nowMs - t < LIMIT_WINDOW_MS)

  const inSession = times.length > 0 && nowMs - Math.max(...times) < SESSION_WINDOW_MS

  // Continuing an existing session — allowed, and the log is unchanged.
  if (inSession) return { allowed: true }

  // A new session would exceed the limit — block until the oldest counted
  // timestamp ages out of the rolling window.
  if (times.length >= LIMIT) {
    const retryAfterMinutes = Math.max(1, Math.ceil((LIMIT_WINDOW_MS - (nowMs - Math.min(...times))) / 60_000))
    return { allowed: false, retryAfterMinutes }
  }

  // Record a new session.
  return { allowed: true, updatedLog: [...times.map(t => new Date(t).toISOString()), new Date(nowMs).toISOString()] }
}
