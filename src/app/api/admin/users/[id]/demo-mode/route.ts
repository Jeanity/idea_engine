import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { NextResponse, type NextRequest } from 'next/server'

// Admin sets demo mode on ANY user's profile (the /api/profile/demo-mode
// route only ever writes the caller's own row). Demo mode answers that
// user's report runs from canned fixtures — no API spend — which is how a
// test account exercises full user-facing flows (e.g. the promo survey
// gates, which admins never see) for free.
//
// Admin-gate pattern: the /app/admin layout gates pages only — this route
// re-checks isAdminEmail itself, and the service client is only created
// after that check passes.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Missing user id.' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const { demo_mode } = body
  if (typeof demo_mode !== 'boolean') {
    return NextResponse.json({ error: 'demo_mode must be a boolean' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data: updated, error } = await service
    .from('profiles')
    .update({ demo_mode })
    .eq('id', id)
    .select('id')

  if (error) {
    console.error('Error updating demo_mode for user:', error)
    return NextResponse.json({ error: 'Failed to update demo mode' }, { status: 500 })
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 })
  }

  console.log(`[admin] demo mode ${demo_mode ? 'ON' : 'OFF'} for user ${id} by ${user.email}`)
  return NextResponse.json({ ok: true, demo_mode })
}
