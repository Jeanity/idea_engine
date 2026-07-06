import Link from 'next/link'
import SignOutButton from '@/app/app/sign-out-button'
import { ThemeToggle } from '@/components/theme-toggle'
import { createDbClient } from '@/lib/db'

export async function AppHeader({ email }: { email: string }) {
  // A cheap count-only query — cheaper than threading an "hasIdeas" prop
  // through every one of the ~7 pages that render this header. "My ideas"
  // only makes sense to show once there's somewhere for it to take you.
  const supabase = await createDbClient()
  const { count } = await supabase
    .from('ideas')
    .select('id', { count: 'exact', head: true })
  const hasIdeas = (count ?? 0) > 0

  return (
    <header className="bg-slate-950/80 backdrop-blur border-b border-white/10 light:bg-white/80 light:border-gray-200 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/app" className="font-semibold text-white light:text-gray-900 hover:text-slate-200 light:hover:text-gray-700 transition-colors">
          Idea Engine
        </Link>
        <nav className="flex items-center gap-4">
          {hasIdeas && (
            <Link href="/app/account#your-ideas" className="text-sm text-slate-300 light:text-gray-600 hover:text-white light:hover:text-gray-900 font-medium transition-colors">
              My ideas
            </Link>
          )}
          <Link href="/app" className="text-sm text-slate-300 light:text-gray-600 hover:text-white light:hover:text-gray-900 font-medium transition-colors">
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
