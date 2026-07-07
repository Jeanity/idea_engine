import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { NextResponse, type NextRequest } from 'next/server'

// Admin-only "add account" action. The /app/admin layout gates the PAGE, but
// that gate does NOT protect this route — every admin API route re-checks
// isAdminEmail itself, per project ground rules. The service client is only
// ever created AFTER that check passes.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** The acting admin's email on success, or a NextResponse to return as-is (401/403). */
async function requireAdmin(): Promise<{ email: string } | NextResponse> {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return { email: user.email! }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const body = await request.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 })
  }

  const service = createServiceClient()

  // inviteUserByEmail sends a Supabase-hosted magic-link email — no password
  // handling on our side. This requires SMTP to be configured in the Supabase
  // project; if it isn't, the call errors and we surface that plainly rather
  // than silently no-oping (see HANDOFF: invites need Supabase SMTP set up).
  const { data, error } = await service.auth.admin.inviteUserByEmail(email)

  if (error) {
    console.error(`[admin] invite failed: ${admin.email} tried to invite ${email}:`, error.message)
    const looksLikeSmtp = /smtp|mail|email/i.test(error.message)
    return NextResponse.json(
      {
        error: looksLikeSmtp
          ? "Couldn't send the invite — email delivery isn't configured for this project."
          : error.message || 'Failed to send invite.',
      },
      { status: 500 }
    )
  }

  console.log(`[admin] invite: ${admin.email} invited ${email} (new user id ${data.user?.id ?? 'unknown'})`)

  return NextResponse.json({ ok: true, id: data.user?.id ?? null })
}
