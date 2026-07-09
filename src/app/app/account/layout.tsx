import { redirect } from 'next/navigation'
import { createDbClient } from '@/lib/db'
import { AccountShell } from './account-shell'

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in')

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name')
    .eq('id', user.id)
    .single()

  // Username-first public identity (src/lib/public-name.ts precedence).
  const identityName = profile?.username ?? profile?.display_name ?? user.email!

  // Server component keeps the auth gate; the sidebar/topbar chrome is a
  // client shell rendered inside it. Account pages render as `children`.
  return (
    <AccountShell email={user.email!} identityName={identityName}>
      {children}
    </AccountShell>
  )
}
