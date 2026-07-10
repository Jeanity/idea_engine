import { describe, it, expect } from 'vitest'
import { rewriteAffiliateUrls, type AffiliateLink } from '@/lib/affiliate-rewrite'

const ORIGIN = 'https://hadidea.com'
const IDEA = 'idea-123'

const links: AffiliateLink[] = [
  { slug: 'vistaprint', match_domains: ['vistaprint.com', 'vistaprint.co.uk'] },
  { slug: 'shopify', match_domains: ['shopify.com'] },
]

function go(slug: string) {
  return `${ORIGIN}/go/${slug}?ctx=report:${IDEA}`
}

describe('rewriteAffiliateUrls — domain matching', () => {
  it('rewrites a top-level matching URL string', () => {
    const out = rewriteAffiliateUrls({ url: 'https://vistaprint.com/business-cards' }, links, ORIGIN, IDEA)
    expect(out).toEqual({ url: go('vistaprint') })
  })

  it('matches subdomains (www.) of a match_domain', () => {
    const out = rewriteAffiliateUrls({ url: 'https://www.vistaprint.com/x' }, links, ORIGIN, IDEA)
    expect(out).toEqual({ url: go('vistaprint') })
  })

  it('matches deep subdomains', () => {
    const out = rewriteAffiliateUrls({ url: 'https://shop.eu.shopify.com/a/b' }, links, ORIGIN, IDEA)
    expect(out).toEqual({ url: go('shopify') })
  })

  it('does NOT match a look-alike domain (notvistaprint.com)', () => {
    const input = { url: 'https://notvistaprint.com/x' }
    const out = rewriteAffiliateUrls(input, links, ORIGIN, IDEA)
    expect(out).toEqual(input)
  })

  it('does NOT match a domain where the entry is a suffix substring but not a label boundary', () => {
    // "myvistaprint.com" ends with "vistaprint.com" as a string but not on a dot boundary
    const input = { url: 'https://myvistaprint.com' }
    const out = rewriteAffiliateUrls(input, links, ORIGIN, IDEA)
    expect(out).toEqual(input)
  })

  it('matches the alternate ccTLD domain (vistaprint.co.uk)', () => {
    const out = rewriteAffiliateUrls({ url: 'https://vistaprint.co.uk/p' }, links, ORIGIN, IDEA)
    expect(out).toEqual({ url: go('vistaprint') })
  })
})

describe('rewriteAffiliateUrls — nested structures', () => {
  it('walks nested objects and arrays, rewriting only matching URL strings', () => {
    const input = {
      competitors: [
        { name: 'Vistaprint', url: 'https://vistaprint.com/a', location: 'US' },
        { name: 'Local Printer', url: 'https://localprint.example/x' },
      ],
      marketing_plan: {
        channels: [
          { name: 'Shopify store', link: 'https://shopify.com/start' },
          { name: 'Instagram', link: null },
        ],
      },
    }
    const out = rewriteAffiliateUrls(input, links, ORIGIN, IDEA) as typeof input
    expect(out.competitors[0].url).toBe(go('vistaprint'))
    expect(out.competitors[0].name).toBe('Vistaprint') // display text untouched
    expect(out.competitors[1].url).toBe('https://localprint.example/x') // no match
    expect(out.marketing_plan.channels[0].link).toBe(go('shopify'))
    expect(out.marketing_plan.channels[1].link).toBeNull()
  })

  it('does not mutate the input object', () => {
    const input = { url: 'https://vistaprint.com/a' }
    const snapshot = JSON.parse(JSON.stringify(input))
    rewriteAffiliateUrls(input, links, ORIGIN, IDEA)
    expect(input).toEqual(snapshot)
  })
})

describe('rewriteAffiliateUrls — non-URL and edge strings', () => {
  it('leaves plain (non-URL) strings alone even if they mention a domain', () => {
    const input = { text: 'Print business cards at vistaprint.com for cheap' }
    const out = rewriteAffiliateUrls(input, links, ORIGIN, IDEA)
    expect(out).toEqual(input)
  })

  it('ignores non-http protocols (mailto:, ftp:)', () => {
    const input = { a: 'mailto:hi@vistaprint.com', b: 'ftp://vistaprint.com/f' }
    const out = rewriteAffiliateUrls(input, links, ORIGIN, IDEA)
    expect(out).toEqual(input)
  })

  it('preserves numbers, booleans, and null', () => {
    const input = { score: 4, ok: true, missing: null, nested: { n: 2 } }
    const out = rewriteAffiliateUrls(input, links, ORIGIN, IDEA)
    expect(out).toEqual(input)
  })
})

describe('rewriteAffiliateUrls — already rewritten', () => {
  it('does not double-rewrite an existing /go/ URL', () => {
    const input = { url: `${ORIGIN}/go/vistaprint?ctx=report:old` }
    const out = rewriteAffiliateUrls(input, links, ORIGIN, IDEA)
    expect(out).toEqual(input)
  })

  it('does not rewrite a /go/ path even on a matching host', () => {
    // hypothetical: a /go/ link that happens to sit on a match_domain host
    const input = { url: 'https://vistaprint.com/go/vistaprint?ctx=x' }
    const out = rewriteAffiliateUrls(input, links, ORIGIN, IDEA)
    expect(out).toEqual(input)
  })
})

describe('rewriteAffiliateUrls — no-op cases', () => {
  it('returns sections unchanged when there are no links', () => {
    const input = { url: 'https://vistaprint.com/a' }
    expect(rewriteAffiliateUrls(input, [], ORIGIN, IDEA)).toEqual(input)
  })

  it('tolerates a trailing slash on origin', () => {
    const out = rewriteAffiliateUrls({ url: 'https://vistaprint.com/a' }, links, ORIGIN + '/', IDEA)
    expect(out).toEqual({ url: go('vistaprint') })
  })

  it('passes through when no URL matches any link', () => {
    const input = { url: 'https://example.com/nothing' }
    expect(rewriteAffiliateUrls(input, links, ORIGIN, IDEA)).toEqual(input)
  })
})
