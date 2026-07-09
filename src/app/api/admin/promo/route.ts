import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { logError } from '@/lib/log-error'
import { isMissingTable } from '@/lib/app-settings'
import {
  readPromoConfig,
  writePromoConfig,
  readPromoUsage,
  readPromoDistinctUsers,
  mergePromoConfig,
  type PromoConfig,
} from '@/lib/promo'
import { NextResponse, type NextRequest } from 'next/server'

// Standard admin gate pattern — every admin API route re-checks isAdminEmail
// itself; the service client is only ever created after that check passes.
async function requireAdmin() {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { denied: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) }
  if (!isAdminEmail(user.email)) return { denied: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { denied: null }
}

// ── Read config + live usage ────────────────────────────────────────────
export async function GET() {
  const { denied } = await requireAdmin()
  if (denied) return denied

  const service = createServiceClient()

  // readPromoConfig/getSetting swallow errors (defaulting to "off") so the
  // rest of the app degrades gracefully — that means it can't distinguish
  // "migration not run" from "no row yet" for this admin page. Probe once
  // directly so the UI can show a run-migration notice instead of a
  // deceptively empty form.
  const probe = await service.from('app_settings').select('key').limit(1)
  if (isMissingTable(probe.error)) {
    return NextResponse.json({ migrationMissing: true })
  }

  const config = await readPromoConfig(service)
  const usage = await readPromoUsage(service, config)
  const distinctUsers = await readPromoDistinctUsers(service, config)
  return NextResponse.json({ config, usage, distinctUsers, migrationMissing: false })
}

function parseCaps(body: Record<string, unknown>): { fields: Partial<PromoConfig> } | { error: string } {
  const fields: Partial<PromoConfig> = {}

  for (const [key, target] of [
    ['spend_cap_usd', 'spend_cap_usd'],
    ['report_cap', 'report_cap'],
    ['per_user_limit', 'per_user_limit'],
  ] as const) {
    if (!(key in body)) continue
    const raw = body[key]
    if (raw === null || raw === '') {
      fields[target] = null
      continue
    }
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) {
      return { error: `${key} must be a non-negative number or blank.` }
    }
    fields[target] = target === 'spend_cap_usd' ? n : Math.floor(n)
  }

  return { fields }
}

// ── Update caps (does not change enabled/started_at/ended_at) ──────────
export async function PATCH(request: NextRequest) {
  const { denied } = await requireAdmin()
  if (denied) return denied

  const body = await request.json().catch(() => ({}))
  const parsed = parseCaps(body)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const service = createServiceClient()
  const current = await readPromoConfig(service)
  const next: PromoConfig = mergePromoConfig({ ...current, ...parsed.fields })

  const { error } = await writePromoConfig(service, next)
  if (error) {
    console.error('Error updating promo config:', error)
    await logError({ source: 'api:admin/promo', message: `Update promo config failed: ${error}`, path: 'PATCH /api/admin/promo' })
    return NextResponse.json({ error: 'Failed to update promo settings.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, config: next })
}

// ── Start / end promo ───────────────────────────────────────────────────
// The UI must send an explicit confirm-backed action — starting opens full
// reports to every signed-in user, ending changes what users see immediately.
export async function POST(request: NextRequest) {
  const { denied } = await requireAdmin()
  if (denied) return denied

  const body = await request.json().catch(() => ({}))
  const action = typeof body.action === 'string' ? body.action : ''
  if (action !== 'start' && action !== 'end') {
    return NextResponse.json({ error: 'action must be "start" or "end".' }, { status: 400 })
  }

  const service = createServiceClient()
  const current = await readPromoConfig(service)

  const next: PromoConfig = action === 'start'
    ? { ...current, enabled: true, started_at: new Date().toISOString(), ended_at: null, ended_reason: null }
    : { ...current, enabled: false, ended_at: new Date().toISOString(), ended_reason: 'manual' }

  const { error } = await writePromoConfig(service, next)
  if (error) {
    console.error('Error toggling promo:', error)
    await logError({ source: 'api:admin/promo', message: `${action} promo failed: ${error}`, path: 'POST /api/admin/promo' })
    return NextResponse.json({ error: 'Failed to update promo status.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, config: next })
}
