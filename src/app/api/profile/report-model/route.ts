import { createDbClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { isSelectableReportModel } from '@/lib/ai'
import { NextResponse, type NextRequest } from 'next/server'

// Admin-only report-model override (admin Settings page). Same pattern as
// /api/profile/demo-mode: gated on ADMIN_EMAIL, writes only the caller's own
// profile row, so the experiment can never affect another user's reports.
export async function POST(request: NextRequest) {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const { report_model } = body
  // null clears the override (back to the app default model).
  if (report_model !== null && !(typeof report_model === 'string' && isSelectableReportModel(report_model))) {
    return NextResponse.json({ error: 'report_model must be null or a supported model id' }, { status: 400 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ report_model })
    .eq('id', user.id)

  if (error) {
    console.error('Error updating report_model:', error)
    return NextResponse.json({ error: 'Failed to update report model' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, report_model })
}
