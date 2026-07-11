import { redirect } from 'next/navigation'
import { createDbClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'

// Admin gate for the whole ad studio (/ad and every campaign slide under it)
// — mirrors src/app/app/admin/layout.tsx. Non-admins (signed in or not) are
// bounced to the homepage rather than a sign-in prompt, so the studio's
// existence isn't advertised. No shell chrome: slides must render bare for
// clean screenshots.
export default async function AdLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isAdminEmail(user.email)) {
    redirect('/')
  }

  return <>{children}</>
}
