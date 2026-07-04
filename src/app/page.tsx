import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <span className="font-semibold tracking-tight text-gray-900">Idea Engine</span>
        <Link
          href="/sign-in"
          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
        >
          Sign in
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="max-w-2xl">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-indigo-600 mb-4">
            Coming soon
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight mb-6">
            From raw idea to opportunity report in minutes
          </h1>
          <p className="text-lg text-gray-500 mb-10 max-w-xl mx-auto">
            Describe your business idea. We classify it, ask the right questions, research your
            market, and deliver a structured report — competitor analysis, cost breakdown, and
            next steps included.
          </p>
          <Link
            href="/sign-in"
            className="inline-block rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold
                       text-white hover:bg-indigo-700 focus:outline-none focus:ring-2
                       focus:ring-indigo-500 focus:ring-offset-2"
          >
            Get early access
          </Link>
        </div>
      </main>

      <footer className="border-t border-gray-100 px-6 py-5 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} Idea Engine. All rights reserved.
      </footer>
    </div>
  )
}
