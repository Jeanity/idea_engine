import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { GLOBAL_DEMO_MODE_KEY } from '@/lib/demo-mode'
import { setSetting } from '@/lib/app-settings'
import { NextResponse, type NextRequest } from 'next/server'

// Sitewide demo switch (app_settings, GLOBAL_DEMO_MODE_KEY). While on, every
// user's report/teaser runs on canned fixtures — zero API spend site-wide.
// Same admin-gate pattern as every admin API route: the /app/admin layout
// gates pages only, so this route re-checks isAdminEmail itself and only
// mints the service client after that check passes.
export async function POST(request: NextRequest) {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const { demo_mode } = body
  if (typeof demo_mode !== 'boolean') {
    return NextResponse.json({ error: 'demo_mode must be a boolean' }, { status: 400 })
  }

  const service = createServiceClient()
  const { error } = await setSetting(service, GLOBAL_DEMO_MODE_KEY, { enabled: demo_mode })
  if (error) {
    console.error('Error updating sitewide demo mode:', error)
    return NextResponse.json({ error: 'Failed to update sitewide demo mode' }, { status: 500 })
  }

  console.log(`[admin] sitewide demo mode ${demo_mode ? 'ON' : 'OFF'} by ${user.email}`)
  return NextResponse.json({ ok: true, demo_mode })
}
