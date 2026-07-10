import { createDbClient } from '@/lib/db'
import { redirect } from 'next/navigation'
import { AppHeader } from '@/components/app-header'
import { ReportPageContent } from './report-page-content'

export const metadata = { title: 'Report — HadIdea' }

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  return (
    <main className="min-h-screen bg-slate-950 light:bg-gray-50">
      <AppHeader email={user.email!} />
      <ReportPageContent id={id} />
    </main>
  )
}
