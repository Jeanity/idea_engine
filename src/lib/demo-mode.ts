import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { getSetting } from '@/lib/app-settings'

/** app_settings key for the sitewide demo switch (admin Settings page).
 *  While enabled, EVERY user's report/teaser runs on canned fixtures —
 *  no API spend anywhere. Prod-safety mirrors the per-user flag: nothing
 *  ever sets it except the ADMIN_EMAIL-gated /api/admin/demo-mode route. */
export const GLOBAL_DEMO_MODE_KEY = 'demo_mode_global'

interface GlobalDemoSetting {
  enabled: boolean
}

/** True when the sitewide demo switch is on. Requires the service client —
 *  app_settings has no RLS policies (service-role only, migration 013). */
export async function readGlobalDemoMode(service: SupabaseClient<Database>): Promise<boolean> {
  const setting = await getSetting<GlobalDemoSetting>(service, GLOBAL_DEMO_MODE_KEY)
  return setting?.enabled === true
}

/** 'mock' when the sitewide demo switch is on OR the idea owner has demo
 *  mode on, undefined otherwise. */
export async function providerOverrideForUser(supabase: SupabaseClient<Database>, userId: string) {
  if (await readGlobalDemoMode(supabase)) return 'mock' as const
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
