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
