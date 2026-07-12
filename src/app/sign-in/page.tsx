import { Suspense } from 'react'
import Link from 'next/link'
import { ThemeToggle } from '@/components/theme-toggle'
import { SiteFooter } from '@/components/site-footer'
import SignInForm from './sign-in-form'

// noindex: a sign-in form has no search value and dilutes the public pages.
export const metadata = { title: 'Sign in', robots: { index: false, follow: false } }

export default function SignInPage() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-slate-950 light:bg-gray-50">
      <div className="absolute inset-0 dot-grid opacity-40 light:opacity-40" aria-hidden="true" />

      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="animate-blob-1 absolute -top-32 -left-24 h-96 w-96 rounded-full bg-indigo-600/40 blur-3xl light:opacity-50" />
        <div className="animate-blob-2 absolute top-1/3 -right-24 h-[28rem] w-[28rem] rounded-full bg-violet-600/30 blur-3xl light:opacity-50" />
      </div>

      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <Link
              href="/"
              className="font-semibold tracking-tight text-white transition-colors hover:text-slate-200 light:text-gray-900 light:hover:text-gray-600"
            >
              HadIdea
            </Link>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-8 shadow-xl shadow-black/30 backdrop-blur light:border-gray-200 light:bg-white light:shadow-sm">
            <h1 className="mb-2 text-center text-2xl font-semibold text-white light:text-gray-900">Welcome back</h1>
            <p className="mb-8 text-center text-sm text-slate-400 light:text-gray-500">
              We&apos;ll email you a magic link — no password needed.
            </p>
            <Suspense>
              <SignInForm />
            </Suspense>
          </div>
        </div>
      </div>

      <div className="relative z-10">
        <SiteFooter />
      </div>
    </main>
  )
}
