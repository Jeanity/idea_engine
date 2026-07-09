import { createDbClient, createServiceClient } from '@/lib/db'
import { getPromoPublicStatus } from '@/lib/promo'
import { NextResponse } from 'next/server'

// Authenticated (any signed-in user). Returns ONLY what's safe for a regular
// user to see — never caps or spend numbers, see src/lib/promo.ts. Every read
// inside getPromoPublicStatus degrades to "promo off" on error (including
// migration 013 not being run yet), so this route never needs to crash.
export async function GET() {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const service = createServiceClient()
  const status = await getPromoPublicStatus(service, user.id)
  return NextResponse.json(status)
}
