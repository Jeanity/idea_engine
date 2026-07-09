import { describe, it, expect } from 'vitest'
import {
  ESSENTIAL_SERVICE_CATEGORIES,
  selectEssentialServices,
  resolveEssentialServices,
  absolutizeEssentialServices,
  searchUrl,
  type EssentialServiceAffiliateRow,
} from '@/lib/essential-services'

describe('selectEssentialServices — pure selection logic', () => {
  it('falls back to a search link when no affiliate row exists for a category', () => {
    const out = selectEssentialServices([], 'US')
    expect(out).toHaveLength(ESSENTIAL_SERVICE_CATEGORIES.length)
    for (const service of out) {
      expect(service.kind).toBe('search')
      expect(service.href).toMatch(/^https:\/\/www\.google\.com\/search\?q=/)
    }
  })

  it('prefers a country-specific affiliate over a global one', () => {
    const rows: EssentialServiceAffiliateRow[] = [
      { slug: 'global-accountant', name: 'Global Accountants Inc', category: 'accountants', country: null, note: null },
      { slug: 'us-accountant', name: 'US Tax Pros', category: 'accountants', country: 'US', note: 'Great for LLCs' },
    ]
    const out = selectEssentialServices(rows, 'US')
    const accountants = out.find(s => s.id === 'accountants')!
    expect(accountants.kind).toBe('affiliate')
    expect(accountants.name).toBe('US Tax Pros')
    expect(accountants.href).toBe('/go/us-accountant')
    expect(accountants.note).toBe('Great for LLCs')
  })

  it('falls back to a global affiliate when no country-specific match exists', () => {
    const rows: EssentialServiceAffiliateRow[] = [
      { slug: 'global-accountant', name: 'Global Accountants Inc', category: 'accountants', country: null, note: null },
    ]
    const out = selectEssentialServices(rows, 'NZ')
    const accountants = out.find(s => s.id === 'accountants')!
    expect(accountants.kind).toBe('affiliate')
    expect(accountants.name).toBe('Global Accountants Inc')
  })

  it('falls back to search when only a different country has an affiliate', () => {
    const rows: EssentialServiceAffiliateRow[] = [
      { slug: 'uk-accountant', name: 'UK Accountants Ltd', category: 'accountants', country: 'GB', note: null },
    ]
    const out = selectEssentialServices(rows, 'US')
    const accountants = out.find(s => s.id === 'accountants')!
    expect(accountants.kind).toBe('search')
  })

  it('matches country case-insensitively', () => {
    const rows: EssentialServiceAffiliateRow[] = [
      { slug: 'us-accountant', name: 'US Tax Pros', category: 'accountants', country: 'us', note: null },
    ]
    const out = selectEssentialServices(rows, 'US')
    expect(out.find(s => s.id === 'accountants')!.kind).toBe('affiliate')
  })

  it('ignores rows with no category (ordinary content-rewrite links)', () => {
    const rows: EssentialServiceAffiliateRow[] = [
      { slug: 'vistaprint', name: 'Vistaprint', category: null, country: null, note: null },
    ]
    const out = selectEssentialServices(rows, 'US')
    for (const service of out) {
      expect(service.kind).toBe('search')
    }
  })

  it('ignores rows for other categories when resolving a given category', () => {
    const rows: EssentialServiceAffiliateRow[] = [
      { slug: 'some-lawyer', name: 'Some Legal Co', category: 'legal', country: null, note: null },
    ]
    const out = selectEssentialServices(rows, 'US')
    expect(out.find(s => s.id === 'accountants')!.kind).toBe('search')
    expect(out.find(s => s.id === 'legal')!.kind).toBe('affiliate')
  })

  it('always includes extraSearches (search fallback) for categories that define them, affiliate or not', () => {
    const rows: EssentialServiceAffiliateRow[] = [
      { slug: 'some-lawyer', name: 'Some Legal Co', category: 'legal', country: null, note: null },
    ]
    const withAffiliate = selectEssentialServices(rows, 'US').find(s => s.id === 'legal')!
    const withoutAffiliate = selectEssentialServices([], 'US').find(s => s.id === 'legal')!
    expect(withAffiliate.extraSearches.length).toBeGreaterThan(0)
    expect(withoutAffiliate.extraSearches).toEqual(withAffiliate.extraSearches)
  })

  it('handles a null/undefined country code by never matching country-specific rows', () => {
    const rows: EssentialServiceAffiliateRow[] = [
      { slug: 'us-accountant', name: 'US Tax Pros', category: 'accountants', country: 'US', note: null },
      { slug: 'global-accountant', name: 'Global Accountants Inc', category: 'accountants', country: null, note: null },
    ]
    const out = selectEssentialServices(rows, null)
    expect(out.find(s => s.id === 'accountants')!.name).toBe('Global Accountants Inc')
  })

  it('returns one entry per registry category, in registry order', () => {
    const out = selectEssentialServices([], 'US')
    expect(out.map(s => s.id)).toEqual(ESSENTIAL_SERVICE_CATEGORIES.map(c => c.id))
  })
})

describe('searchUrl', () => {
  it('URL-encodes the query', () => {
    expect(searchUrl('accountants near me')).toBe('https://www.google.com/search?q=accountants%20near%20me')
  })
})

describe('absolutizeEssentialServices', () => {
  it('prefixes affiliate /go/ hrefs with the origin', () => {
    const rows: EssentialServiceAffiliateRow[] = [
      { slug: 'us-accountant', name: 'US Tax Pros', category: 'accountants', country: 'US', note: null },
    ]
    const resolved = selectEssentialServices(rows, 'US')
    const abs = absolutizeEssentialServices(resolved, 'https://ideaengine.app/')
    expect(abs.find(s => s.id === 'accountants')!.href).toBe('https://ideaengine.app/go/us-accountant')
  })

  it('leaves search hrefs (already absolute) unchanged', () => {
    const resolved = selectEssentialServices([], 'US')
    const abs = absolutizeEssentialServices(resolved, 'https://ideaengine.app')
    for (const s of abs) {
      expect(s.href).toMatch(/^https:\/\/www\.google\.com\/search\?q=/)
    }
  })
})

describe('resolveEssentialServices — I/O wrapper degradation', () => {
  function fakeSupabase(result: { data: EssentialServiceAffiliateRow[] | null; error: { code?: string; message?: string } | null }) {
    return {
      from: (_table: 'affiliate_links') => ({
        select: (_columns: string) => ({
          eq: (_col: string, _val: unknown) => ({
            not: (_col2: string, _op: string, _val2: unknown) => Promise.resolve(result),
          }),
        }),
      }),
    }
  }

  it('returns resolved rows on success', async () => {
    const supabase = fakeSupabase({
      data: [{ slug: 'us-accountant', name: 'US Tax Pros', category: 'accountants', country: 'US', note: null }],
      error: null,
    })
    const out = await resolveEssentialServices(supabase, 'US')
    expect(out.find(s => s.id === 'accountants')!.kind).toBe('affiliate')
  })

  it('degrades to all search links on a query error (e.g. pre-migration missing columns)', async () => {
    const supabase = fakeSupabase({ data: null, error: { code: '42703', message: 'column "category" does not exist' } })
    const out = await resolveEssentialServices(supabase, 'US')
    expect(out.every(s => s.kind === 'search')).toBe(true)
  })

  it('degrades to all search links on a PostgREST schema-cache error', async () => {
    const supabase = fakeSupabase({ data: null, error: { code: 'PGRST204' } })
    const out = await resolveEssentialServices(supabase, 'US')
    expect(out.every(s => s.kind === 'search')).toBe(true)
  })

  it('degrades to all search links if the query throws', async () => {
    const supabase = {
      from: () => {
        throw new Error('network error')
      },
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = await resolveEssentialServices(supabase as any, 'US')
    expect(out.every(s => s.kind === 'search')).toBe(true)
  })
})
