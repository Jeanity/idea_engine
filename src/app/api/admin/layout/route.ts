import { createDbClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { logError } from '@/lib/log-error'
import { NextResponse, type NextRequest } from 'next/server'

// Persists the per-admin dashboard grid layout (order, column span, row
// height — src/app/app/admin/dashboard-grid.tsx) to the caller's own
// profiles row. The /app/admin layout gates the PAGE, not this API route —
// every admin route re-checks isAdminEmail itself, per project ground rules.
//
// Unlike most admin routes, this one writes with the PER-REQUEST (cookie-
// scoped) client rather than the service role. The row touched is always the
// caller's own (`id = auth.uid()`), and migration 001's "profiles: update
// own" RLS policy already permits exactly that — there's no cross-account
// write here for a service client to add value over, so the scoped client
// doubles as a real enforcement backstop instead of a decorative one.

const MAX_LAYOUT_BYTES = 10 * 1024
const MAX_LAYOUT_ITEMS = 200

type WidgetSpan = 1 | 2 | 3 | 4
type WidgetHeight = 'half' | 'full'
interface LayoutItem {
  id: string
  span: WidgetSpan
  height: WidgetHeight
}

function isValidLayout(v: unknown): v is LayoutItem[] {
  if (!Array.isArray(v) || v.length > MAX_LAYOUT_ITEMS) return false
  return v.every(item => {
    if (!item || typeof item !== 'object') return false
    const rec = item as Record<string, unknown>
    return (
      typeof rec.id === 'string' &&
      rec.id.length > 0 &&
      rec.id.length <= 100 &&
      (rec.span === 1 || rec.span === 2 || rec.span === 3 || rec.span === 4) &&
      (rec.height === 'half' || rec.height === 'full')
    )
  })
}

// Postgres 42703 = undefined_column, PostgREST PGRST204 = "column not found
// in schema cache" — both mean migration 021 (admin_dashboard_layout) hasn't
// been run in this environment yet.
function isMissingColumn(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42703' || error?.code === 'PGRST204'
}

export async function PATCH(request: NextRequest) {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const layout = body?.layout === null ? null : body?.layout

  if (layout !== null) {
    if (!isValidLayout(layout)) {
      return NextResponse.json({ error: 'Invalid layout payload.' }, { status: 400 })
    }
    const byteSize = new TextEncoder().encode(JSON.stringify(layout)).length
    if (byteSize > MAX_LAYOUT_BYTES) {
      return NextResponse.json({ error: 'Layout payload too large.' }, { status: 400 })
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ admin_dashboard_layout: layout })
    .eq('id', user.id)

  if (error) {
    if (isMissingColumn(error)) {
      // Migration 021 hasn't run yet — the save is a no-op; the client keeps
      // relying on localStorage until this environment is migrated.
      return NextResponse.json({ error: 'Layout persistence not available yet.' }, { status: 503 })
    }
    console.error('Error saving admin dashboard layout:', error)
    await logError({
      source: 'api:admin/layout',
      message: `Save dashboard layout failed: ${error.message}`,
      detail: error,
      path: 'PATCH /api/admin/layout',
      userId: user.id,
    })
    return NextResponse.json({ error: 'Failed to save layout.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
