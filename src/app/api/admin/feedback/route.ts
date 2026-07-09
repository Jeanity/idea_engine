import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { logError } from '@/lib/log-error'
import { NextResponse, type NextRequest } from 'next/server'

// Postgres 42703 = undefined_column, PostgREST PGRST204 = "column not found
// in schema cache" — migration 019 (hidden/admin_public) not run yet.
function isMissingColumn(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42703' || error?.code === 'PGRST204'
}

// Admin-only toggle for `report_feedback.featured` / `.hidden` / `.admin_public`.
// The admin Feedback page (src/app/app/admin/feedback) is gated by the
// /app/admin layout, but that layout gate does NOT protect this API route —
// every admin route re-checks isAdminEmail itself, per project ground rules.
// Exactly one of featured/hidden/admin_public is expected per call (the UI
// only ever sends one), but any combination present in the body is applied.
export async function POST(request: NextRequest) {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const { feedback_id, featured, hidden, admin_public } = body

  if (typeof feedback_id !== 'string' || !feedback_id) {
    return NextResponse.json({ error: 'Invalid feedback_id' }, { status: 400 })
  }
  if (featured === undefined && hidden === undefined && admin_public === undefined) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }
  if (featured !== undefined && typeof featured !== 'boolean') {
    return NextResponse.json({ error: 'featured must be a boolean' }, { status: 400 })
  }
  if (hidden !== undefined && typeof hidden !== 'boolean') {
    return NextResponse.json({ error: 'hidden must be a boolean' }, { status: 400 })
  }
  if (admin_public !== undefined && typeof admin_public !== 'boolean') {
    return NextResponse.json({ error: 'admin_public must be a boolean' }, { status: 400 })
  }

  const service = createServiceClient()

  // Only used AFTER the isAdminEmail check above, per project ground rules.
  const { data: row } = await service
    .from('report_feedback')
    .select('id, allow_public')
    .eq('id', feedback_id)
    .single()

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // A row can only be featured if its owner consented to being quoted —
  // unfeaturing is always allowed, featuring requires allow_public = true.
  if (featured && !row.allow_public) {
    return NextResponse.json(
      { error: 'Cannot feature feedback without the user’s public-quote consent' },
      { status: 400 }
    )
  }

  const update: { featured?: boolean; hidden?: boolean; admin_public?: boolean } = {}
  if (featured !== undefined) update.featured = featured
  if (hidden !== undefined) update.hidden = hidden
  if (admin_public !== undefined) update.admin_public = admin_public

  const { error } = await service
    .from('report_feedback')
    .update(update)
    .eq('id', feedback_id)

  if (error) {
    if (isMissingColumn(error)) {
      return NextResponse.json(
        { error: 'Moderation controls are not available yet — the database migration hasn’t been run.' },
        { status: 503 }
      )
    }
    console.error('Error updating feedback flags:', error)
    await logError({ source: 'api:admin/feedback', message: `Update feedback flags failed: ${error.message}`, detail: error, path: 'POST /api/admin/feedback' })
    return NextResponse.json({ error: 'Failed to update feedback' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, ...update })
}
