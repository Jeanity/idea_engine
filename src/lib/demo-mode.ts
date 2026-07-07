import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

/** 'mock' when the idea owner has demo mode on, undefined otherwise. */
export async function providerOverrideForUser(supabase: SupabaseClient<Database>, userId: string) {
  const { data } = await supabase.from('profiles').select('demo_mode').eq('id', userId).single()
  return data?.demo_mode ? ('mock' as const) : undefined
}
