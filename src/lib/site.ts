// Canonical site identity — single source for SEO surfaces (metadata,
// robots.ts, sitemap.ts, JSON-LD, llms.txt copy) so the domain and brand
// lines can never drift between them.

export const SITE_URL = 'https://hadidea.com'

export const SITE_NAME = 'HadIdea'

/** The one-line brand statement (matches the ad campaigns' What-we-do slide). */
export const SITE_TAGLINE = 'Have an idea? Make it real.'

/** Default meta description — also the quotable summary AI assistants see. */
export const SITE_DESCRIPTION =
  'Have an idea? Make it real. We research your business idea for real — competitors, costs, legal, funding — and turn it into a scored, actionable plan in minutes.'

/** Social profiles (Organization JSON-LD sameAs + footer links). */
export const SOCIAL_LINKS = {
  facebook: 'https://www.facebook.com/makeyourideareal/',
}

/** GA4 Measurement ID (Danny's "HadIdea site" web stream, created
 *  2026-07-14). Public by nature — it ships in page HTML on every GA site.
 *  Loaded ONLY behind analytics consent; see components/google-analytics.tsx. */
export const GA_MEASUREMENT_ID = 'G-GJPHMDFNXD'
