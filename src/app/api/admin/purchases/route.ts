import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { NextResponse } from 'next/server'

// Admin purchases list (Sales page "Purchases & refunds" section). Standard
// admin gate pattern — the /app/admin layout gates pages only, so this route
// re-checks isAdminEmail itself; the service client is only created after
// that check passes.
//
// Returns the latest 100 purchases enriched with the buyer's email (one
// getUserById per distinct buyer — volumes here are tiny, and the admin page
// filters client-side rather than paging).
export async function GET() {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createServiceClient()
  const { data: purchases, error } = await service
    .from('purchases')
    .select('id, user_id, report_id, stripe_payment_intent_id, amount_cents, currency, status, completed_at, refunded_at, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('Error loading purchases:', error)
    return NextResponse.json({ error: 'Failed to load purchases' }, { status: 500 })
  }

  const userIds = [...new Set((purchases ?? []).map(p => p.user_id))]
  const emails = new Map<string, string>()
  await Promise.all(
    userIds.map(async id => {
      const { data } = await service.auth.admin.getUserById(id)
      if (data?.user?.email) emails.set(id, data.user.email)
    })
  )

  return NextResponse.json({
    purchases: (purchases ?? []).map(p => ({ ...p, email: emails.get(p.user_id) ?? null })),
  })
}
