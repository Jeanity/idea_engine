import { createDbClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { demo_mode } = body
  if (typeof demo_mode !== 'boolean') {
    return NextResponse.json({ error: 'demo_mode must be a boolean' }, { status: 400 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ demo_mode })
    .eq('id', user.id)

  if (error) {
    console.error('Error updating demo_mode:', error)
    return NextResponse.json({ error: 'Failed to update demo mode' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, demo_mode })
}
