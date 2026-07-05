import Link from 'next/link'
import SignOutButton from '@/app/app/sign-out-button'

export function AppHeader({ email }: { email: string }) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/app" className="font-semibold text-gray-900 hover:text-indigo-600 transition-colors">
          Idea Engine
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/app" className="text-sm text-gray-600 hover:text-indigo-600 font-medium transition-colors">
            My ideas
          </Link>
          <Link href="/app#new" className="text-sm text-gray-600 hover:text-indigo-600 font-medium transition-colors">
            New idea
          </Link>
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <Link
          href="/app/account"
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          {email}
        </Link>
        <SignOutButton />
      </div>
    </header>
  )
}
