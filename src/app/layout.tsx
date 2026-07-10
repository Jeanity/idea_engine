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
    // suppressHydrationWarning on <html>: the theme init script below adds
    // the .light class before hydration when the user opted into light mode.
    <html lang="en" suppressHydrationWarning className={`${geist.variable} h-full antialiased`}>
      <head>
        {/* Dark is the default; apply the saved light/smexy preference before
            paint (no flash). If smexy has been disabled by the admin since the
            visitor saved it, ThemeToggle demotes them to dark after mount. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(t==='light')document.documentElement.classList.add('light');else if(t==='smexy')document.documentElement.classList.add('smexy')}catch(e){}`,
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
