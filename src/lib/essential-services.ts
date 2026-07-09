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
//     rows — no I/O, unit-tested directly (country-match > global > search
//     fallback). A row's `countries` array can name multiple countries.
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
  /** Group id — see ESSENTIAL_SERVICE_GROUPS for display order/labels. */
  group: string
  /**
   * When present, this category only renders for reports whose idea
   * archetype is in this list. Absent = always shown. See
   * docs/plan/2026-07-09-getting-set-up-tab.md for the initial tuning.
   */
  archetypes?: string[]
}

export interface EssentialServiceGroup {
  id: string
  label: string
}

// Order = display order in the "Getting set up" tab.
export const ESSENTIAL_SERVICE_GROUPS: EssentialServiceGroup[] = [
  { id: 'get_set_up', label: 'Get set up' },
  { id: 'get_protected', label: 'Get protected' },
  { id: 'get_online', label: 'Get online' },
  { id: 'get_customers', label: 'Get customers' },
  { id: 'free_support', label: 'Free support' },
]

// All non-software archetypes — used below for categories that hide only for
// a couple of specific archetypes rather than opting in to a short list.
const ARCHETYPES_EXCEPT_SOFTWARE_AND_CONTENT = [
  'physical_product',
  'local_service',
  'ecommerce_brand',
  'marketplace',
  'invention',
  'other',
]

// Order = display order.
export const ESSENTIAL_SERVICE_CATEGORIES: EssentialServiceCategory[] = [
  {
    id: 'registration',
    heading: 'Business registration',
    blurb: 'Registering a business is free or low-cost directly through most governments — start there before paying a third party.',
    searchQuery: 'how to register a business',
    group: 'get_set_up',
  },
  {
    id: 'banking',
    heading: 'Business bank accounts',
    blurb: 'Keep business money separate from personal from your first sale.',
    searchQuery: 'business bank accounts',
    group: 'get_set_up',
  },
  {
    id: 'accountants',
    heading: 'Accountants & tax',
    blurb: 'Someone to keep your books straight and your tax filings on time.',
    searchQuery: 'accountants near me',
    group: 'get_set_up',
  },
  {
    id: 'accounting_software',
    heading: 'Accounting software',
    blurb: 'Track income and expenses from day one, without a spreadsheet.',
    searchQuery: 'small business accounting software',
    group: 'get_set_up',
  },
  {
    id: 'insurance',
    heading: 'Business insurance',
    blurb: 'Cover for liability, stock, or professional advice, depending on what you sell.',
    searchQuery: 'business insurance quotes',
    group: 'get_protected',
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
    group: 'get_protected',
  },
  {
    id: 'domain',
    heading: 'Domain name',
    blurb: 'A web address customers can find you at, registered in your business name.',
    searchQuery: 'domain name registration',
    group: 'get_online',
  },
  {
    id: 'website_diy',
    heading: 'Website — build it yourself',
    blurb: 'Drag-and-drop builders that get a simple site live without hiring anyone.',
    searchQuery: 'small business website builder',
    group: 'get_online',
  },
  {
    id: 'website_hire',
    heading: 'Website — hire a designer',
    blurb: 'When you’d rather pay someone to build it properly than do it yourself.',
    searchQuery: 'web designers near me',
    group: 'get_online',
  },
  {
    id: 'app_development',
    heading: 'App development',
    blurb: 'Developers and agencies who can build or contract-build your app.',
    searchQuery: 'app development services',
    group: 'get_online',
    archetypes: ['software_app', 'marketplace', 'invention'],
  },
  {
    id: 'branding',
    heading: 'Logo & branding',
    blurb: 'A logo and basic visual identity for packaging, signage, and your site.',
    searchQuery: 'logo design service',
    group: 'get_customers',
  },
  {
    id: 'promotional_material',
    heading: 'Promotional material',
    blurb: 'Business cards, flyers, and signage for when you’re out meeting customers.',
    searchQuery: 'business cards and flyers printing',
    group: 'get_customers',
    archetypes: ARCHETYPES_EXCEPT_SOFTWARE_AND_CONTENT,
  },
  {
    id: 'payments',
    heading: 'Taking payments',
    blurb: 'A card reader or online checkout so customers can actually pay you.',
    searchQuery: 'card payment reader small business',
    group: 'get_customers',
    archetypes: ['local_service', 'physical_product', 'ecommerce_brand', 'marketplace'],
  },
  {
    id: 'government_advisory',
    heading: 'Free government support',
    blurb: 'Many governments run free advisory services for new small businesses — worth checking before paying for advice.',
    searchQuery: 'free small business advice government',
    group: 'free_support',
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
  countries: string[] | null
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
  group: string
}

// The single 'website' category was replaced by website_diy/website_hire
// (see docs/plan/2026-07-09-getting-set-up-tab.md). Any affiliate row still
// tagged category='website' — pre-existing admin data — keeps working by
// mapping it onto website_diy rather than dropping it silently.
const LEGACY_CATEGORY_ALIASES: Record<string, string> = {
  website: 'website_diy',
}

/**
 * Pure selection logic — no I/O. Per category: prefer an affiliate row whose
 * `countries` array contains `countryCode`, else a global row (`countries` is
 * null or empty), else the Google search-link fallback. Rows without a
 * `category` (ordinary rewrite-style links) are ignored entirely. When `archetype` is given,
 * categories whose `archetypes` allowlist doesn't include it are omitted
 * entirely (rather than falling back to search) — categories with no
 * allowlist are always included. When `archetype` isn't supplied at all
 * (omitted/null/empty — callers predating this feature, or an idea with no
 * archetype yet), archetype-restricted categories are NOT hidden: the filter
 * only kicks in once we actually know the archetype.
 */
export function selectEssentialServices(
  rows: EssentialServiceAffiliateRow[],
  countryCode: string | null | undefined,
  archetype?: string | null
): ResolvedEssentialService[] {
  const cc = (countryCode ?? '').trim().toUpperCase()

  return ESSENTIAL_SERVICE_CATEGORIES
    .filter(cat => !cat.archetypes || !archetype || cat.archetypes.includes(archetype))
    .map(cat => {
      const candidates = rows.filter(r => (r.category ? (LEGACY_CATEGORY_ALIASES[r.category] ?? r.category) : r.category) === cat.id)
      const countrySpecific = cc
        ? candidates.find(r => (r.countries ?? []).some(code => (code ?? '').toUpperCase() === cc))
        : undefined
      const global = candidates.find(r => !r.countries || r.countries.length === 0)
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
          group: cat.group,
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
        group: cat.group,
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

// Postgres "column does not exist" / PostgREST "schema cache miss" — the
// signature of migration 017 not having run yet against this database.
const MISSING_COLUMN_ERROR_CODES = new Set(['42703', 'PGRST204'])

/**
 * I/O wrapper: fetches active, categorised affiliate_links rows and runs
 * them through selectEssentialServices. Three-tier degradation so this block
 * can NEVER crash a report render, and keeps working across the deploy ->
 * migration gap:
 *   1. Query the new `countries` column.
 *   2. If that errors specifically because the column doesn't exist yet
 *      (42703 / PGRST204 — migration 017 not run), fall back to querying the
 *      old `country` column and adapt each row into the `countries` shape.
 *   3. If THAT also errors (or throws), or step 1 errors for any other
 *      reason, degrade to selectEssentialServices([], ...) — every category
 *      falls back to its search link.
 */
export async function resolveEssentialServices(
  supabase: AffiliateLinksQueryable,
  countryCode: string | null | undefined,
  archetype?: string | null
): Promise<ResolvedEssentialService[]> {
  try {
    const { data, error } = await supabase
      .from('affiliate_links')
      .select('slug, name, category, countries, note')
      .eq('active', true)
      .not('category', 'is', null)

    if (!error) {
      return selectEssentialServices(data ?? [], countryCode, archetype)
    }

    if (!MISSING_COLUMN_ERROR_CODES.has(error.code)) {
      return selectEssentialServices([], countryCode, archetype)
    }

    // Pre-migration fallback: old single `country` column.
    try {
      const { data: legacyData, error: legacyError } = await supabase
        .from('affiliate_links')
        .select('slug, name, category, country, note')
        .eq('active', true)
        .not('category', 'is', null)

      if (legacyError) {
        return selectEssentialServices([], countryCode, archetype)
      }

      const adapted: EssentialServiceAffiliateRow[] = (legacyData ?? []).map(
        (r: { slug: string; name: string; category: string | null; country: string | null; note: string | null }) => ({
          slug: r.slug,
          name: r.name,
          category: r.category,
          countries: r.country ? [r.country] : null,
          note: r.note,
        })
      )
      return selectEssentialServices(adapted, countryCode, archetype)
    } catch {
      return selectEssentialServices([], countryCode, archetype)
    }
  } catch {
    return selectEssentialServices([], countryCode, archetype)
  }
}
