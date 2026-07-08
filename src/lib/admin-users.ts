import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export interface AuthUserSummary {
  id: string
  email: string | null
  created_at: string
}

/**
 * Fetches every auth user via the paginated admin API (50/page, per Supabase
 * defaults) and flattens to a plain array. `supabase.auth.admin.listUsers()`
 * has no server-side search-by-email, so callers filter client-side after
 * this returns — fine at this project's current scale; revisit (or add a
 * Postgres RPC) if the user base grows into the thousands.
 *
 * Admin-only: never call this before an isAdminEmail check has passed.
 */
export async function listAllAuthUsers(
  service: SupabaseClient<Database>
): Promise<AuthUserSummary[]> {
  const perPage = 50
  const all: AuthUserSummary[] = []
  let page = 1
  // Safety cap so a pagination bug (or a stuck nextPage) can't loop forever.
  for (let i = 0; i < 200; i++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage })
    if (error || !data) break
    all.push(
      ...data.users.map(u => ({ id: u.id, email: u.email ?? null, created_at: u.created_at }))
    )
    if (!('nextPage' in data) || !data.nextPage || data.users.length < perPage) break
    page = data.nextPage
  }
  return all
}

/**
 * Looks up a bounded set of auth users by id (e.g. one paginated admin-users
 * page's worth of `profiles` rows) via the admin API's per-id lookup. Every
 * `profiles` row is 1:1 with an auth user (auto-provisioned by the
 * `on_auth_user_created` trigger, see `supabase/migrations/001_initial_schema.sql`),
 * so paging `profiles` first and resolving emails only for that page avoids
 * pulling every auth user (which itself paginates 50/page server-side) just
 * to render 25 rows. Keep `ids` small (a page, not the whole table) — this
 * is O(ids.length) admin API calls, not appropriate for bulk fetches.
 */
export async function getAuthUsersByIds(
  service: SupabaseClient<Database>,
  ids: string[]
): Promise<Map<string, AuthUserSummary>> {
  const found = await Promise.all(
    ids.map(async id => {
      const { data, error } = await service.auth.admin.getUserById(id)
      if (error || !data?.user) return null
      return { id: data.user.id, email: data.user.email ?? null, created_at: data.user.created_at }
    })
  )
  const map = new Map<string, AuthUserSummary>()
  for (const user of found) if (user) map.set(user.id, user)
  return map
}
