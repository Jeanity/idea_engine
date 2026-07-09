import { createDbClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { logError } from '@/lib/log-error'
import { NextResponse, type NextRequest } from 'next/server'

// Marks one admin nav section as "seen as of now" on the caller's own
// profiles row (migration 023, admin_seen jsonb). Fired once on mount by
// <MarkSeen section="..."/> (src/components/admin/mark-seen.tsx), mounted on
// each of the four badge-bearing admin pages: contact, feedback, bugs,
// errors. Once this succeeds, the corresponding nav badge in admin-shell.tsx
// clears on its next /api/admin/nav-status refetch — see MarkSeen for how
// the refetch-race with the route-change fetch is resolved.
//
// The /app/admin layout gates the PAGE, not this API route — every admin
// route re-checks isAdminEmail itself, per project ground rules.
//
// Uses the PER-REQUEST (cookie-scoped) client, not the service role — the
// row touched is always the caller's own (id = auth.uid()), and migration
// 001's "profiles: update own" RLS policy already permits exactly that, same
// rationale as PATCH /api/admin/layout (migration 021).

const SECTIONS = ['contact', 'feedback', 'bugs', 'errors'] as const
type Section = (typeof SECTIONS)[number]

function isSection(v: unknown): v is Section {
  return typeof v === 'string' && (SECTIONS as readonly string[]).includes(v)
}

// Postgres 42703 = undefined_column, PostgREST PGRST204 = "column not found
// in schema cache" — both mean migration 023 (admin_seen) hasn't been run in
// this environment yet.
function isMissingColumn(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42703' || error?.code === 'PGRST204'
}

export async function POST(request: NextRequest) {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const section = body?.section

  if (!isSection(section)) {
    return NextResponse.json({ error: 'Invalid section.' }, { status: 400 })
  }

  // Read-modify-write the jsonb column so other sections' timestamps survive
  // — a plain `update` would otherwise clobber the whole column.
  const { data: profileRow, error: readError } = await supabase
    .from('profiles')
    .select('admin_seen')
    .eq('id', user.id)
    .single()

  if (readError) {
    if (isMissingColumn(readError)) {
      // Migration 023 hasn't run yet — no-op; nav-status keeps using its
      // pre-023 fallback semantics until Danny runs it.
      return NextResponse.json({ error: 'Not available yet.' }, { status: 503 })
    }
    console.error('Error reading admin_seen:', readError)
    await logError({
      source: 'api:admin/nav-status/seen',
      message: `Read admin_seen failed: ${readError.message}`,
      detail: readError,
      path: 'POST /api/admin/nav-status/seen',
      userId: user.id,
    })
    return NextResponse.json({ error: 'Failed to mark seen.' }, { status: 500 })
  }

  const existing = profileRow?.admin_seen && typeof profileRow.admin_seen === 'object' ? profileRow.admin_seen : {}
  const merged = { ...existing, [section]: new Date().toISOString() }

  const { error: writeError } = await supabase
    .from('profiles')
    .update({ admin_seen: merged })
    .eq('id', user.id)

  if (writeError) {
    if (isMissingColumn(writeError)) {
      return NextResponse.json({ error: 'Not available yet.' }, { status: 503 })
    }
    console.error('Error saving admin_seen:', writeError)
    await logError({
      source: 'api:admin/nav-status/seen',
      message: `Save admin_seen failed: ${writeError.message}`,
      detail: writeError,
      path: 'POST /api/admin/nav-status/seen',
      userId: user.id,
    })
    return NextResponse.json({ error: 'Failed to mark seen.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
