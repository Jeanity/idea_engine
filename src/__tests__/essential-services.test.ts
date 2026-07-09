import { describe, it, expect } from 'vitest'
import {
  ESSENTIAL_SERVICE_CATEGORIES,
  ESSENTIAL_SERVICE_GROUPS,
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
      { slug: 'global-accountant', name: 'Global Accountants Inc', category: 'accountants', countries: null, note: null },
      { slug: 'us-accountant', name: 'US Tax Pros', category: 'accountants', countries: ['US'], note: 'Great for LLCs' },
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
      { slug: 'global-accountant', name: 'Global Accountants Inc', category: 'accountants', countries: null, note: null },
    ]
    const out = selectEssentialServices(rows, 'NZ')
    const accountants = out.find(s => s.id === 'accountants')!
    expect(accountants.kind).toBe('affiliate')
    expect(accountants.name).toBe('Global Accountants Inc')
  })

  it('falls back to search when only a different country has an affiliate', () => {
    const rows: EssentialServiceAffiliateRow[] = [
      { slug: 'uk-accountant', name: 'UK Accountants Ltd', category: 'accountants', countries: ['GB'], note: null },
    ]
    const out = selectEssentialServices(rows, 'US')
    const accountants = out.find(s => s.id === 'accountants')!
    expect(accountants.kind).toBe('search')
  })

  it('matches country case-insensitively', () => {
    const rows: EssentialServiceAffiliateRow[] = [
      { slug: 'us-accountant', name: 'US Tax Pros', category: 'accountants', countries: ['us'], note: null },
    ]
    const out = selectEssentialServices(rows, 'US')
    expect(out.find(s => s.id === 'accountants')!.kind).toBe('affiliate')
  })

  it('matches a link that lists multiple countries (e.g. AU and NZ)', () => {
    const rows: EssentialServiceAffiliateRow[] = [
      { slug: 'hnry', name: 'Hnry', category: 'accountants', countries: ['AU', 'NZ'], note: null },
    ]
    const outNz = selectEssentialServices(rows, 'NZ')
    expect(outNz.find(s => s.id === 'accountants')!.kind).toBe('affiliate')
    expect(outNz.find(s => s.id === 'accountants')!.name).toBe('Hnry')

    const outAu = selectEssentialServices(rows, 'AU')
    expect(outAu.find(s => s.id === 'accountants')!.name).toBe('Hnry')

    const outUs = selectEssentialServices(rows, 'US')
    expect(outUs.find(s => s.id === 'accountants')!.kind).toBe('search')
  })

  it('treats an empty countries array as global', () => {
    const rows: EssentialServiceAffiliateRow[] = [
      { slug: 'global-accountant', name: 'Global Accountants Inc', category: 'accountants', countries: [], note: null },
    ]
    const out = selectEssentialServices(rows, 'NZ')
    expect(out.find(s => s.id === 'accountants')!.kind).toBe('affiliate')
    expect(out.find(s => s.id === 'accountants')!.name).toBe('Global Accountants Inc')
  })

  it('ignores rows with no category (ordinary content-rewrite links)', () => {
    const rows: EssentialServiceAffiliateRow[] = [
      { slug: 'vistaprint', name: 'Vistaprint', category: null, countries: null, note: null },
    ]
    const out = selectEssentialServices(rows, 'US')
    for (const service of out) {
      expect(service.kind).toBe('search')
    }
  })

  it('ignores rows for other categories when resolving a given category', () => {
    const rows: EssentialServiceAffiliateRow[] = [
      { slug: 'some-lawyer', name: 'Some Legal Co', category: 'legal', countries: null, note: null },
    ]
    const out = selectEssentialServices(rows, 'US')
    expect(out.find(s => s.id === 'accountants')!.kind).toBe('search')
    expect(out.find(s => s.id === 'legal')!.kind).toBe('affiliate')
  })

  it('always includes extraSearches (search fallback) for categories that define them, affiliate or not', () => {
    const rows: EssentialServiceAffiliateRow[] = [
      { slug: 'some-lawyer', name: 'Some Legal Co', category: 'legal', countries: null, note: null },
    ]
    const withAffiliate = selectEssentialServices(rows, 'US').find(s => s.id === 'legal')!
    const withoutAffiliate = selectEssentialServices([], 'US').find(s => s.id === 'legal')!
    expect(withAffiliate.extraSearches.length).toBeGreaterThan(0)
    expect(withoutAffiliate.extraSearches).toEqual(withAffiliate.extraSearches)
  })

  it('handles a null/undefined country code by never matching country-specific rows', () => {
    const rows: EssentialServiceAffiliateRow[] = [
      { slug: 'us-accountant', name: 'US Tax Pros', category: 'accountants', countries: ['US'], note: null },
      { slug: 'global-accountant', name: 'Global Accountants Inc', category: 'accountants', countries: null, note: null },
    ]
    const out = selectEssentialServices(rows, null)
    expect(out.find(s => s.id === 'accountants')!.name).toBe('Global Accountants Inc')
  })

  it('returns one entry per registry category, in registry order', () => {
    const out = selectEssentialServices([], 'US')
    expect(out.map(s => s.id)).toEqual(ESSENTIAL_SERVICE_CATEGORIES.map(c => c.id))
  })
})

describe('selectEssentialServices — grouping', () => {
  it('assigns every category a group that exists in ESSENTIAL_SERVICE_GROUPS', () => {
    const groupIds = new Set(ESSENTIAL_SERVICE_GROUPS.map(g => g.id))
    for (const cat of ESSENTIAL_SERVICE_CATEGORIES) {
      expect(groupIds.has(cat.group)).toBe(true)
    }
  })

  it('carries the category group through to resolved services', () => {
    const out = selectEssentialServices([], 'US')
    for (const service of out) {
      const cat = ESSENTIAL_SERVICE_CATEGORIES.find(c => c.id === service.id)!
      expect(service.group).toBe(cat.group)
    }
  })
})

describe('selectEssentialServices — legacy website category mapping', () => {
  it('maps an affiliate row still tagged category=\'website\' onto website_diy', () => {
    const rows: EssentialServiceAffiliateRow[] = [
      { slug: 'old-website-partner', name: 'Old Website Partner', category: 'website', countries: null, note: null },
    ]
    const out = selectEssentialServices(rows, 'US')
    const websiteDiy = out.find(s => s.id === 'website_diy')!
    expect(websiteDiy.kind).toBe('affiliate')
    expect(websiteDiy.name).toBe('Old Website Partner')
    // Doesn't leak into website_hire.
    expect(out.find(s => s.id === 'website_hire')!.kind).toBe('search')
  })
})

describe('selectEssentialServices — archetype filtering', () => {
  it('hides an archetype-restricted category for a non-matching archetype', () => {
    const out = selectEssentialServices([], 'US', 'content_education')
    expect(out.find(s => s.id === 'app_development')).toBeUndefined()
    expect(out.find(s => s.id === 'promotional_material')).toBeUndefined()
    expect(out.find(s => s.id === 'payments')).toBeUndefined()
  })

  it('shows an archetype-restricted category for a matching archetype', () => {
    const out = selectEssentialServices([], 'US', 'software_app')
    expect(out.find(s => s.id === 'app_development')).toBeDefined()
  })

  it('shows payments for a matching archetype and hides it for a non-matching one', () => {
    expect(selectEssentialServices([], 'US', 'physical_product').find(s => s.id === 'payments')).toBeDefined()
    expect(selectEssentialServices([], 'US', 'content_education').find(s => s.id === 'payments')).toBeUndefined()
  })

  it('shows promotional_material for most archetypes but hides it for software_app and content_education', () => {
    expect(selectEssentialServices([], 'US', 'physical_product').find(s => s.id === 'promotional_material')).toBeDefined()
    expect(selectEssentialServices([], 'US', 'local_service').find(s => s.id === 'promotional_material')).toBeDefined()
    expect(selectEssentialServices([], 'US', 'software_app').find(s => s.id === 'promotional_material')).toBeUndefined()
    expect(selectEssentialServices([], 'US', 'content_education').find(s => s.id === 'promotional_material')).toBeUndefined()
  })

  it('never hides an always-on (no archetypes list) category, regardless of archetype', () => {
    for (const archetype of ['content_education', 'software_app', 'physical_product', undefined]) {
      const out = selectEssentialServices([], 'US', archetype)
      expect(out.find(s => s.id === 'registration')).toBeDefined()
      expect(out.find(s => s.id === 'legal')).toBeDefined()
      expect(out.find(s => s.id === 'domain')).toBeDefined()
    }
  })

  it('does not hide archetype-restricted categories when archetype is omitted (backward compat)', () => {
    const out = selectEssentialServices([], 'US')
    expect(out).toHaveLength(ESSENTIAL_SERVICE_CATEGORIES.length)
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
      { slug: 'us-accountant', name: 'US Tax Pros', category: 'accountants', countries: ['US'], note: null },
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
  // Simulates a Supabase client whose `.select(columns)` call determines
  // which of `primary` (new `countries` column) or `legacy` (old `country`
  // column) result to hand back — mirroring the real fallback query the
  // resolver issues when the primary query fails with a missing-column error.
  function fakeSupabase(
    primary: { data: unknown; error: { code?: string; message?: string } | null },
    legacy?: { data: unknown; error: { code?: string; message?: string } | null }
  ) {
    return {
      from: (_table: 'affiliate_links') => ({
        select: (columns: string) => {
          const result = columns.includes('countries') ? primary : (legacy ?? primary)
          return {
            eq: (_col: string, _val: unknown) => ({
              not: (_col2: string, _op: string, _val2: unknown) => Promise.resolve(result),
            }),
          }
        },
      }),
    }
  }

  it('returns resolved rows on success', async () => {
    const supabase = fakeSupabase({
      data: [{ slug: 'us-accountant', name: 'US Tax Pros', category: 'accountants', countries: ['US'], note: null }],
      error: null,
    })
    const out = await resolveEssentialServices(supabase, 'US')
    expect(out.find(s => s.id === 'accountants')!.kind).toBe('affiliate')
  })

  it('falls back to the old `country` column when `countries` does not exist yet (42703)', async () => {
    const supabase = fakeSupabase(
      { data: null, error: { code: '42703', message: 'column "countries" does not exist' } },
      { data: [{ slug: 'us-accountant', name: 'US Tax Pros', category: 'accountants', country: 'US', note: null }], error: null }
    )
    const out = await resolveEssentialServices(supabase, 'US')
    const accountants = out.find(s => s.id === 'accountants')!
    expect(accountants.kind).toBe('affiliate')
    expect(accountants.name).toBe('US Tax Pros')
  })

  it('falls back to the old `country` column on a PostgREST schema-cache error (PGRST204)', async () => {
    const supabase = fakeSupabase(
      { data: null, error: { code: 'PGRST204' } },
      { data: [{ slug: 'global-accountant', name: 'Global Accountants Inc', category: 'accountants', country: null, note: null }], error: null }
    )
    const out = await resolveEssentialServices(supabase, 'NZ')
    expect(out.find(s => s.id === 'accountants')!.kind).toBe('affiliate')
  })

  it('degrades to all search links if both the primary and legacy fallback queries fail', async () => {
    const supabase = fakeSupabase(
      { data: null, error: { code: '42703', message: 'column "countries" does not exist' } },
      { data: null, error: { code: 'some-other-error' } }
    )
    const out = await resolveEssentialServices(supabase, 'US')
    expect(out.every(s => s.kind === 'search')).toBe(true)
  })

  it('degrades to all search links on a non-missing-column query error (no legacy fallback attempted)', async () => {
    const supabase = fakeSupabase({ data: null, error: { code: '42501', message: 'permission denied' } })
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
