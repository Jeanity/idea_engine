import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { AnalyticsBeacon } from '@/components/analytics-beacon'
import { CookieConsentBanner } from '@/components/cookie-consent'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

export const metadata: Metadata = {
  title: 'Idea Engine',
  description: 'Turn your raw business idea into a structured opportunity report.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning on <html>: the theme init script below adds
    // the .light class before hydration when the user opted into light mode.
    <html lang="en" suppressHydrationWarning className={`${geist.variable} h-full antialiased`}>
      <head>
        {/* Dark is the default; apply saved light preference before paint (no flash). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('theme')==='light')document.documentElement.classList.add('light')}catch(e){}`,
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
