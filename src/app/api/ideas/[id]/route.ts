import { createDbClient } from '@/lib/db'
import { logError } from '@/lib/log-error'
import { NextResponse, type NextRequest } from 'next/server'

// "Start over" escape hatch: abandon the current idea entirely. Runs through
// the per-request RLS client (not the service client) — the "ideas: delete
// own" policy (migration 001) is what actually enforces ownership here.
// answers/reports (and report_feedback under reports) all cascade via FK
// `on delete cascade` (verified against supabase/migrations/001_initial_schema.sql),
// so no manual child-table cleanup is needed.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data, error } = await supabase
    .from('ideas')
    .delete()
    .eq('id', id)
    .select('id')

  if (error) {
    console.error('Error deleting idea:', error)
    await logError({
      source: 'api:ideas',
      message: `Delete idea failed: ${error.message}`,
      detail: error,
      path: `DELETE /api/ideas/${id}`,
      userId: user.id,
    })
    return NextResponse.json({ error: 'Failed to delete idea' }, { status: 500 })
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
