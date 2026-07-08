import Link from 'next/link'
import { createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { listAllAuthUsers, getAuthUsersByIds, type AuthUserSummary } from '@/lib/admin-users'
import { Pagination } from '@/components/admin'
import { ADMIN_PAGE_SIZE, pageRange, parsePage, totalPageCount } from '@/lib/admin-pagination'
import { UsersClient, type UserRow } from './users-client'

export const metadata = { title: 'Users — Admin — Idea Engine' }

// This page lives under src/app/app/admin/, whose layout.tsx already gates
// on isAdminEmail (redirects non-admins to /app before this ever renders).
// Reading other users' data via createServiceClient AND calling the auth
// admin API here is safe BECAUSE that gate already ran — never do either
// before it, and never in a client component.

interface ProfileRow {
  id: string
  username: string | null
  display_name: string | null
  created_at: string
  last_seen_at: string | null
}

function countByOwner(rows: { owner_id: string }[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of rows) m.set(r.owner_id, (m.get(r.owner_id) ?? 0) + 1)
  return m
}

function toRow(
  profile: ProfileRow,
  authUser: AuthUserSummary | undefined,
  ideaCounts: Map<string, number>,
  reportCounts: Map<string, number>
): UserRow {
  const email = authUser?.email ?? null
  return {
    id: profile.id,
    email,
    username: profile.username,
    displayName: profile.display_name,
    createdAt: profile.created_at ?? authUser?.created_at ?? new Date(0).toISOString(),
    lastSeenAt: profile.last_seen_at,
    ideaCount: ideaCounts.get(profile.id) ?? 0,
    reportCount: reportCounts.get(profile.id) ?? 0,
    isAdmin: isAdminEmail(email),
  }
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const { q, page: pageParam } = await searchParams
  const query = (q ?? '').trim().toLowerCase()
  const page = parsePage(pageParam)
  const { from, to } = pageRange(page)

  const service = createServiceClient()

  let rows: UserRow[]
  let grandTotal: number
  let viewTotal: number

  if (query) {
    // Search spans email, which only exists in the auth admin API (not the
    // `profiles` table), so a true .range() query can't filter on it. This
    // branch pulls every user + profile (bounded, see listAllAuthUsers'
    // safety cap — fine at this project's current scale) and paginates the
    // *filtered, in-memory* result. Plain browsing (no query) uses the
    // cheaper DB-paginated path below instead.
    const [authUsers, profilesRes, ideasRes, reportsRes] = await Promise.all([
      listAllAuthUsers(service),
      service.from('profiles').select('id, username, display_name, created_at, last_seen_at'),
      service.from('ideas').select('id, owner_id'),
      service.from('reports').select('id, owner_id'),
    ])

    const authById = new Map(authUsers.map(u => [u.id, u]))
    const profiles = (profilesRes.data ?? []) as ProfileRow[]
    const ideaCounts = countByOwner(ideasRes.data ?? [])
    const reportCounts = countByOwner(reportsRes.data ?? [])

    const allRows = profiles
      .map(p => toRow(p, authById.get(p.id), ideaCounts, reportCounts))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

    grandTotal = allRows.length

    const filtered = allRows.filter(
      r =>
        (r.email ?? '').toLowerCase().includes(query) ||
        (r.username ?? '').toLowerCase().includes(query) ||
        (r.displayName ?? '').toLowerCase().includes(query)
    )
    viewTotal = filtered.length
    rows = filtered.slice(from, to + 1)
  } else {
    // No search: page `profiles` directly (1:1 with auth users via the
    // `on_auth_user_created` trigger) and resolve emails + counts only for
    // this page's ids — avoids loading every auth user / idea / report row
    // just to render 25.
    const { count } = await service.from('profiles').select('id', { count: 'exact', head: true })
    grandTotal = count ?? 0
    viewTotal = grandTotal

    const { data: profilesData } = await service
      .from('profiles')
      .select('id, username, display_name, created_at, last_seen_at')
      .order('created_at', { ascending: false })
      .range(from, to)

    const profiles = (profilesData ?? []) as ProfileRow[]
    const pageIds = profiles.map(p => p.id)

    const [authById, ideasRes, reportsRes] = await Promise.all([
      pageIds.length ? getAuthUsersByIds(service, pageIds) : Promise.resolve(new Map<string, AuthUserSummary>()),
      pageIds.length
        ? service.from('ideas').select('id, owner_id').in('owner_id', pageIds)
        : Promise.resolve({ data: [] as { id: string; owner_id: string }[] }),
      pageIds.length
        ? service.from('reports').select('id, owner_id').in('owner_id', pageIds)
        : Promise.resolve({ data: [] as { id: string; owner_id: string }[] }),
    ])

    const ideaCounts = countByOwner(ideasRes.data ?? [])
    const reportCounts = countByOwner(reportsRes.data ?? [])

    rows = profiles.map(p => toRow(p, authById.get(p.id), ideaCounts, reportCounts))
  }

  const pages = totalPageCount(viewTotal)

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white light:text-gray-900 mb-1">Users</h1>
      <p className="text-sm text-slate-400 light:text-gray-500 mb-6">
        {grandTotal} account{grandTotal === 1 ? '' : 's'} total.
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

      <UsersClient users={rows} />

      {viewTotal > ADMIN_PAGE_SIZE && (
        <Pagination
          page={page}
          totalPages={pages}
          totalCount={viewTotal}
          basePath="/app/admin/users"
          searchParams={{ q: q || undefined }}
        />
      )}
    </div>
  )
}
