import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { AnalyticsBeacon } from '@/components/analytics-beacon'
import { CookieConsentBanner } from '@/components/cookie-consent'
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, SOCIAL_LINKS } from '@/lib/site'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

const DEFAULT_TITLE = 'HadIdea — Turn Your Business Idea into a Real Plan'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    // Child pages set a bare title ("FAQ") — never append "— HadIdea"
    // themselves, this template does it.
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  // Google ignores the keywords tag; some smaller engines and AI crawlers
  // still read it. The real targeting lives in titles, descriptions, page
  // copy, and the JSON-LD below.
  keywords: [
    'business idea',
    'validate business idea',
    'business plan from an idea',
    'AI business plan',
    'how to start a business with an idea',
    'turn my idea into a business',
    'is my business idea viable',
    'startup costs',
    'competitor research',
    'make my idea real',
  ],
  // './' resolves per-page against metadataBase — every page gets a
  // self-referencing canonical without repeating it in child metadata.
  alternates: { canonical: './' },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    url: './',
    title: DEFAULT_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: DEFAULT_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: { index: true, follow: true },
}

// Site-wide identity for search engines and AI assistants. Product-level
// schema (SoftwareApplication with the offer) lives on the homepage.
const IDENTITY_JSONLD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/icon.svg`,
      sameAs: [SOCIAL_LINKS.facebook],
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning on <html>: the theme init script below swaps
    // theme classes before hydration when the visitor opted out of the default.
    // Smexy is the default look, so it's baked into the SSR class list — the
    // script only ever removes it (light preference, or admin kill switch).
    <html lang="en" suppressHydrationWarning className={`${geist.variable} h-full antialiased smexy`}>
      <head>
        {/* Apply the saved preference before paint (no flash). 'smexy_off' is
            ThemeToggle's cached copy of the admin kill switch — when the
            switch is off the default falls back to classic dark (first load
            after the flip still paints smexy once; ThemeToggle then demotes
            and caches). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var el=document.documentElement,t=localStorage.getItem('theme');if(t==='light'){el.classList.remove('smexy');el.classList.add('light')}else if(localStorage.getItem('smexy_off')==='1')el.classList.remove('smexy')}catch(e){}`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(IDENTITY_JSONLD) }}
        />
      </head>
      {/* suppressHydrationWarning: browser extensions inject attributes into
          <body> before React hydrates (e.g. data-cjcrx), which is noise —
          this only silences attribute mismatches on this one element. */}
      <body suppressHydrationWarning className="min-h-full flex flex-col bg-white text-gray-900">
        {/* Smexy-mode roaming aurora blobs — display:none outside .smexy
            (globals.css "Smexy mode" section). Four <i> wrappers animate X,
            their ::before blobs animate Y. */}
        <div className="smexy-aurora" aria-hidden="true">
          <i /><i /><i /><i />
        </div>
        <AnalyticsBeacon />
        {children}
        <CookieConsentBanner />
      </body>
    </html>
  )
}
