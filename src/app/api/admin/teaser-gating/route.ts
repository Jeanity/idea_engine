import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { logError } from '@/lib/log-error'
import { readTeaserGatingConfig, writeTeaserGatingConfig } from '@/lib/teaser-gating'
import { NextResponse, type NextRequest } from 'next/server'

async function requireAdmin() {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { denied: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) }
  if (!isAdminEmail(user.email)) return { denied: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { denied: null }
}

export async function GET() {
  const { denied } = await requireAdmin()
  if (denied) return denied

  const config = await readTeaserGatingConfig(createServiceClient())
  return NextResponse.json(config)
}

// Reversible app-wide toggle → plain PATCH, no typed confirm (deletion
// ground rule only applies to destructive actions).
export async function PATCH(request: NextRequest) {
  const { denied } = await requireAdmin()
  if (denied) return denied

  const body = await request.json().catch(() => ({}))
  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be a boolean.' }, { status: 400 })
  }

  const { error } = await writeTeaserGatingConfig(createServiceClient(), { enabled: body.enabled })
  if (error) {
    console.error('Error updating teaser gating:', error)
    await logError({ source: 'api:admin/teaser-gating', message: `Update teaser gating failed: ${error}`, path: 'PATCH /api/admin/teaser-gating' })
    return NextResponse.json({ error: 'Failed to update teaser gating.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
