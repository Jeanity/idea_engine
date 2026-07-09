import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { logError } from '@/lib/log-error'
import { buildEmail, sendMail } from '@/lib/mailer'
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

/** Minimal HTML-escaping — Danny's message is rendered verbatim into the email body. */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const body = await request.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 })
  }
  if (!message || message.length > 2000) {
    return NextResponse.json({ error: 'A message is required (max 2,000 characters).' }, { status: 400 })
  }

  const service = createServiceClient()

  // generateLink({ type: 'invite' }) creates the account instantly — same
  // semantics as inviteUserByEmail — but returns the action link instead of
  // sending Supabase's own templated email. We send our own email below so
  // Danny can edit the message first.
  const { data, error } = await service.auth.admin.generateLink({ type: 'invite', email })

  if (error) {
    const looksLikeExisting = /already.*(registered|exists)|user.*exists/i.test(error.message)
    if (looksLikeExisting) {
      return NextResponse.json(
        { error: `${email} already has an account.` },
        { status: 409 }
      )
    }
    console.error(`[admin] invite failed: ${admin.email} tried to invite ${email}:`, error.message)
    await logError({ source: 'api:admin/users', message: `Invite failed for ${email}: ${error.message}`, detail: { inviteEmail: email, adminEmail: admin.email, error: error.message }, path: 'POST /api/admin/users/invite' })
    return NextResponse.json({ error: error.message || 'Failed to create the invite.' }, { status: 500 })
  }

  const actionLink = data.properties?.action_link
  const userId = data.user?.id ?? null

  if (!actionLink) {
    console.error(`[admin] invite: generateLink for ${email} returned no action_link`)
    await logError({ source: 'api:admin/users', message: `generateLink returned no action_link for ${email}`, detail: { inviteEmail: email, adminEmail: admin.email }, path: 'POST /api/admin/users/invite' })
    return NextResponse.json(
      { error: 'Account was created but the email failed to send — delete the user and retry, or check SMTP settings.' },
      { status: 502 }
    )
  }

  // The account already exists at this point (generateLink created it) — a
  // failure from here on must NOT be rolled back automatically. We surface
  // it plainly instead so Danny can decide what to do (see route comment /
  // HANDOFF: invites need SMTP configured).
  const bodyHtml = `<p>${escapeHtml(message).replace(/\n/g, '<br />')}</p>
<p style="margin-top: 24px;">
  <a href="${actionLink}" style="display: inline-block; background: #6366f1; color: #ffffff; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 8px;">Accept your invitation</a>
</p>
<p style="color:#64748b;font-size:13px;margin-top:16px;">Or paste this link into your browser: ${actionLink}</p>`
  const bodyText = `${message}\n\nAccept your invitation: ${actionLink}`
  const { html, text } = buildEmail({ bodyHtml, bodyText })

  let sendResult: { sent: boolean }
  try {
    sendResult = await sendMail({
      to: email,
      subject: "You're invited to Idea Engine",
      html,
      text,
      replyTo: process.env.ADMIN_NOTIFY_EMAIL,
    })
  } catch (err) {
    await logError({
      source: 'mailer',
      message: `Failed to send invite email to ${email}`,
      detail: err,
      path: 'POST /api/admin/users/invite',
    })
    sendResult = { sent: false }
  }

  if (!sendResult.sent) {
    await logError({
      source: 'api:admin/users',
      message: `Invite account created but email failed to send for ${email}`,
      detail: { inviteEmail: email, adminEmail: admin.email, userId },
      path: 'POST /api/admin/users/invite',
    })
    return NextResponse.json(
      { error: 'Account was created but the email failed to send — delete the user and retry, or check SMTP settings.' },
      { status: 502 }
    )
  }

  console.log(`[admin] invite: ${admin.email} invited ${email} (new user id ${userId ?? 'unknown'})`)

  return NextResponse.json({ ok: true, id: userId })
}
