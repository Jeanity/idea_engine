import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

export const metadata: Metadata = {
  title: 'Idea Engine',
  description: 'Turn your raw business idea into a structured opportunity report.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      {/* suppressHydrationWarning: browser extensions inject attributes into
          <body> before React hydrates (e.g. data-cjcrx), which is noise —
          this only silences attribute mismatches on this one element. */}
      <body suppressHydrationWarning className="min-h-full flex flex-col bg-white text-gray-900">{children}</body>
    </html>
  )
}
