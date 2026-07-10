import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { getSetting, setSetting } from '@/lib/app-settings'

// ── Smexy mode (the default look) ────────────────────────────────────────
//
// The .smexy class on <html> layers an aurora/glass treatment over the dark
// theme (globals.css "Smexy mode" section) and is the site's DEFAULT (baked
// into the SSR class list in layout.tsx). This flag is the admin kill
// switch: when disabled, the site reverts to the classic dark default, the
// toggle collapses to dark↔light, and smexy visitors demote to dark. It
// ships ON; the admin settings card exists precisely to back out if the look
// ever needs to go. getSetting returns null on any read failure, so a
// missing table/key degrades to the default rather than erroring.

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
