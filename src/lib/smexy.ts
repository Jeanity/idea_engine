import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { getSetting, setSetting } from '@/lib/app-settings'

// ── Smexy mode (third theme) ─────────────────────────────────────────────
//
// The .smexy class on <html> layers an aurora/glass treatment over the dark
// theme (globals.css "Smexy mode" section). This flag is the admin kill
// switch: when disabled, ThemeToggle stops offering the mode and demotes
// visitors who had it saved back to dark. Default is ON — it ships visible,
// and the admin settings card exists precisely to turn it off if it
// underwhelms. getSetting returns null on any read failure, so a missing
// table/key degrades to the default rather than erroring.

export const SMEXY_KEY = 'smexy_theme'

export interface SmexyConfig {
  enabled: boolean
}

export const DEFAULT_SMEXY: SmexyConfig = { enabled: true }

export async function readSmexyConfig(service: SupabaseClient<Database>): Promise<SmexyConfig> {
  const raw = await getSetting<Partial<SmexyConfig>>(service, SMEXY_KEY)
  return { ...DEFAULT_SMEXY, ...(raw ?? {}) }
}

export async function writeSmexyConfig(
  service: SupabaseClient<Database>,
  config: SmexyConfig
): Promise<{ error: string | null }> {
  return setSetting(service, SMEXY_KEY, config)
}
