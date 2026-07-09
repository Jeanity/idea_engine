import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { logError } from '@/lib/log-error'
import { NextResponse, type NextRequest } from 'next/server'

// Postgres 42P01 = undefined_table, PostgREST PGRST205 = "table not found in
// schema cache" — migration 019 (feedback_replies) not run yet.
function isMissingTable(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

// Admin-only: post a reply to a feedback entry. Every admin route re-checks
// isAdminEmail itself — the /app/admin layout gate does not protect API
// routes. Replies are not editable or deletable in v1 (no PATCH/DELETE here).
export async function POST(request: NextRequest) {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const { feedback_id, body: replyBody, is_public } = body

  if (typeof feedback_id !== 'string' || !feedback_id) {
    return NextResponse.json({ error: 'Invalid feedback_id' }, { status: 400 })
  }
  const trimmed = typeof replyBody === 'string' ? replyBody.trim() : ''
  if (!trimmed || trimmed.length > 5000) {
    return NextResponse.json({ error: 'Reply is required (max 5000 characters).' }, { status: 400 })
  }
  if (is_public !== undefined && typeof is_public !== 'boolean') {
    return NextResponse.json({ error: 'is_public must be a boolean' }, { status: 400 })
  }

  const service = createServiceClient()

  // Only used AFTER the isAdminEmail check above, per project ground rules.
  const { data: feedbackRow } = await service
    .from('report_feedback')
    .select('id')
    .eq('id', feedback_id)
    .single()

  if (!feedbackRow) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: reply, error } = await service
    .from('feedback_replies')
    .insert({
      feedback_id,
      body: trimmed,
      is_public: is_public === true,
      created_by: user.email ?? 'admin',
    })
    .select('id, feedback_id, body, is_public, created_at, created_by')
    .single()

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json(
        { error: 'Replies are not available yet — the database migration hasn’t been run.' },
        { status: 503 }
      )
    }
    console.error('Error creating feedback reply:', error)
    await logError({ source: 'api:admin/feedback/replies', message: `Create feedback reply failed: ${error.message}`, detail: error, path: 'POST /api/admin/feedback/replies' })
    return NextResponse.json({ error: 'Failed to save reply' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, reply })
}
