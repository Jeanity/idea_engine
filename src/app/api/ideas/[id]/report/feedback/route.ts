import { createDbClient } from '@/lib/db'
import { buildBrandedEmail, getSiteUrl, sendMail } from '@/lib/mailer'
import { NextResponse, type NextRequest } from 'next/server'

// Owner-gated upsert of the signed-in user's own feedback for their report.
// Mirrors the pattern in src/app/api/ideas/[id]/answers/route.ts: verify the
// idea (and its report) belongs to the caller before touching any row.
//
// `featured` is an admin-only field — it is never read from the request body
// here, so this endpoint can never set it, regardless of what a client sends.
// Only /api/admin/feedback (isAdminEmail-gated) can flip it.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: idea } = await supabase
    .from('ideas')
    .select('id')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()
  if (!idea) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: report } = await supabase
    .from('reports')
    .select('id, owner_id')
    .eq('idea_id', id)
    .single()
  if (!report || report.owner_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const { rating, comment, allow_public } = body

  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'rating must be an integer between 1 and 5' }, { status: 400 })
  }
  if (comment !== null && comment !== undefined && typeof comment !== 'string') {
    return NextResponse.json({ error: 'Invalid comment' }, { status: 400 })
  }
  if (allow_public !== undefined && typeof allow_public !== 'boolean') {
    return NextResponse.json({ error: 'allow_public must be a boolean' }, { status: 400 })
  }

  const trimmedComment = typeof comment === 'string' ? comment.trim() : null

  const { error } = await supabase
    .from('report_feedback')
    .upsert(
      {
        report_id: report.id,
        user_id: user.id,
        rating,
        comment: trimmedComment ? trimmedComment : null,
        allow_public: allow_public === true,
        // `featured` intentionally omitted — upsert leaves the existing
        // value untouched on conflict, and new rows default to false.
      },
      { onConflict: 'report_id' }
    )

  if (error) {
    console.error('Error saving report feedback:', error)
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
  }

  // Fire-and-forget admin notification — never blocks the submitter's response.
  const adminEmail = process.env.ADMIN_NOTIFY_EMAIL
  if (adminEmail) {
    const feedbackUrl = `${getSiteUrl()}/app/admin/feedback`
    const stars = '★'.repeat(rating)
    const { html, text } = await buildBrandedEmail({
      bodyHtml: `<p><strong>Rating:</strong> ${stars} (${rating}/5)</p>
<p><strong>Comment:</strong></p>
<p>${trimmedComment ? trimmedComment.replace(/\n/g, '<br />') : '(no comment)'}</p>
<p><a href="${feedbackUrl}">View in admin</a></p>`,
      bodyText: `Rating: ${stars} (${rating}/5)\n\nComment:\n${trimmedComment ?? '(no comment)'}\n\nView in admin: ${feedbackUrl}`,
    })
    void sendMail({
      to: adminEmail,
      subject: `[Feedback] ${rating}★`,
      html,
      text,
    })
  }

  return NextResponse.json({ ok: true })
}
