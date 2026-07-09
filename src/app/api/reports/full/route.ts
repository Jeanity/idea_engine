import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { inngest } from '@/lib/inngest'
import { checkAndApplyPromoGate, recordPromoIdentity } from '@/lib/promo'
import { firstForwardedIp } from '@/lib/promo-abuse'
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { randomUUID } from 'node:crypto'

// Anti-abuse cookie (see src/lib/promo-abuse.ts) — only ever set on this
// promo-generation path, not sitewide, and separate from the analytics
// consent cookie (ie_vid/ie_consent).
const AB_COOKIE_NAME = 'ie_ab'
const AB_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 12 months

export async function POST(request: NextRequest) {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const isAdmin = isAdminEmail(user.email)

  const body = await request.json()
  const { idea_id } = body
  if (typeof idea_id !== 'string') {
    return NextResponse.json({ error: 'idea_id required' }, { status: 400 })
  }

  // Ownership check runs for everyone (admin included — admin's "test mode"
  // only ever generates full reports for the admin's OWN ideas via this route).
  const { data: idea } = await supabase
    .from('ideas')
    .select('id')
    .eq('id', idea_id)
    .eq('owner_id', user.id)
    .single()

  if (!idea) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Admin path is unchanged (always allowed — test mode). Non-admin path is
  // gated by promo mode: today there is no payment system, so promo is the
  // only way a regular user can trigger a full report at all. The promo-abuse
  // layer (migration 020) piggybacks on this same gate — see checkAndApplyPromoGate.
  let isPromo = false
  let service: ReturnType<typeof createServiceClient> | null = null
  let promoIdentity: { normalizedEmail: string; ipHash: string | null; abId: string; existingAbId: string | null } | null = null

  if (!isAdmin) {
    service = createServiceClient()
    const cookieStore = await cookies()
    const existingAbId = cookieStore.get(AB_COOKIE_NAME)?.value ?? null
    const ip = firstForwardedIp(request.headers.get('x-forwarded-for'))

    const gate = await checkAndApplyPromoGate(service, user.id, {
      email: user.email ?? '',
      ip,
      abId: existingAbId,
    })
    if (!gate.allowed) {
      return NextResponse.json({ error: gate.message }, { status: 403 })
    }
    isPromo = true
    promoIdentity = {
      normalizedEmail: gate.normalizedEmail,
      ipHash: gate.ipHash,
      abId: existingAbId ?? randomUUID(),
      existingAbId,
    }
  }

  const { data: report } = await supabase
    .from('reports')
    .select('id')
    .eq('idea_id', idea_id)
    .single()

  if (!report) return NextResponse.json({ error: 'No report exists — generate the initial report first' }, { status: 404 })

  // Reset to queued, clear sections (preserve preview_sections for fallback if pipeline fails)
  await supabase
    .from('reports')
    .update({
      status: 'queued',
      sections: {},
      generation_started_at: null,
      generation_completed_at: null,
      ...(isPromo ? { is_promo: true } : {}),
    })
    .eq('id', report.id)

  await inngest.send({
    name: 'idea-engine/full-report.requested',
    data: { reportId: report.id, ideaId: idea_id, userId: user.id },
  })

  if (isPromo && promoIdentity && service) {
    await recordPromoIdentity(service, {
      userId: user.id,
      normalizedEmail: promoIdentity.normalizedEmail,
      ipHash: promoIdentity.ipHash,
      abId: promoIdentity.abId,
    })
  }

  const response = NextResponse.json({ reportId: report.id })
  if (promoIdentity && !promoIdentity.existingAbId) {
    response.cookies.set(AB_COOKIE_NAME, promoIdentity.abId, {
      httpOnly: false,
      maxAge: AB_COOKIE_MAX_AGE,
      path: '/',
    })
  }
  return response
}
