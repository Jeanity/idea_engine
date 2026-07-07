// Affiliate link rewrite engine (Block 4) — PURE, no I/O, no LLM calls.
//
// Applied at DELIVERY time (web report page load + PDF route), never at report
// generation time, so links added later apply to old reports and removed
// partnerships disappear retroactively.
//
// v1 scope: DOMAIN MATCHING ONLY. Deep-walk the report sections JSON; any string
// value that is an http(s) URL whose host matches one of a link's match_domains
// is replaced with `${origin}/go/${slug}?ctx=report:${ideaId}`. Non-URL strings
// are left untouched, and an already-rewritten /go/ URL is never touched again.
//
// `match_terms` (plain-text mentions with no URL) is an explicit v2 stretch and
// is intentionally NOT implemented here.

export interface AffiliateLink {
  slug: string
  match_domains: string[]
}

/** Parse an http(s) URL, or null if the string isn't one. */
function asHttpUrl(value: string): URL | null {
  // Cheap pre-check: URL() is lenient (e.g. accepts "mailto:", "a:b"), and we
  // only ever want to rewrite absolute web links.
  if (!/^https?:\/\//i.test(value)) return null
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u : null
  } catch {
    return null
  }
}

/**
 * Host match: exact, or a subdomain of the entry. "vistaprint.com" matches
 * "vistaprint.com" and "www.vistaprint.com" but NOT "notvistaprint.com".
 * Case-insensitive; a leading dot on the entry is tolerated.
 */
function hostMatchesDomain(host: string, domain: string): boolean {
  const h = host.toLowerCase()
  const d = domain.toLowerCase().replace(/^\.+/, '').replace(/\.+$/, '')
  if (!d) return false
  return h === d || h.endsWith('.' + d)
}

/** First link whose any match_domain matches the URL's host, else null. */
function findMatchingLink(url: URL, links: AffiliateLink[]): AffiliateLink | null {
  for (const link of links) {
    for (const domain of link.match_domains ?? []) {
      if (hostMatchesDomain(url.hostname, domain)) return link
    }
  }
  return null
}

function normaliseOrigin(origin: string): string {
  return origin.replace(/\/+$/, '')
}

/**
 * Rewrite a single string if it's a matching, not-already-rewritten URL.
 * Returns the (possibly unchanged) string.
 */
function rewriteString(value: string, links: AffiliateLink[], origin: string, ideaId: string): string {
  const url = asHttpUrl(value)
  if (!url) return value
  // Never double-rewrite an already-/go/ link (regardless of host).
  if (url.pathname.startsWith('/go/')) return value
  const link = findMatchingLink(url, links)
  if (!link) return value
  return `${normaliseOrigin(origin)}/go/${link.slug}?ctx=report:${ideaId}`
}

/**
 * Deep-walk any JSON-shaped value, rewriting matching URL strings. Immutable —
 * returns a new structure and never mutates the input.
 */
function rewriteValue(value: unknown, links: AffiliateLink[], origin: string, ideaId: string): unknown {
  if (typeof value === 'string') {
    return rewriteString(value, links, origin, ideaId)
  }
  if (Array.isArray(value)) {
    return value.map(item => rewriteValue(item, links, origin, ideaId))
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = rewriteValue(v, links, origin, ideaId)
    }
    return out
  }
  // number | boolean | null | undefined — untouched.
  return value
}

/**
 * Rewrite affiliate URLs inside a report `sections` object.
 *
 * @param sections The report sections JSON (deep-walked, not mutated).
 * @param links    Active affiliate links (slug + match_domains).
 * @param origin   Absolute origin, e.g. "https://ideaengine.app" (trailing slash tolerated).
 * @param ideaId   The idea id, embedded as `ctx=report:<ideaId>` for click attribution.
 * @returns A new sections object with matching URLs swapped for /go/<slug> links.
 */
export function rewriteAffiliateUrls(
  sections: Record<string, unknown>,
  links: AffiliateLink[],
  origin: string,
  ideaId: string
): Record<string, unknown> {
  // No links, or nothing to walk → cheap identity return.
  if (!sections || !links || links.length === 0) return sections
  return rewriteValue(sections, links, origin, ideaId) as Record<string, unknown>
}
