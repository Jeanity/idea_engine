import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

/** 'mock' when the idea owner has demo mode on, undefined otherwise. */
export async function providerOverrideForUser(supabase: SupabaseClient<Database>, userId: string) {
  const { data } = await supabase.from('profiles').select('demo_mode').eq('id', userId).single()
  return data?.demo_mode ? ('mock' as const) : undefined
}

/**
 * The owner's chosen full-report model, or undefined for the app default.
 * Only the ADMIN_EMAIL-gated /api/profile/report-model route can set this,
 * and it only affects reports on that account's own ideas — it exists so the
 * admin can compare model quality vs cost (admin Settings page).
 */
export async function reportModelForUser(supabase: SupabaseClient<Database>, userId: string): Promise<string | undefined> {
  const { data } = await supabase.from('profiles').select('report_model').eq('id', userId).single()
  return data?.report_model ?? undefined
}
