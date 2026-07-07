import { describe, it, expect } from 'vitest'
import { parseUtmParams, enumerateUtcDays, fillDailySeries, utcDay } from '@/lib/analytics'

describe('parseUtmParams', () => {
  it('returns null when no utm params are present', () => {
    expect(parseUtmParams('')).toBeNull()
    expect(parseUtmParams('?foo=bar&page=2')).toBeNull()
  })

  it('extracts the five utm keys, stripping the utm_ prefix', () => {
    expect(
      parseUtmParams('?utm_source=google&utm_medium=cpc&utm_campaign=launch&utm_term=idea&utm_content=hero')
    ).toEqual({ source: 'google', medium: 'cpc', campaign: 'launch', term: 'idea', content: 'hero' })
  })

  it('includes only the params that are present', () => {
    expect(parseUtmParams('?utm_source=newsletter&utm_campaign=july')).toEqual({
      source: 'newsletter',
      campaign: 'july',
    })
  })

  it('trims values and ignores empty ones', () => {
    expect(parseUtmParams('?utm_source=%20&utm_campaign=%20launch%20')).toEqual({ campaign: 'launch' })
  })
})

describe('utcDay', () => {
  it('returns the UTC date part', () => {
    expect(utcDay(new Date('2026-07-07T23:30:00Z'))).toBe('2026-07-07')
  })
})

describe('enumerateUtcDays', () => {
  it('lists every UTC day inclusive of both bounds', () => {
    expect(enumerateUtcDays(new Date('2026-07-05T10:00:00Z'), new Date('2026-07-07T02:00:00Z'))).toEqual([
      '2026-07-05',
      '2026-07-06',
      '2026-07-07',
    ])
  })

  it('returns a single day when from and to share a day', () => {
    expect(enumerateUtcDays(new Date('2026-07-07T01:00:00Z'), new Date('2026-07-07T23:00:00Z'))).toEqual([
      '2026-07-07',
    ])
  })

  it('returns [] when to precedes from', () => {
    expect(enumerateUtcDays(new Date('2026-07-08T00:00:00Z'), new Date('2026-07-07T00:00:00Z'))).toEqual([])
  })

  it('crosses a month boundary correctly', () => {
    expect(enumerateUtcDays(new Date('2026-06-30T12:00:00Z'), new Date('2026-07-01T12:00:00Z'))).toEqual([
      '2026-06-30',
      '2026-07-01',
    ])
  })
})

describe('fillDailySeries', () => {
  const from = new Date('2026-07-05T00:00:00Z')
  const to = new Date('2026-07-07T00:00:00Z')

  it('fills missing days with zero', () => {
    expect(fillDailySeries([{ day: '2026-07-06', count: 4 }], from, to)).toEqual([
      { day: '2026-07-05', count: 0 },
      { day: '2026-07-06', count: 4 },
      { day: '2026-07-07', count: 0 },
    ])
  })

  it('sums duplicate days and ignores out-of-range rows', () => {
    expect(
      fillDailySeries(
        [
          { day: '2026-07-06', count: 2 },
          { day: '2026-07-06', count: 3 },
          { day: '2026-07-01', count: 9 }, // out of range — ignored
        ],
        from,
        to
      )
    ).toEqual([
      { day: '2026-07-05', count: 0 },
      { day: '2026-07-06', count: 5 },
      { day: '2026-07-07', count: 0 },
    ])
  })
})
