import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { NextResponse, type NextRequest } from 'next/server'

// Admin-only toggle for `report_feedback.featured`. The admin Feedback page
// (src/app/app/admin/feedback) is gated by the /app/admin layout, but that
// layout gate does NOT protect this API route — every admin route re-checks
// isAdminEmail itself, per project ground rules.
export async function POST(request: NextRequest) {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const { feedback_id, featured } = body

  if (typeof feedback_id !== 'string' || !feedback_id) {
    return NextResponse.json({ error: 'Invalid feedback_id' }, { status: 400 })
  }
  if (typeof featured !== 'boolean') {
    return NextResponse.json({ error: 'featured must be a boolean' }, { status: 400 })
  }

  const service = createServiceClient()

  // Only used AFTER the isAdminEmail check above, per project ground rules.
  const { data: row } = await service
    .from('report_feedback')
    .select('id, allow_public')
    .eq('id', feedback_id)
    .single()

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // A row can only be featured if its owner consented to being quoted —
  // unfeaturing is always allowed, featuring requires allow_public = true.
  if (featured && !row.allow_public) {
    return NextResponse.json(
      { error: 'Cannot feature feedback without the user’s public-quote consent' },
      { status: 400 }
    )
  }

  const { error } = await service
    .from('report_feedback')
    .update({ featured })
    .eq('id', feedback_id)

  if (error) {
    console.error('Error updating feedback featured flag:', error)
    return NextResponse.json({ error: 'Failed to update feedback' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, featured })
}
