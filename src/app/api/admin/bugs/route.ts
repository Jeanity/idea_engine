import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { logError } from '@/lib/log-error'
import { NextResponse, type NextRequest } from 'next/server'
import type { BugReportStatus } from '@/lib/database.types'

// Admin-only updates for the bug report queue. The /app/admin layout gates
// the PAGE, but that gate does NOT protect this route — every admin API
// route re-checks isAdminEmail itself, per project ground rules. The service
// client is only ever created AFTER that check passes (matches
// src/app/api/admin/contact).

/** The acting admin's email on success, or a NextResponse to return as-is (401/403). */
async function requireAdmin(): Promise<{ email: string } | NextResponse> {
  const supabase = await createDbClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return { email: user.email! }
}

const VALID_STATUSES: BugReportStatus[] = ['open', 'triaged', 'resolved', 'wontfix']

// PATCH: update a report's status and/or admin notes ({ id, status?, admin_notes? }).
export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const body = await request.json().catch(() => ({}))
  const id = typeof body.id === 'string' ? body.id : ''
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })

  const update: { status?: BugReportStatus; admin_notes?: string } = {}

  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !VALID_STATUSES.includes(body.status as BugReportStatus)) {
      return NextResponse.json({ error: 'Invalid status.' }, { status: 400 })
    }
    update.status = body.status as BugReportStatus
  }

  if (body.admin_notes !== undefined) {
    if (typeof body.admin_notes !== 'string') {
      return NextResponse.json({ error: 'Invalid notes.' }, { status: 400 })
    }
    update.admin_notes = body.admin_notes.slice(0, 5000)
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })
  }

  const service = createServiceClient()
  const { error } = await service.from('bug_reports').update(update).eq('id', id)

  if (error) {
    console.error('Error updating bug report:', error)
    await logError({
      source: 'api:admin/bugs',
      message: `Update bug report failed: ${error.message}`,
      detail: error,
      path: 'PATCH /api/admin/bugs',
    })
    return NextResponse.json({ error: 'Failed to update the report.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
