import { createDbClient } from '@/lib/db'
import { logError } from '@/lib/log-error'
import { buildBrandedEmail, getSiteUrl, sendMail } from '@/lib/mailer'
import { NextResponse, type NextRequest } from 'next/server'

// Signed-in users only — flags a bug from inside a report viewer (initial or
// full). Uses the per-request client (respects RLS) rather than the service
// client: the "bug_reports: authenticated insert own" policy from migration
// 018 is what actually authorises this write, matching /api/contact.
//
// Postgres 42P01 (undefined_table) and PostgREST's PGRST205 ("table not
// found in schema cache") both mean migration 018 hasn't been run yet — same
// pattern verified live in src/app/api/contact/route.ts.
function isMissingTable(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

export async function POST(request: NextRequest) {
  const supabase = await createDbClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Please sign in to report a bug.' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))

  const description = typeof body.description === 'string' ? body.description.trim() : ''
  if (!description || description.length > 5000) {
    return NextResponse.json({ error: 'Description is required (max 5000 characters).' }, { status: 400 })
  }

  const ideaId = typeof body.idea_id === 'string' ? body.idea_id : null
  const reportId = typeof body.report_id === 'string' ? body.report_id : null
  const reportTab = typeof body.report_tab === 'string' ? body.report_tab : null
  const screenshotPath = typeof body.screenshot_path === 'string' ? body.screenshot_path : null
  const browserInfo = typeof body.browser_info === 'string' ? body.browser_info.slice(0, 500) : null
  const pageUrl = typeof body.page_url === 'string' ? body.page_url.slice(0, 2000) : null

  const { error } = await supabase.from('bug_reports').insert({
    user_id: user.id,
    idea_id: ideaId,
    report_id: reportId,
    report_tab: reportTab,
    description,
    screenshot_path: screenshotPath,
    browser_info: browserInfo,
    page_url: pageUrl,
  })

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json(
        { error: "Bug reporting isn't available right now — please try again later." },
        { status: 503 }
      )
    }
    console.error('Error inserting bug report:', error)
    await logError({
      source: 'api:bug-report',
      message: `Bug report insert failed: ${error.message}`,
      detail: error,
      path: 'POST /api/bug-report',
      userId: user.id,
    })
    return NextResponse.json({ error: 'Something went wrong — please try again.' }, { status: 500 })
  }

  // Fire-and-forget admin notification (see src/app/api/contact/route.ts for
  // the same pattern) — never blocks the reporter's response.
  const adminEmail = process.env.ADMIN_NOTIFY_EMAIL
  if (adminEmail) {
    const bugsUrl = `${getSiteUrl()}/app/admin/bugs`
    const { html, text } = await buildBrandedEmail({
      bodyHtml: `<p><strong>Description:</strong></p>
<p>${description.replace(/\n/g, '<br />')}</p>
<p><strong>Page:</strong> ${pageUrl ?? 'unknown'}</p>
<p><strong>Browser:</strong> ${browserInfo ?? 'unknown'}</p>
<p><strong>Screenshot attached:</strong> ${screenshotPath ? 'yes' : 'no'}</p>
<p><a href="${bugsUrl}">View in admin</a></p>`,
      bodyText: `Description:\n${description}\n\nPage: ${pageUrl ?? 'unknown'}\nBrowser: ${browserInfo ?? 'unknown'}\nScreenshot attached: ${screenshotPath ? 'yes' : 'no'}\n\nView in admin: ${bugsUrl}`,
    })
    void sendMail({
      to: adminEmail,
      subject: `[Bug] report on ${reportTab ?? 'report'}`,
      html,
      text,
    })
  }

  return NextResponse.json({ ok: true })
}
