import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { AnalyticsBeacon } from '@/components/analytics-beacon'
import { CookieConsentBanner } from '@/components/cookie-consent'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

export const metadata: Metadata = {
  title: 'HadIdea',
  description: 'Turn your raw business idea into a structured opportunity report.',
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
      </head>
      {/* suppressHydrationWarning: browser extensions inject attributes into
          <body> before React hydrates (e.g. data-cjcrx), which is noise —
          this only silences attribute mismatches on this one element. */}
      <body suppressHydrationWarning className="min-h-full flex flex-col bg-white text-gray-900">
        <AnalyticsBeacon />
        {children}
        <CookieConsentBanner />
      </body>
    </html>
  )
}
