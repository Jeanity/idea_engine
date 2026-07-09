import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { inngest } from '@/lib/inngest'
import { checkAndApplyPromoGate } from '@/lib/promo'
import { NextResponse, type NextRequest } from 'next/server'

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
  // only way a regular user can trigger a full report at all.
  let isPromo = false
  if (!isAdmin) {
    const service = createServiceClient()
    const gate = await checkAndApplyPromoGate(service, user.id)
    if (!gate.allowed) {
      return NextResponse.json({ error: gate.message }, { status: 403 })
    }
    isPromo = true
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

  return NextResponse.json({ reportId: report.id })
}
