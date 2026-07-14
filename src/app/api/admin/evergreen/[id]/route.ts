import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { logError } from '@/lib/log-error'
import { NextResponse, type NextRequest } from 'next/server'

// Admin-only row actions for the evergreen baselines queue
// (/app/admin/evergreen). The /app/admin layout gates the PAGE, but that
// gate does NOT protect this route — every admin API route re-checks
// isAdminEmail itself, per project ground rules. The service client is only
// ever created AFTER that check passes (matches src/app/api/admin/bugs/[id]).

// Postgres 42P01 = undefined_table, PostgREST PGRST205 = "table not found in
// schema cache" — both mean migration 030 hasn't been run yet.
function isMissingTable(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

// Postgres 42703 = undefined_column, PostgREST PGRST204 = "column not found
// in schema cache" — both mean migration 031 (disapproved_at/disapprove_note)
// hasn't been run yet.
function isMissingColumn(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42703' || error?.code === 'PGRST204'
}

/** The acting admin's email on success, or a NextResponse to return as-is (401/403). */
async function requireAdmin(): Promise<{ email: string } | NextResponse> {
  const supabase = await createDbClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return { email: user.email! }
}

const MAX_DISAPPROVE_NOTE_LENGTH = 2000

// PATCH: { action: 'approve' } → review_status 'approved', reviewed_at now.
// review_status is informational for 'approved' (phase 1) — approving never
// gates serving, it just lets Danny mark an entry as eyeballed. The other
// supported action, { action: 'disapprove', note }, is NOT informational
// (Workstream C1): it flips review_status to 'disapproved', which the report
// pipeline's quad-state lookup (src/lib/evergreen.ts) treats as "never
// served, never auto-regenerated" — the pipeline falls back to its
// pre-evergreen legacy per-report compliance search until an explicit
// regenerate (Workstream C2, not built yet).
export async function PATCH(
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

  if (body.action === 'approve') {
    const service = createServiceClient()
    const { error } = await service
      .from('evergreen_baselines')
      // C2 nit: approving a previously-disapproved row must clear its
      // disapprove note/timestamp — a fresh approval means the row is no
      // longer in the disapproved state those fields describe.
      .update({
        review_status: 'approved',
        reviewed_at: new Date().toISOString(),
        disapproved_at: null,
        disapprove_note: null,
      })
      .eq('id', id)

    if (error) {
      if (isMissingTable(error)) {
        return NextResponse.json(
          { error: 'Evergreen baselines table is not available right now — please try again later.' },
          { status: 503 }
        )
      }
      // Migration 031 not yet run: the disapproved_at/disapprove_note
      // columns this update now clears don't exist yet.
      if (isMissingColumn(error)) {
        return NextResponse.json(
          { error: 'Approve is not fully available yet — the required migration has not been run.' },
          { status: 503 }
        )
      }
      console.error('Error approving evergreen baseline:', error)
      await logError({
        source: 'api:admin/evergreen/[id]',
        message: `Approve evergreen baseline failed: ${error.message}`,
        detail: error,
        path: 'PATCH /api/admin/evergreen/[id]',
      })
      return NextResponse.json({ error: 'Failed to approve the baseline.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  }

  if (body.action === 'disapprove') {
    const note = typeof body.note === 'string' ? body.note.trim() : ''
    if (!note) {
      return NextResponse.json({ error: 'A note explaining the disapproval is required.' }, { status: 400 })
    }
    if (note.length > MAX_DISAPPROVE_NOTE_LENGTH) {
      return NextResponse.json(
        { error: `Note must be ${MAX_DISAPPROVE_NOTE_LENGTH} characters or fewer.` },
        { status: 400 }
      )
    }

    const service = createServiceClient()
    const { error } = await service
      .from('evergreen_baselines')
      .update({ review_status: 'disapproved', disapproved_at: new Date().toISOString(), disapprove_note: note })
      .eq('id', id)

    if (error) {
      if (isMissingTable(error)) {
        return NextResponse.json(
          { error: 'Evergreen baselines table is not available right now — please try again later.' },
          { status: 503 }
        )
      }
      // Migration 031 not yet run: either the review_status CHECK still only
      // allows ('unreviewed', 'approved') — Postgres 23514 (check_violation)
      // — or the disapproved_at/disapprove_note columns don't exist yet.
      if (error.code === '23514' || isMissingColumn(error)) {
        return NextResponse.json(
          { error: 'Disapprove is not available yet — the required migration has not been run.' },
          { status: 503 }
        )
      }
      console.error('Error disapproving evergreen baseline:', error)
      await logError({
        source: 'api:admin/evergreen/[id]',
        message: `Disapprove evergreen baseline failed: ${error.message}`,
        detail: error,
        path: 'PATCH /api/admin/evergreen/[id]',
      })
      return NextResponse.json({ error: 'Failed to disapprove the baseline.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json(
    { error: "Only { action: 'approve' } or { action: 'disapprove', note } are supported." },
    { status: 400 }
  )
}

// DELETE: evicts the row — the next report from this country x archetype x
// section regenerates it. No confirm UI beyond the caller's window.confirm()
// (its copy warns that usage history is deleted with it). That warning is
// accurate at the DB level too: evergreen_report_usage.evergreen_id
// references this row ON DELETE CASCADE (migration 031), so evicting a row
// also deletes its exposure-tagging history — no extra query needed here.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const { id } = await params
  if (typeof id !== 'string' || !id) {
    return NextResponse.json({ error: 'Invalid evergreen baseline id' }, { status: 400 })
  }

  const service = createServiceClient()
  const { error } = await service.from('evergreen_baselines').delete().eq('id', id)

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json(
        { error: 'Evergreen baselines table is not available right now — please try again later.' },
        { status: 503 }
      )
    }
    console.error('Error deleting evergreen baseline:', error)
    await logError({
      source: 'api:admin/evergreen/[id]',
      message: `Delete evergreen baseline failed: ${error.message}`,
      detail: error,
      path: 'DELETE /api/admin/evergreen/[id]',
    })
    return NextResponse.json({ error: 'Failed to delete the baseline.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
