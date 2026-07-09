import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { logError } from '@/lib/log-error'
import { NextResponse, type NextRequest } from 'next/server'
import type { ContactStatus } from '@/lib/database.types'

// Admin-only status updates for the contact queue. The /app/admin layout
// gates the PAGE, but that gate does NOT protect this route — every admin
// API route re-checks isAdminEmail itself, per project ground rules. The
// service client is only ever created AFTER that check passes (matches
// src/app/api/admin/errors).

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

const VALID_STATUSES: ContactStatus[] = ['open', 'replied', 'closed']

// PATCH: update a submission's status ({ id, status }).
export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const body = await request.json().catch(() => ({}))
  const id = typeof body.id === 'string' ? body.id : ''
  const status = typeof body.status === 'string' ? body.status : ''

  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })
  if (!VALID_STATUSES.includes(status as ContactStatus)) {
    return NextResponse.json({ error: 'Invalid status.' }, { status: 400 })
  }

  const service = createServiceClient()
  const { error } = await service
    .from('contact_submissions')
    .update({ status: status as ContactStatus })
    .eq('id', id)

  if (error) {
    console.error('Error updating contact submission:', error)
    await logError({
      source: 'api:admin/contact',
      message: `Update contact submission failed: ${error.message}`,
      detail: error,
      path: 'PATCH /api/admin/contact',
    })
    return NextResponse.json({ error: 'Failed to update status.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
