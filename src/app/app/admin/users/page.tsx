import Link from 'next/link'
import { createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { listAllAuthUsers } from '@/lib/admin-users'
import { UsersClient, type UserRow } from './users-client'

export const metadata = { title: 'Users — Admin — Idea Engine' }

// This page lives under src/app/app/admin/, whose layout.tsx already gates
// on isAdminEmail (redirects non-admins to /app before this ever renders).
// Reading other users' data via createServiceClient AND calling the auth
// admin API here is safe BECAUSE that gate already ran — never do either
// before it, and never in a client component.

function countByOwner(rows: { owner_id: string }[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of rows) m.set(r.owner_id, (m.get(r.owner_id) ?? 0) + 1)
  return m
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const query = (q ?? '').trim().toLowerCase()

  const service = createServiceClient()

  const [authUsers, profilesRes, ideasRes, reportsRes] = await Promise.all([
    listAllAuthUsers(service),
    service.from('profiles').select('id, username, display_name, created_at, last_seen_at'),
    service.from('ideas').select('id, owner_id'),
    service.from('reports').select('id, owner_id'),
  ])

  const profileById = new Map((profilesRes.data ?? []).map(p => [p.id, p]))
  const ideaCounts = countByOwner(ideasRes.data ?? [])
  const reportCounts = countByOwner(reportsRes.data ?? [])

  const rows: UserRow[] = authUsers
    .map(u => {
      const profile = profileById.get(u.id)
      return {
        id: u.id,
        email: u.email,
        username: profile?.username ?? null,
        displayName: profile?.display_name ?? null,
        createdAt: profile?.created_at ?? u.created_at,
        lastSeenAt: profile?.last_seen_at ?? null,
        ideaCount: ideaCounts.get(u.id) ?? 0,
        reportCount: reportCounts.get(u.id) ?? 0,
        isAdmin: isAdminEmail(u.email),
      }
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

  const visible = query
    ? rows.filter(
        r =>
          (r.email ?? '').toLowerCase().includes(query) ||
          (r.username ?? '').toLowerCase().includes(query) ||
          (r.displayName ?? '').toLowerCase().includes(query)
      )
    : rows

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white light:text-gray-900 mb-1">Users</h1>
      <p className="text-sm text-slate-400 light:text-gray-500 mb-6">
        {rows.length} account{rows.length === 1 ? '' : 's'} total.
      </p>

      <form action="/app/admin/users" method="GET" className="flex items-center gap-2 mb-6">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search by email, username, or name"
          className="w-full sm:w-80 rounded-lg border border-white/10 bg-slate-950/60 light:bg-white light:border-gray-300 px-3 py-2 text-sm text-white light:text-gray-900 placeholder:text-slate-600 light:placeholder:text-gray-400 focus:outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          className="text-sm font-medium px-4 py-2 rounded-lg border border-white/10 text-slate-300 hover:border-white/20 light:border-gray-200 light:text-gray-600 light:hover:border-gray-300"
        >
          Search
        </button>
        {query && (
          <Link href="/app/admin/users" className="text-sm text-slate-400 hover:text-white light:text-gray-500 light:hover:text-gray-900">
            Clear
          </Link>
        )}
      </form>

      <UsersClient users={visible} />
    </div>
  )
}
