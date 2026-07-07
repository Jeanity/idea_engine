import { describe, it, expect } from 'vitest'
import { evaluateEditLimit } from '@/lib/edit-limit'

const MIN = 60_000
const now = Date.UTC(2026, 6, 7, 12, 0, 0)
const iso = (msAgo: number) => new Date(now - msAgo).toISOString()

describe('evaluateEditLimit', () => {
  it('records a first session from an empty log', () => {
    const r = evaluateEditLimit([], now)
    expect(r.allowed).toBe(true)
    expect(r.updatedLog).toHaveLength(1)
    expect(new Date(r.updatedLog![0]).getTime()).toBe(now)
  })

  it('treats a save within 15 minutes as the same session (log unchanged)', () => {
    const r = evaluateEditLimit([iso(10 * MIN)], now)
    expect(r.allowed).toBe(true)
    expect(r.updatedLog).toBeUndefined()
  })

  it('records a second distinct session after the session window', () => {
    const r = evaluateEditLimit([iso(20 * MIN)], now)
    expect(r.allowed).toBe(true)
    expect(r.updatedLog).toHaveLength(2)
  })

  it('blocks a third session within the hour', () => {
    const r = evaluateEditLimit([iso(40 * MIN), iso(20 * MIN)], now)
    expect(r.allowed).toBe(false)
    expect(r.updatedLog).toBeUndefined()
    // Oldest counted timestamp (40m ago) ages out of the hour in ~20 minutes.
    expect(r.retryAfterMinutes).toBe(20)
  })

  it('prunes timestamps older than the hour before counting', () => {
    // Two entries but one is 70 minutes old — only one counts, so a new
    // (post-session-window) session is still allowed.
    const r = evaluateEditLimit([iso(70 * MIN), iso(30 * MIN)], now)
    expect(r.allowed).toBe(true)
    expect(r.updatedLog).toHaveLength(2)
  })

  it('ignores malformed timestamps', () => {
    const r = evaluateEditLimit(['not-a-date', null, undefined], now)
    expect(r.allowed).toBe(true)
    expect(r.updatedLog).toHaveLength(1)
  })

  it('reports at least 1 minute of retry time', () => {
    const r = evaluateEditLimit([iso(59.9 * MIN), iso(20 * MIN)], now)
    expect(r.allowed).toBe(false)
    expect(r.retryAfterMinutes).toBeGreaterThanOrEqual(1)
  })
})
