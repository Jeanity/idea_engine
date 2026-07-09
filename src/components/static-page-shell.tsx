import Link from 'next/link'
import { HeaderAuthLink } from '@/components/header-auth-link'
import { ThemeToggle } from '@/components/theme-toggle'
import { SiteFooter } from '@/components/site-footer'

/**
 * Shared shell for narrow-prose public pages (/terms, /privacy, /about,
 * /faq): minimal header with wordmark linking home (mirrors /sample-report's
 * public header), a narrow content column, and the shared footer.
 */
export function StaticPageShell({
  title,
  intro,
  draftBanner,
  children,
}: {
  title: string
  intro?: string
  /** Shows the "Draft — under legal review" banner (Terms/Privacy). */
  draftBanner?: boolean
  children: React.ReactNode
}) {
  return (
    <main className="min-h-screen bg-slate-950 light:bg-gray-50">
      <header className="relative z-10 flex items-center justify-between border-b border-white/10 px-6 py-5 light:border-gray-200">
        <Link href="/" className="font-semibold tracking-tight text-white light:text-gray-900">
          Idea Engine
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <HeaderAuthLink />
        </div>
      </header>

      <div className="relative overflow-hidden bg-slate-950 light:bg-gray-50">
        <div className="absolute inset-0 dot-grid opacity-40 light:opacity-20" aria-hidden="true" />
        <div className="relative z-10 mx-auto max-w-2xl px-6 py-16">
          <h1 className="text-2xl font-semibold text-white sm:text-3xl light:text-gray-900">{title}</h1>
          {intro && <p className="mt-3 text-sm text-slate-400 light:text-gray-500">{intro}</p>}

          {draftBanner && (
            <div className="mt-6 rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 light:border-amber-200 light:bg-amber-50">
              <p className="text-sm font-medium text-amber-200 light:text-amber-900">
                Draft — under legal review. This page describes our current practice but has not yet
                been finalised by a lawyer.
              </p>
            </div>
          )}

          <div className="mt-10 space-y-8 text-sm leading-relaxed text-slate-300 light:text-gray-700">
            {children}
          </div>
        </div>
      </div>

      <SiteFooter />
    </main>
  )
}
