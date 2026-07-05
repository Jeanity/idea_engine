import Link from 'next/link'
import SignOutButton from '@/app/app/sign-out-button'
import { ThemeToggle } from '@/components/theme-toggle'

export function AppHeader({ email }: { email: string }) {
  return (
    <header className="bg-slate-950/80 backdrop-blur border-b border-white/10 light:bg-white/80 light:border-gray-200 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/app" className="font-semibold text-white light:text-gray-900 hover:text-slate-200 light:hover:text-gray-700 transition-colors">
          Idea Engine
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/app" className="text-sm text-slate-300 light:text-gray-600 hover:text-white light:hover:text-gray-900 font-medium transition-colors">
            My ideas
          </Link>
          <Link href="/app#new" className="text-sm text-slate-300 light:text-gray-600 hover:text-white light:hover:text-gray-900 font-medium transition-colors">
            New idea
          </Link>
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <ThemeToggle />
        <Link
          href="/app/account"
          className="text-sm text-slate-300 light:text-gray-600 hover:text-white light:hover:text-gray-900 font-medium transition-colors"
        >
          My account
        </Link>
        <SignOutButton />
      </div>
    </header>
  )
}
