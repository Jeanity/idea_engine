import { describe, it, expect } from 'vitest'
import {
  normalizeEmail,
  isDisposableEmail,
  evaluateAbuseSignals,
  countSuspiciousClusters,
  type PromoIdentityRow,
} from '@/lib/promo-abuse'

describe('normalizeEmail', () => {
  it('lowercases the whole address', () => {
    expect(normalizeEmail('Foo.Bar@Example.COM')).toBe('foo.bar@example.com')
  })

  it('strips plus-addressing from the local part', () => {
    expect(normalizeEmail('jane+promo@example.com')).toBe('jane@example.com')
  })

  it('strips dots from the local part for gmail.com', () => {
    expect(normalizeEmail('j.a.n.e@gmail.com')).toBe('jane@gmail.com')
  })

  it('strips dots from the local part for googlemail.com', () => {
    expect(normalizeEmail('j.a.n.e@googlemail.com')).toBe('jane@googlemail.com')
  })

  it('does NOT strip dots for non-gmail domains', () => {
    expect(normalizeEmail('j.a.n.e@example.com')).toBe('j.a.n.e@example.com')
  })

  it('combines plus-stripping and dot-stripping for gmail', () => {
    expect(normalizeEmail('J.Ane+promo@Gmail.com')).toBe('jane@gmail.com')
  })

  it('is a no-op on an address with no @', () => {
    expect(normalizeEmail('not-an-email')).toBe('not-an-email')
  })
})

describe('isDisposableEmail', () => {
  it('flags a known disposable domain', () => {
    expect(isDisposableEmail('someone@mailinator.com')).toBe(true)
  })

  it('is case-insensitive on the domain', () => {
    expect(isDisposableEmail('someone@MAILINATOR.COM')).toBe(true)
  })

  it('allows a normal domain', () => {
    expect(isDisposableEmail('someone@gmail.com')).toBe(false)
  })

  it('allows an address with no @', () => {
    expect(isDisposableEmail('not-an-email')).toBe(false)
  })
})

describe('evaluateAbuseSignals', () => {
  const now = new Date('2026-07-09T12:00:00.000Z')

  function row(overrides: Partial<PromoIdentityRow> = {}): PromoIdentityRow {
    return {
      user_id: 'other-user',
      normalized_email: 'someone@example.com',
      ip_hash: null,
      ab_id: null,
      created_at: now.toISOString(),
      ...overrides,
    }
  }

  it('allows when no rows match anything', () => {
    const r = evaluateAbuseSignals([], {
      normalizedEmail: 'me@example.com',
      abId: null,
      ipHash: null,
      currentUserId: 'me',
      now,
    })
    expect(r).toEqual({ verdict: 'allow' })
  })

  it('denies with email_reused when the same normalized email belongs to a different user', () => {
    const rows = [row({ user_id: 'other-user', normalized_email: 'me@example.com' })]
    const r = evaluateAbuseSignals(rows, {
      normalizedEmail: 'me@example.com',
      abId: null,
      ipHash: null,
      currentUserId: 'me',
      now,
    })
    expect(r).toEqual({ verdict: 'deny', reason: 'email_reused' })
  })

  it('allows when the same normalized email belongs to the SAME user (own prior row)', () => {
    const rows = [row({ user_id: 'me', normalized_email: 'me@example.com' })]
    const r = evaluateAbuseSignals(rows, {
      normalizedEmail: 'me@example.com',
      abId: null,
      ipHash: null,
      currentUserId: 'me',
      now,
    })
    expect(r).toEqual({ verdict: 'allow' })
  })

  it('denies with browser_reused when the same ab_id belongs to a different user', () => {
    const rows = [row({ user_id: 'other-user', normalized_email: 'unrelated@example.com', ab_id: 'ab-123' })]
    const r = evaluateAbuseSignals(rows, {
      normalizedEmail: 'me@example.com',
      abId: 'ab-123',
      ipHash: null,
      currentUserId: 'me',
      now,
    })
    expect(r).toEqual({ verdict: 'deny', reason: 'browser_reused' })
  })

  it('denies with ip_velocity when 2+ distinct users share an ip_hash within 24h', () => {
    const rows = [
      row({ user_id: 'other-user-1', normalized_email: 'a@example.com', ip_hash: 'hash-1', created_at: now.toISOString() }),
    ]
    const r = evaluateAbuseSignals(rows, {
      normalizedEmail: 'me@example.com',
      abId: null,
      ipHash: 'hash-1',
      currentUserId: 'me',
      now,
    })
    expect(r).toEqual({ verdict: 'deny', reason: 'ip_velocity' })
  })

  it('allows ip reuse by the SAME user only (no second distinct account)', () => {
    const rows = [
      row({ user_id: 'me', normalized_email: 'me@example.com', ip_hash: 'hash-1', created_at: now.toISOString() }),
    ]
    const r = evaluateAbuseSignals(rows, {
      normalizedEmail: 'me@example.com',
      abId: null,
      ipHash: 'hash-1',
      currentUserId: 'me',
      now,
    })
    expect(r).toEqual({ verdict: 'allow' })
  })

  it('ignores ip_hash matches older than 24h', () => {
    const old = new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString()
    const rows = [
      row({ user_id: 'other-user', normalized_email: 'a@example.com', ip_hash: 'hash-1', created_at: old }),
    ]
    const r = evaluateAbuseSignals(rows, {
      normalizedEmail: 'me@example.com',
      abId: null,
      ipHash: 'hash-1',
      currentUserId: 'me',
      now,
    })
    expect(r).toEqual({ verdict: 'allow' })
  })

  it('a null ab_id never matches another null ab_id', () => {
    const rows = [row({ user_id: 'other-user', normalized_email: 'unrelated@example.com', ab_id: null })]
    const r = evaluateAbuseSignals(rows, {
      normalizedEmail: 'me@example.com',
      abId: null,
      ipHash: null,
      currentUserId: 'me',
      now,
    })
    expect(r).toEqual({ verdict: 'allow' })
  })

  it('a null ip_hash never matches another null ip_hash', () => {
    const rows = [row({ user_id: 'other-user', normalized_email: 'unrelated@example.com', ip_hash: null })]
    const r = evaluateAbuseSignals(rows, {
      normalizedEmail: 'me@example.com',
      abId: null,
      ipHash: null,
      currentUserId: 'me',
      now,
    })
    expect(r).toEqual({ verdict: 'allow' })
  })

  it('checks email_reused before browser_reused when both would trip', () => {
    const rows = [
      row({ user_id: 'other-user', normalized_email: 'me@example.com', ab_id: 'ab-123' }),
    ]
    const r = evaluateAbuseSignals(rows, {
      normalizedEmail: 'me@example.com',
      abId: 'ab-123',
      ipHash: null,
      currentUserId: 'me',
      now,
    })
    expect(r).toEqual({ verdict: 'deny', reason: 'email_reused' })
  })
})

describe('countSuspiciousClusters', () => {
  function row(overrides: Partial<PromoIdentityRow> = {}): PromoIdentityRow {
    return {
      user_id: 'u1',
      normalized_email: 'a@example.com',
      ip_hash: null,
      ab_id: null,
      created_at: '2026-07-09T00:00:00.000Z',
      ...overrides,
    }
  }

  it('returns 0 for no rows', () => {
    expect(countSuspiciousClusters([])).toBe(0)
  })

  it('counts an ip_hash shared by 2+ distinct users as one cluster', () => {
    const rows = [row({ user_id: 'u1', ip_hash: 'hash-1' }), row({ user_id: 'u2', ip_hash: 'hash-1' })]
    expect(countSuspiciousClusters(rows)).toBe(1)
  })

  it('does not count an ip_hash used by a single user repeatedly', () => {
    const rows = [row({ user_id: 'u1', ip_hash: 'hash-1' }), row({ user_id: 'u1', ip_hash: 'hash-1' })]
    expect(countSuspiciousClusters(rows)).toBe(0)
  })

  it('sums ip_hash clusters and ab_id clusters independently', () => {
    const rows = [
      row({ user_id: 'u1', ip_hash: 'hash-1' }),
      row({ user_id: 'u2', ip_hash: 'hash-1' }),
      row({ user_id: 'u3', ab_id: 'ab-1' }),
      row({ user_id: 'u4', ab_id: 'ab-1' }),
    ]
    expect(countSuspiciousClusters(rows)).toBe(2)
  })

  it('ignores null ip_hash/ab_id groups', () => {
    const rows = [row({ user_id: 'u1' }), row({ user_id: 'u2' })]
    expect(countSuspiciousClusters(rows)).toBe(0)
  })
})
