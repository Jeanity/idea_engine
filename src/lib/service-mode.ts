import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { getSetting, setSetting } from '@/lib/app-settings'

/** app_settings key for the engine kill switch (admin Settings page + the
 *  AppHeader "Engine paused" pill). While paused, the three generation POSTs
 *  (ideas, reports, reports/full) refuse new work up front — before any AI
 *  spend — with a 503 the client recognises via `service_mode: true`
 *  (src/components/service-notice.tsx). Admins bypass the pause so Danny can
 *  keep testing while it's on. */
export const SERVICE_MODE_KEY = 'service_mode'

interface ServiceModeSetting {
  paused: boolean
}

/** True when report generation is paused sitewide. Requires the service
 *  client — app_settings has no RLS policies (service-role only, migration
 *  013). Defaults to false (running) when unset or the migration hasn't run
 *  yet — same graceful-degradation stance as every other app_settings flag. */
export async function readServiceMode(service: SupabaseClient<Database>): Promise<boolean> {
  const setting = await getSetting<ServiceModeSetting>(service, SERVICE_MODE_KEY)
  return setting?.paused === true
}

export async function writeServiceMode(
  service: SupabaseClient<Database>,
  paused: boolean
): Promise<{ error: string | null }> {
  return setSetting(service, SERVICE_MODE_KEY, { paused })
}

// User-facing copy stays plain and warm; the admin bypass, the notify-list
// opt-in, and the batched resume email are mechanics that live in code
// comments, not in what the user reads (layered-disclosure standard).
export const SERVICE_MODE_MESSAGE =
  "The Engine is in for a quick service — new reports are paused while we tune it up. Back soon."
