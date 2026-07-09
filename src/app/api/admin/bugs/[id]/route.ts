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

// Admin-only hard delete of a bug report and its associated screenshot (if any).
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
    return NextResponse.json({ error: 'Invalid bug id' }, { status: 400 })
  }

  const service = createServiceClient()

  // Check if row exists and get the screenshot_path before deleting
  const { data: row } = await service
    .from('bug_reports')
    .select('id, screenshot_path')
    .eq('id', id)
    .single()

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // If there's a screenshot, try to delete it from storage first
  if (row.screenshot_path) {
    try {
      await service.storage.from('bug-screenshots').remove([row.screenshot_path])
    } catch (storageError) {
      // Log the error but don't block the row deletion
      console.error('Error deleting screenshot from storage:', storageError)
    }
  }

  // Hard delete the bug report row
  const { error } = await service
    .from('bug_reports')
    .delete()
    .eq('id', id)

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json(
        { error: 'Bug reports table is not available right now — please try again later.' },
        { status: 503 }
      )
    }
    console.error('Error deleting bug report:', error)
    await logError({
      source: 'api:admin/bugs/[id]',
      message: `Delete bug report failed: ${error.message}`,
      detail: error,
      path: 'DELETE /api/admin/bugs/[id]',
    })
    return NextResponse.json({ error: 'Failed to delete bug report' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
