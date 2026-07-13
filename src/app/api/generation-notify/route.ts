import { createDbClient, createServiceClient } from '@/lib/db'
import { isMissingTable } from '@/lib/app-settings'
import { logError } from '@/lib/log-error'
import { NextResponse } from 'next/server'

// Opt-in for the "email me when it's back on" button on ServiceNotice
// (src/components/service-notice.tsx). Signed-in users only — no admin gate,
// this is for regular users hitting the engine kill switch's 503. Accepted
// even when service mode is already off: the row just sits pending (picked
// up on the next resume, or never) — that's harmless, so this never errors
// on that account.
export async function POST() {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!user.email) {
    return NextResponse.json({ error: 'No email on this account.' }, { status: 400 })
  }

  const service = createServiceClient()
  // notified_at is explicitly RESET here: a user who was emailed after a
  // previous service window and opts in again during a new one must be
  // re-armed, or the second opt-in would silently never send.
  const { error } = await service
    .from('generation_notify')
    .upsert(
      { user_id: user.id, email: user.email, notified_at: null },
      { onConflict: 'user_id' }
    )

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json({ error: "Notifications aren't set up yet." }, { status: 503 })
    }
    console.error('Error saving generation-notify opt-in:', error)
    await logError({
      source: 'api:generation-notify',
      message: `generation_notify upsert failed: ${error.message}`,
      detail: error,
      path: 'POST /api/generation-notify',
      userId: user.id,
    })
    return NextResponse.json({ error: 'Failed to save — please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
