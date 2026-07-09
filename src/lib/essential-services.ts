// "Your support team" — render-time essential-services block (Legal &
// Compliance tab, web + PDF).
//
// Binding constraint (see docs/plan/2026-07-09-essential-services-block.md):
// this is injected at render time, NEVER stored in report sections and NEVER
// touched by the AI pipeline. Zero AI cost; the category list below and the
// selection logic run fresh on every view, so a link added or removed in
// admin applies retroactively to every existing report.
//
// Two layers, split for testability:
//   - ESSENTIAL_SERVICE_CATEGORIES: the static, code-defined registry.
//   - selectEssentialServices: a PURE function over already-fetched affiliate
//     rows — no I/O, unit-tested directly (country-specific > global > search
//     fallback).
//   - resolveEssentialServices: the thin I/O wrapper (Supabase query) that
//     callers (report-page-content.tsx, the PDF route) actually use. Any
//     query error — including 42703/PGRST204 from the columns not existing
//     yet, pre-migration — degrades to selectEssentialServices([], ...), i.e.
//     every category falls back to its search link. This block must NEVER
//     crash a report.

export interface EssentialServiceCategory {
  id: string
  heading: string
  blurb: string
  searchQuery: string
  extraSearches?: { label: string; query: string }[]
}

// Order = display order.
export const ESSENTIAL_SERVICE_CATEGORIES: EssentialServiceCategory[] = [
  {
    id: 'accountants',
    heading: 'Accountants & tax',
    blurb: 'Someone to keep your books straight and your tax filings on time.',
    searchQuery: 'accountants near me',
  },
  {
    id: 'accounting_software',
    heading: 'Accounting software',
    blurb: 'Track income and expenses from day one, without a spreadsheet.',
    searchQuery: 'small business accounting software',
  },
  {
    id: 'legal',
    heading: 'Legal advice',
    blurb: 'Contracts, terms of service, and structure questions worth getting right early.',
    searchQuery: 'business lawyers near me',
    extraSearches: [
      { label: 'IP lawyers', query: 'IP lawyers near me' },
      { label: 'Trademark lawyers', query: 'trademark lawyers near me' },
    ],
  },
  {
    id: 'banking',
    heading: 'Business bank accounts',
    blurb: 'Keep business money separate from personal from your first sale.',
    searchQuery: 'business bank accounts',
  },
  {
    id: 'insurance',
    heading: 'Business insurance',
    blurb: 'Cover for liability, stock, or professional advice, depending on what you sell.',
    searchQuery: 'business insurance quotes',
  },
  {
    id: 'registration',
    heading: 'Business registration',
    blurb: 'Registering a business is free or low-cost directly through most governments — start there before paying a third party.',
    searchQuery: 'how to register a business',
  },
  {
    id: 'payments',
    heading: 'Taking payments',
    blurb: 'A card reader or online checkout so customers can actually pay you.',
    searchQuery: 'card payment reader small business',
  },
  {
    id: 'website',
    heading: 'Website & domain',
    blurb: 'A simple site and a domain name customers can find you at.',
    searchQuery: 'small business website builder',
  },
  {
    id: 'branding',
    heading: 'Logo & branding',
    blurb: 'A logo and basic visual identity for packaging, signage, and your site.',
    searchQuery: 'logo design service',
  },
  {
    id: 'promotional_material',
    heading: 'Promotional material',
    blurb: 'Business cards, flyers, and signage for when you’re out meeting customers.',
    searchQuery: 'business cards and flyers printing',
  },
  {
    id: 'government_advisory',
    heading: 'Free government support',
    blurb: 'Many governments run free advisory services for new small businesses — worth checking before paying for advice.',
    searchQuery: 'free small business advice government',
  },
]

export function searchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`
}

/** The narrow, safe shape read from affiliate_links for this feature. */
export interface EssentialServiceAffiliateRow {
  slug: string
  name: string
  category: string | null
  country: string | null
  note: string | null
}

export interface ResolvedExtraSearch {
  label: string
  href: string
}

export interface ResolvedEssentialService {
  id: string
  heading: string
  blurb: string
  kind: 'affiliate' | 'search'
  name: string
  href: string
  note: string | null
  extraSearches: ResolvedExtraSearch[]
}

/**
 * Pure selection logic — no I/O. Per category: prefer an affiliate row whose
 * `country` matches `countryCode`, else a global row (`country` is null),
 * else the Google search-link fallback. Rows without a `category` (ordinary
 * rewrite-style links) are ignored entirely.
 */
export function selectEssentialServices(
  rows: EssentialServiceAffiliateRow[],
  countryCode: string | null | undefined
): ResolvedEssentialService[] {
  const cc = (countryCode ?? '').trim().toUpperCase()

  return ESSENTIAL_SERVICE_CATEGORIES.map(cat => {
    const candidates = rows.filter(r => r.category === cat.id)
    const countrySpecific = cc ? candidates.find(r => (r.country ?? '').toUpperCase() === cc) : undefined
    const global = candidates.find(r => !r.country)
    const chosen = countrySpecific ?? global

    const extraSearches: ResolvedExtraSearch[] = (cat.extraSearches ?? []).map(e => ({
      label: e.label,
      href: searchUrl(e.query),
    }))

    if (chosen) {
      return {
        id: cat.id,
        heading: cat.heading,
        blurb: cat.blurb,
        kind: 'affiliate' as const,
        name: chosen.name,
        href: `/go/${chosen.slug}`,
        note: chosen.note,
        extraSearches,
      }
    }

    return {
      id: cat.id,
      heading: cat.heading,
      blurb: cat.blurb,
      kind: 'search' as const,
      name: `Search: ${cat.searchQuery}`,
      href: searchUrl(cat.searchQuery),
      note: null,
      extraSearches,
    }
  })
}

/**
 * Rewrites affiliate `/go/<slug>` hrefs to an absolute URL — the PDF route
 * needs this (react-pdf `Link` requires absolute hrefs); the web report page
 * can render the relative form as-is via next/navigation resolution. Search
 * hrefs are already absolute (google.com) and pass through unchanged.
 */
export function absolutizeEssentialServices(
  services: ResolvedEssentialService[],
  origin: string
): ResolvedEssentialService[] {
  const o = origin.replace(/\/+$/, '')
  return services.map(s => (s.kind === 'affiliate' ? { ...s, href: `${o}${s.href}` } : s))
}

// Any object exposing a Supabase-style `.from(table).select(cols).eq(...).not(...)`
// chain resolving to `{ data, error }`. Deliberately structural/untyped (not
// `SupabaseClient<Database>`) — checking the real generated client type against
// this narrow shape at every call site is what causes TS2589 "type
// instantiation is excessively deep" in the PDF route; callers pass either the
// real client (structurally compatible at runtime) or a test double.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AffiliateLinksQueryable = any

/**
 * I/O wrapper: fetches active, categorised affiliate_links rows and runs
 * them through selectEssentialServices. Degrades to an all-search-links
 * result on ANY query error (including the columns not existing yet,
 * pre-migration — Postgres 42703 / PostgREST PGRST204) — this block must
 * never crash a report render.
 */
export async function resolveEssentialServices(
  supabase: AffiliateLinksQueryable,
  countryCode: string | null | undefined
): Promise<ResolvedEssentialService[]> {
  try {
    const { data, error } = await supabase
      .from('affiliate_links')
      .select('slug, name, category, country, note')
      .eq('active', true)
      .not('category', 'is', null)

    if (error) {
      return selectEssentialServices([], countryCode)
    }
    return selectEssentialServices(data ?? [], countryCode)
  } catch {
    return selectEssentialServices([], countryCode)
  }
}
