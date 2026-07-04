import { redirect } from 'next/navigation'
import { createDbClient } from '@/lib/db'
import { AppHeader } from '@/components/app-header'
import NewIdeaForm from './new-idea-form'

export const metadata = { title: 'New idea — Idea Engine' }

export default async function NewIdeaPage() {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  return (
    <main className="min-h-screen bg-gray-50">
      <AppHeader email={user.email!} />
      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Describe your idea</h1>
        <p className="text-gray-500 text-sm mb-8">
          Write it in plain language — as if you were explaining it to a friend.
        </p>
        <NewIdeaForm />
      </div>
    </main>
  )
}
