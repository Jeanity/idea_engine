import Link from 'next/link'
import { CookiePreferencesLink } from '@/components/cookie-preferences-link'
import { SOCIAL_LINKS } from '@/lib/site'

/**
 * Shared footer for public pages (homepage, /sample-report, /sign-in, and the
 * static pages) — server component, no data needs. NOT rendered on /app/*
 * (the signed-in shell) — see CLAUDE.md / the public-site-batch plan.
 */
export function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-white/10 bg-slate-950 px-6 py-12 light:border-gray-200 light:bg-white">
      <div className="mx-auto max-w-5xl">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <span className="font-semibold tracking-tight text-white light:text-gray-900">HadIdea</span>
            <p className="mt-2 text-xs text-slate-500 light:text-gray-400">
              Turn a raw idea into a researched, actionable report.
            </p>
            <a
              href={SOCIAL_LINKS.facebook}
              target="_blank"
              rel="noopener"
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors light:text-gray-500 light:hover:text-gray-900"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M13.5 21.9v-7.4h2.5l.5-3.1h-3V9.4c0-.9.3-1.6 1.6-1.6H16.6V5c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1v2.4H7.5v3.1h2.7v7.4a10 10 0 1 1 3.3 0Z" />
              </svg>
              Facebook
            </a>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 light:text-gray-400">
              Product
            </h3>
            <ul className="mt-3 space-y-2">
              <li>
                <Link href="/sample-report" className="text-sm text-slate-400 hover:text-white transition-colors light:text-gray-500 light:hover:text-gray-900">
                  Sample report
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-sm text-slate-400 hover:text-white transition-colors light:text-gray-500 light:hover:text-gray-900">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 light:text-gray-400">
              Company
            </h3>
            <ul className="mt-3 space-y-2">
              <li>
                <Link href="/about" className="text-sm text-slate-400 hover:text-white transition-colors light:text-gray-500 light:hover:text-gray-900">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-slate-400 hover:text-white transition-colors light:text-gray-500 light:hover:text-gray-900">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 light:text-gray-400">
              Legal
            </h3>
            <ul className="mt-3 space-y-2">
              <li>
                <Link href="/terms" className="text-sm text-slate-400 hover:text-white transition-colors light:text-gray-500 light:hover:text-gray-900">
                  Terms
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-sm text-slate-400 hover:text-white transition-colors light:text-gray-500 light:hover:text-gray-900">
                  Privacy
                </Link>
              </li>
              <li>
                <CookiePreferencesLink />
              </li>
            </ul>
          </div>
        </div>

        <p className="mt-10 text-xs text-slate-500 light:text-gray-400">
          © {year} HadIdea. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
