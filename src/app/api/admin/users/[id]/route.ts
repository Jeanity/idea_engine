import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { NextResponse, type NextRequest } from 'next/server'

// Admin-only "remove account" action. The /app/admin layout gates the PAGE,
// but that gate does NOT protect this route — every admin API route
// re-checks isAdminEmail itself, per project ground rules. The service
// client is only ever created AFTER that check passes.
//
// This is the most destructive route in the admin backend, so it layers
// THREE independent guards on top of the UI's typed-email confirm dialog:
//   1. isAdminEmail re-check (acting user must be an admin).
//   2. The request body's `email` must exactly equal the TARGET user's real
//      email, fetched server-side via getUserById — never trust a client-
//      supplied email, and never delete on a bare id alone.
//   3. If the target email itself passes isAdminEmail, the delete is
//      refused (403) — admins can never be deleted through this route.

/** The acting admin's email on success, or a NextResponse to return as-is (401/403). */
async function requireAdmin(): Promise<{ email: string } | NextResponse> {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return { email: user.email! }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Missing user id.' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const typedEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!typedEmail) {
    return NextResponse.json({ error: 'Type the account email to confirm deletion.' }, { status: 400 })
  }

  const service = createServiceClient()

  // Guard 2: resolve the target's REAL email server-side. Never trust the
  // client's claim about whose account this is beyond using it to confirm.
  const { data: targetData, error: getError } = await service.auth.admin.getUserById(id)
  if (getError || !targetData?.user) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 })
  }
  const targetEmail = (targetData.user.email ?? '').toLowerCase()

  if (!targetEmail || typedEmail !== targetEmail) {
    return NextResponse.json({ error: 'Typed email does not match this account.' }, { status: 400 })
  }

  // Guard 3: admin accounts are never deletable through this route.
  if (isAdminEmail(targetData.user.email)) {
    return NextResponse.json({ error: 'Admin accounts cannot be deleted.' }, { status: 403 })
  }

  // FK cascades (auth.users -> profiles -> ideas -> answers/reports ->
  // purchases, all `on delete cascade`, verified against
  // supabase/migrations/001_initial_schema.sql) mean this one call removes
  // the user and every row they own. No manual child-table cleanup needed.
  const { error: deleteError } = await service.auth.admin.deleteUser(id)
  if (deleteError) {
    console.error(`[admin] delete failed: ${admin.email} tried to delete ${targetEmail} (${id}):`, deleteError.message)
    return NextResponse.json({ error: 'Failed to delete account.' }, { status: 500 })
  }

  console.log(`[admin] delete: ${admin.email} deleted user ${targetEmail} (${id})`)

  return NextResponse.json({ ok: true })
}
