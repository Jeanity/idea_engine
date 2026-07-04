import { createDbClient } from '@/lib/db'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET() {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, default_country, default_region, marketing_opt_in')
    .eq('id', user.id)
    .single()

  return NextResponse.json({ email: user.email, profile })
}

export async function PUT(request: NextRequest) {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json()

  const username: string | null = body.username?.trim() || null
  const display_name: string | null = body.display_name?.trim() || null
  const default_country: string | null = body.default_country?.trim() || null
  const default_region: string | null = body.default_region?.trim() || null
  const marketing_opt_in: boolean = body.marketing_opt_in === true

  if (username !== null) {
    if (username.length < 3 || username.length > 30) {
      return NextResponse.json({ error: 'Username must be 3–30 characters' }, { status: 422 })
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json({ error: 'Username may only contain letters, numbers, and underscores' }, { status: 422 })
    }
  }

  if (default_country !== null && default_country.length !== 2) {
    return NextResponse.json({ error: 'Country must be a 2-letter ISO code' }, { status: 422 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ username, display_name, default_country, default_region, marketing_opt_in })
    .eq('id', user.id)

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'That username is already taken' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
