import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { NextResponse, type NextRequest } from 'next/server'

// Records a refund against a purchase (Sales page "Purchases & refunds").
//
// RECORD-KEEPING ONLY until the payments build wires the Stripe API: the
// actual money movement happens in the Stripe dashboard (the UI deep-links
// to the payment), and this route just keeps our books honest —
// status='refunded' + refunded_at, which the Sales revenue tiles and /terms
// §5 policy flow both rely on. 'unmark' exists for fat-fingered marks; both
// directions are two-step confirmed in the UI.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Missing purchase id.' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const action = typeof body.action === 'string' ? body.action : ''
  if (action !== 'mark' && action !== 'unmark') {
    return NextResponse.json({ error: 'action must be "mark" or "unmark".' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data: purchase } = await service
    .from('purchases')
    .select('id, status')
    .eq('id', id)
    .maybeSingle()

  if (!purchase) return NextResponse.json({ error: 'Purchase not found.' }, { status: 404 })

  // Only a completed purchase can be marked refunded, and only a refunded
  // one can be unmarked — pending/failed rows never had money to refund.
  if (action === 'mark' && purchase.status !== 'complete') {
    return NextResponse.json({ error: `Only completed purchases can be refunded (this one is ${purchase.status}).` }, { status: 400 })
  }
  if (action === 'unmark' && purchase.status !== 'refunded') {
    return NextResponse.json({ error: 'This purchase is not marked refunded.' }, { status: 400 })
  }

  const update = action === 'mark'
    ? { status: 'refunded' as const, refunded_at: new Date().toISOString() }
    : { status: 'complete' as const, refunded_at: null }

  const { error } = await service.from('purchases').update(update).eq('id', id)
  if (error) {
    console.error('Error updating purchase refund state:', error)
    return NextResponse.json({ error: 'Failed to update purchase.' }, { status: 500 })
  }

  console.log(`[admin] purchase ${id} ${action === 'mark' ? 'marked refunded' : 'refund unmarked'} by ${user.email}`)
  return NextResponse.json({ ok: true })
}
