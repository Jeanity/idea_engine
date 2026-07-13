import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { inngest } from '@/lib/inngest'
import { readServiceMode, writeServiceMode } from '@/lib/service-mode'
import { isMissingTable } from '@/lib/app-settings'
import { logError } from '@/lib/log-error'
import { NextResponse, type NextRequest } from 'next/server'

// Standard admin gate pattern (see src/app/api/admin/demo-mode/route.ts) —
// every admin API route re-checks isAdminEmail itself; the service client is
// only ever minted after the check passes.
async function requireAdmin() {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { denied: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }), email: null as string | null }
  if (!isAdminEmail(user.email)) return { denied: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), email: null as string | null }
  return { denied: null, email: user.email ?? null }
}

// Migration 029 not run yet degrades to 0 pending — the kill switch itself
// (app_settings 'service_mode') doesn't need this table, only the notify list does.
async function countPendingNotify(service: ReturnType<typeof createServiceClient>): Promise<number> {
  const { count, error } = await service
    .from('generation_notify')
    .select('id', { count: 'exact', head: true })
    .is('notified_at', null)

  if (error) {
    if (!isMissingTable(error)) console.error('Error counting pending notify rows:', error)
    return 0
  }
  return count ?? 0
}

export async function GET() {
  const { denied } = await requireAdmin()
  if (denied) return denied

  const service = createServiceClient()
  const paused = await readServiceMode(service)
  const pendingNotify = await countPendingNotify(service)

  return NextResponse.json({ paused, pendingNotify })
}

export async function POST(request: NextRequest) {
  const { denied, email } = await requireAdmin()
  if (denied) return denied

  const body = await request.json().catch(() => ({}))
  if (typeof body.paused !== 'boolean') {
    return NextResponse.json({ error: 'paused must be a boolean' }, { status: 400 })
  }

  const service = createServiceClient()
  const wasPaused = await readServiceMode(service)

  const { error } = await writeServiceMode(service, body.paused)
  if (error) {
    console.error('Error updating service mode:', error)
    await logError({
      source: 'api:admin/service-mode',
      message: `Update service mode failed: ${error}`,
      path: 'POST /api/admin/service-mode',
    })
    return NextResponse.json({ error: 'Failed to update service mode' }, { status: 500 })
  }

  console.log(`[admin] service mode ${body.paused ? 'PAUSED' : 'RESUMED'} by ${email}`)

  // Resuming (true → false) with users on the notify list fires the batched
  // mailer (src/lib/inngest/notify-engine-resumed.ts) — never on pause, and
  // never when nobody's waiting to be told.
  if (wasPaused && !body.paused) {
    const pendingNotify = await countPendingNotify(service)
    if (pendingNotify > 0) {
      await inngest.send({ name: 'idea-engine/engine.resumed', data: {} })
    }
  }

  return NextResponse.json({ ok: true, paused: body.paused })
}
