import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { logError } from '@/lib/log-error'
import { NextResponse, type NextRequest } from 'next/server'

// Postgres 42P01 = undefined_table (when a query hits Postgres directly),
// PostgREST PGRST205 = "table not found in schema cache" (what Supabase
// actually returns in practice) — both mean the table doesn't exist yet.
function isMissingTable(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

// Admin-only hard delete of a feedback entry. Cascades to feedback_replies
// automatically via foreign key constraint from migration 019.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (typeof id !== 'string' || !id) {
    return NextResponse.json({ error: 'Invalid feedback id' }, { status: 400 })
  }

  const service = createServiceClient()

  // Check if row exists before deleting
  const { data: row } = await service
    .from('report_feedback')
    .select('id')
    .eq('id', id)
    .single()

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Hard delete — feedback_replies with foreign key to this row will cascade
  const { error } = await service
    .from('report_feedback')
    .delete()
    .eq('id', id)

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json(
        { error: 'Feedback table is not available right now — please try again later.' },
        { status: 503 }
      )
    }
    console.error('Error deleting feedback:', error)
    await logError({
      source: 'api:admin/feedback/[id]',
      message: `Delete feedback failed: ${error.message}`,
      detail: error,
      path: 'DELETE /api/admin/feedback/[id]',
    })
    return NextResponse.json({ error: 'Failed to delete feedback' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
