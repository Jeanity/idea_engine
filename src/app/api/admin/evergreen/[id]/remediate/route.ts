import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { logError } from '@/lib/log-error'
import { getAuthUsersByIds } from '@/lib/admin-users'
import { buildBrandedEmail, getSiteUrl, sendMail } from '@/lib/mailer'
import { escapeHtml } from '@/lib/email-chrome'
import { isMissingEvergreenTable } from '@/lib/evergreen'
import {
  computePatchedSections,
  filterCohort,
  groupReportsByUser,
  type PatchableSections,
  type RemediatedReportRef,
} from '@/lib/evergreen-remediation'
import type { ComplianceItem } from '@/lib/compliance-baseline'
import type { EvergreenReviewStatus } from '@/lib/database.types'
import { NextResponse, type NextRequest } from 'next/server'

// Workstream C2 — the "Patch reports & notify" / "Notify only" admin action.
// Auth shape copied verbatim from ../route.ts and ../regenerate/route.ts.
async function requireAdmin(): Promise<{ email: string } | NextResponse> {
  const supabase = await createDbClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return { email: user.email! }
}

const MAX_NOTE_LENGTH = 2000
// Sequential per cohort report, capped per invocation — re-running the action
// processes the next batch (already-remediated rows are excluded by the
// cohort predicate, so re-clicking is safe, not double-work).
// Kept small: each row is a DB read + write + an SMTP send, all sequential
// inside ONE serverless invocation, and Vercel Hobby function limits are
// short. The action is idempotent (remediated rows never reprocess), so a
// bigger cohort is just "click again until remaining is 0". Move to an
// Inngest job before raising this.
const MAX_ROWS_PER_RUN = 20

type Mode = 'patch' | 'notify'
type RemediationKind = 'patched' | 'notified'

interface ProcessedRow {
  user_id: string
  report_id: string
  idea_id: string
  kind: RemediationKind
}

// Friendly-plain copy per the site's layered-disclosure voice — no internal
// jargon ("evergreen", "baseline", "cache") in anything a user sees. `note`
// is Danny's freeform explanation, rendered verbatim in its own paragraph.
function buildRemediationEmail(
  kind: RemediationKind,
  note: string,
  reports: RemediatedReportRef[]
): { subject: string; bodyHtml: string; bodyText: string } {
  const siteUrl = getSiteUrl()
  const links = reports.map(r => `${siteUrl}/app/ideas/${r.idea_id}/report`)
  const plural = reports.length > 1

  // Danny's note is trusted, but a legitimate note containing <, > or &
  // ("fees were < the amount shown", "Smith & Co") must not break the HTML
  // variant — escape it there; the text variant stays raw.
  const noteHtml = escapeHtml(note).replace(/\n/g, '<br />')

  if (kind === 'patched') {
    const subject = 'Your HadIdea report has been updated'
    const intro = `We refreshed some information used in your report${plural ? 's' : ''} and it's now up to date — there's nothing you need to do.`
    const linksHtml = links.map(l => `<p><a href="${l}">${l}</a></p>`).join('')
    const linksText = links.join('\n')
    return {
      subject,
      bodyHtml: `<p>${intro}</p><p>${noteHtml}</p>${linksHtml}`,
      bodyText: `${intro}\n\n${note}\n\n${linksText}`,
    }
  }

  const subject = 'An update about your HadIdea report'
  const intro = `We found an issue with some information used in your report${plural ? 's' : ''}.`
  const linksHtml = links.map(l => `<p><a href="${l}">${l}</a></p>`).join('')
  const linksText = links.join('\n')
  return {
    subject,
    bodyHtml: `<p>${intro}</p><p>${noteHtml}</p>${linksHtml}`,
    bodyText: `${intro}\n\n${note}\n\n${linksText}`,
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const { id } = await params
  if (typeof id !== 'string' || !id) {
    return NextResponse.json({ error: 'Invalid evergreen baseline id' }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const mode: Mode = body.mode === 'notify' ? 'notify' : 'patch'
  if (body.mode !== 'patch' && body.mode !== 'notify') {
    return NextResponse.json({ error: "mode must be 'patch' or 'notify'." }, { status: 400 })
  }
  const note = typeof body.note === 'string' ? body.note.trim() : ''
  if (!note) {
    return NextResponse.json({ error: 'A note is required.' }, { status: 400 })
  }
  if (note.length > MAX_NOTE_LENGTH) {
    return NextResponse.json({ error: `Note must be ${MAX_NOTE_LENGTH} characters or fewer.` }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: row, error: fetchError } = await service
    .from('evergreen_baselines')
    .select('id, country_code, archetype, items, review_status, updated_at')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    if (isMissingEvergreenTable(fetchError)) {
      return NextResponse.json(
        { error: 'Evergreen baselines table is not available right now — please try again later.' },
        { status: 503 }
      )
    }
    console.error('Error loading evergreen baseline for remediation:', fetchError)
    await logError({
      source: 'api:admin/evergreen/[id]/remediate',
      message: `Load evergreen baseline failed: ${fetchError.message}`,
      detail: fetchError,
      path: 'POST /api/admin/evergreen/[id]/remediate',
    })
    return NextResponse.json({ error: 'Failed to load the baseline.' }, { status: 500 })
  }
  if (!row) {
    return NextResponse.json({ error: 'Evergreen baseline not found.' }, { status: 404 })
  }

  // Danny must approve the fixed content before it's pushed into user
  // reports — mode 'notify' is allowed regardless of review status (it never
  // touches report content).
  if (mode === 'patch' && (row.review_status as EvergreenReviewStatus) !== 'approved') {
    return NextResponse.json(
      { error: 'This entry must be approved before its content can be patched into reports. Approve it first, or use Notify only.' },
      { status: 403 }
    )
  }

  // Cohort: usage rows on a superseded revision of THIS baseline, not yet
  // remediated. remediated_at IS NULL is filtered at the DB level; the
  // evergreen_updated_at != current.updated_at half of the predicate is
  // applied via the shared pure helper (src/lib/evergreen-remediation.ts) so
  // this route and its unit tests reason about the exact same rule.
  const { data: usageRows, error: usageError } = await service
    .from('evergreen_report_usage')
    .select('id, evergreen_id, report_id, user_id, evergreen_updated_at, remediated_at')
    .eq('evergreen_id', id)
    .is('remediated_at', null)
    .order('created_at', { ascending: true })

  if (usageError) {
    if (isMissingEvergreenTable(usageError)) {
      return NextResponse.json(
        { error: 'Usage history is not available right now — please try again later.' },
        { status: 503 }
      )
    }
    console.error('Error loading evergreen usage cohort:', usageError)
    await logError({
      source: 'api:admin/evergreen/[id]/remediate',
      message: `Load evergreen usage cohort failed: ${usageError.message}`,
      detail: usageError,
      path: 'POST /api/admin/evergreen/[id]/remediate',
    })
    return NextResponse.json({ error: 'Failed to load the affected reports.' }, { status: 500 })
  }

  const cohort = filterCohort(usageRows ?? [], { id: row.id, updated_at: row.updated_at })
  const toProcess = cohort.slice(0, MAX_ROWS_PER_RUN)
  const remaining = Math.max(0, cohort.length - MAX_ROWS_PER_RUN)

  const newBaselineItems = (Array.isArray(row.items) ? row.items : []) as unknown as ComplianceItem[]
  const newRevision = { id: row.id, updated_at: row.updated_at, reviewStatus: row.review_status as EvergreenReviewStatus }

  let patched = 0
  let notified = 0
  let skipped = 0
  const processed: ProcessedRow[] = []

  for (const usage of toProcess) {
    // Per-row failures: log, skip, continue — one bad report must never
    // abort the whole cohort run.
    const { data: report, error: reportError } = await service
      .from('reports')
      .select('id, idea_id, sections, status')
      .eq('id', usage.report_id)
      .maybeSingle()

    if (reportError || !report) {
      console.error(`evergreen remediate: failed to load report ${usage.report_id}`, reportError)
      skipped++
      continue
    }

    let kind: RemediationKind = 'notified'

    // Only patch settled reports. A report mid-regeneration (queued/running —
    // /api/reports/full resets sections and re-runs the pipeline) will get
    // current-baseline content from that run anyway; writing into it here
    // would race the pipeline's own section writes. It still gets the notify
    // email and is marked remediated.
    if (mode === 'patch' && report.status === 'complete') {
      const patchedSections = computePatchedSections(
        (report.sections ?? {}) as PatchableSections,
        newBaselineItems,
        newRevision
      )
      if (patchedSections) {
        const { error: updateError } = await service
          .from('reports')
          .update({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sections: patchedSections as any,
          })
          .eq('id', report.id)

        if (updateError) {
          console.error(`evergreen remediate: failed to write patched sections for report ${report.id}`, updateError)
          skipped++
          continue
        }
        kind = 'patched'
      }
      // No stash on this report: falls through as 'notified' — the report is
      // left untouched, the user still gets told about the issue.
    }

    // Mark AFTER the report write succeeds (or was never attempted, for
    // 'notified'), regardless of the email outcome below — a bounced email
    // must never leave a usage row unremediated (a re-run would re-patch
    // forever).
    const { error: markError } = await service
      .from('evergreen_report_usage')
      .update({ remediated_at: new Date().toISOString(), remediation: kind })
      .eq('id', usage.id)

    if (markError) {
      console.error(`evergreen remediate: failed to mark usage row ${usage.id} remediated`, markError)
      skipped++
      continue
    }

    if (kind === 'patched') patched++
    else notified++
    processed.push({ user_id: usage.user_id, report_id: report.id, idea_id: report.idea_id, kind })
  }

  // One email per affected user per run, not one per report — dedupe via the
  // shared pure grouping helper.
  const perUser = groupReportsByUser(processed)
  let emailsSent = 0
  let emailsFailed = 0

  if (perUser.size > 0) {
    const emailMap = await getAuthUsersByIds(service, Array.from(perUser.keys()))

    for (const [userId, reports] of perUser) {
      const userEmail = emailMap.get(userId)?.email
      if (!userEmail) {
        console.error(`evergreen remediate: no email on file for user ${userId} — skipping notification`)
        emailsFailed++
        continue
      }
      // If ANY of this user's affected reports were actually patched, lead
      // with the patched-flavoured copy — that's their headline experience
      // even if one or two of their other reports fell back to notify-only
      // (no stash).
      const anyPatched = processed.some(p => p.user_id === userId && p.kind === 'patched')
      const { subject, bodyHtml, bodyText } = buildRemediationEmail(anyPatched ? 'patched' : 'notified', note, reports)
      const { html, text } = await buildBrandedEmail({ bodyHtml, bodyText })
      const result = await sendMail({ to: userEmail, subject, html, text })
      if (result.sent) emailsSent++
      else emailsFailed++
    }
  }

  if (skipped > 0 || emailsFailed > 0) {
    await logError({
      source: 'api:admin/evergreen/[id]/remediate',
      message: `Evergreen remediation run for ${id}: ${skipped} row(s) skipped, ${emailsFailed} email(s) failed to send`,
      detail: { evergreenId: id, mode, patched, notified, skipped, emailsSent, emailsFailed, remaining },
      path: 'POST /api/admin/evergreen/[id]/remediate',
    })
  }

  return NextResponse.json({ patched, notified, emailsSent, emailsFailed, skipped, remaining })
}
