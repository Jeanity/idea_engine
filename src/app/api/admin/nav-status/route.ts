import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { readSurveyConfig } from '@/lib/survey'
import { NextResponse } from 'next/server'

// Powers the live nav badges in src/app/app/admin/admin-shell.tsx (survey-active
// dot, open-contact count, 24h-feedback count). The /app/admin layout gates the
// PAGE, not this API route — every admin route re-checks isAdminEmail itself,
// per project ground rules. The service client is only ever created AFTER that
// check passes (matches src/app/api/admin/stats).
//
// Every individual query degrades its own field to false/0 on error (including
// 42P01/PGRST205 for tables that predate a given migration) — this endpoint
// never 500s just because one queue's table is missing.

export async function GET() {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Only used AFTER the isAdminEmail check above, per project ground rules.
  const service = createServiceClient()

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [surveyConfig, openContactsRes, recentFeedbackRes] = await Promise.all([
    // readSurveyConfig already degrades to DEFAULT_SURVEY_CONFIG (enabled: false)
    // on any read error, including a missing app_settings table.
    readSurveyConfig(service),
    service.from('contact_submissions').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    service.from('report_feedback').select('id', { count: 'exact', head: true }).gte('created_at', dayAgo),
  ])

  if (openContactsRes.error) {
    console.error('Admin nav-status: openContacts query failed:', openContactsRes.error)
  }
  if (recentFeedbackRes.error) {
    console.error('Admin nav-status: recentFeedback query failed:', recentFeedbackRes.error)
  }

  return NextResponse.json({
    surveyActive: surveyConfig.enabled,
    openContacts: openContactsRes.error ? 0 : openContactsRes.count ?? 0,
    recentFeedback24h: recentFeedbackRes.error ? 0 : recentFeedbackRes.count ?? 0,
  })
}
