import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

// Generic key/value helper over app_settings (migration 013). Both functions
// take an EXISTING service client — they must never create one themselves,
// so callers stay in control of when the RLS-bypassing client is minted (and
// keep that decision auditable at the call site, per the admin-gate pattern
// used everywhere else in this codebase).

// Postgres 42P01 = undefined_table, PostgREST PGRST205 = "table not found in
// schema cache" — both mean migration 013 hasn't been run yet.
export function isMissingTable(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

// Postgres 42703 = undefined_column — same graceful-degradation shape as
// isMissingTable, but for a column a pending migration hasn't added yet
// (e.g. surveys.promo_gate, migration 028). Callers typically retry the
// same select without the new column rather than failing outright.
export function isMissingColumn(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42703'
}

export async function getSetting<T>(
  service: SupabaseClient<Database>,
  key: string
): Promise<T | null> {
  const { data, error } = await service
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()

  if (error || !data) return null
  return data.value as T
}

export async function setSetting<T>(
  service: SupabaseClient<Database>,
  key: string,
  value: T
): Promise<{ error: string | null }> {
  const { error } = await service
    .from('app_settings')
    .upsert({ key, value: value as never, updated_at: new Date().toISOString() })

  if (error) return { error: error.message }
  return { error: null }
}
