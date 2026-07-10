import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { logError } from '@/lib/log-error'
import { buildBrandedEmail, sendMail } from '@/lib/mailer'
import { NextResponse, type NextRequest } from 'next/server'

// Admin-only: reply to a /app/admin/contact submission from the reply modal.
// The /app/admin layout gates the PAGE, but that gate does NOT protect API
// routes — every admin route re-checks isAdminEmail itself, per project
// ground rules. The service client is only ever created AFTER that check
// passes (matches src/app/api/admin/contact/route.ts).
//
// The email send is AWAITED (not fire-and-forget) — unlike the "someone
// submitted the contact form" admin notification, this email IS the point of
// the request: it's the submitter's only copy of the reply, since they can
// never read contact_submissions or contact_replies back through the API
// (both are service-role only, see migrations 012 and 022). If the send
// fails the reply row is still saved (emailed_at stays null) so Danny can
// see it happened and isn't forced to retype it.

// Postgres 42P01 = undefined_table, PostgREST PGRST205 = "table not found in
// schema cache" — migration 022 (contact_replies) not run yet.
function isMissingTable(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

export async function POST(request: NextRequest) {
  const supabase = await createDbClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const requestBody = await request.json().catch(() => ({}))
  const submissionId = typeof requestBody.submissionId === 'string' ? requestBody.submissionId : ''
  const replyBody = typeof requestBody.body === 'string' ? requestBody.body.trim() : ''

  if (!submissionId) return NextResponse.json({ error: 'Missing submissionId.' }, { status: 400 })
  if (!replyBody || replyBody.length > 10000) {
    return NextResponse.json({ error: 'Reply is required (max 10,000 characters).' }, { status: 400 })
  }

  const service = createServiceClient()

  // Only used AFTER the isAdminEmail check above, per project ground rules.
  const { data: submission, error: submissionError } = await service
    .from('contact_submissions')
    .select('id, category, name, email, message, created_at')
    .eq('id', submissionId)
    .single()

  if (submissionError) {
    if (isMissingTable(submissionError)) {
      return NextResponse.json(
        { error: 'Replies are not available yet — the database migration hasn’t been run.' },
        { status: 503 }
      )
    }
    if (submissionError.code === 'PGRST116') {
      // "no rows" from .single()
      return NextResponse.json({ error: 'Submission not found.' }, { status: 404 })
    }
  }
  if (!submission) return NextResponse.json({ error: 'Submission not found.' }, { status: 404 })

  const { data: reply, error: insertError } = await service
    .from('contact_replies')
    .insert({
      submission_id: submissionId,
      body: replyBody,
      created_by: user.email ?? 'admin',
    })
    .select('id, submission_id, body, created_by, emailed_at, created_at')
    .single()

  if (insertError) {
    if (isMissingTable(insertError)) {
      return NextResponse.json(
        { error: 'Replies are not available yet — the database migration hasn’t been run.' },
        { status: 503 }
      )
    }
    console.error('Error creating contact reply:', insertError)
    await logError({
      source: 'api:admin/contact/replies',
      message: `Create contact reply failed: ${insertError.message}`,
      detail: insertError,
      path: 'POST /api/admin/contact/replies',
    })
    return NextResponse.json({ error: 'Failed to save reply.' }, { status: 500 })
  }

  // The submitter's inbox copy of this reply — read from ADMIN_NOTIFY_EMAIL
  // rather than hardcoding an address, so a reply from the submitter lands
  // wherever Danny actually reads contact notifications.
  const adminReplyTo = process.env.ADMIN_NOTIFY_EMAIL

  const quotedDate = new Date(submission.created_at).toLocaleString()
  const { html, text } = await buildBrandedEmail({
    bodyHtml: `<p>${replyBody.replace(/\n/g, '<br />')}</p>
<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
<p style="color:#64748b;font-size:13px;">Your original message (${quotedDate}, ${submission.category}):</p>
<p style="color:#64748b;font-size:13px;white-space:pre-wrap;">${submission.message.replace(/\n/g, '<br />')}</p>`,
    bodyText: `${replyBody}\n\n---\nYour original message (${quotedDate}, ${submission.category}):\n${submission.message}`,
  })

  let sent = false
  try {
    const result = await sendMail({
      to: submission.email,
      subject: 'Re: your message to Idea Engine',
      html,
      text,
      replyTo: adminReplyTo,
    })
    sent = result.sent
  } catch (err) {
    await logError({
      source: 'mailer',
      message: 'Failed to send contact reply email',
      detail: err,
      path: 'POST /api/admin/contact/replies',
    })
    sent = false
  }

  if (sent) {
    const nowIso = new Date().toISOString()
    await service.from('contact_replies').update({ emailed_at: nowIso }).eq('id', reply.id)
    await service.from('contact_submissions').update({ status: 'replied' }).eq('id', submissionId)
  }

  return NextResponse.json({ sent })
}
