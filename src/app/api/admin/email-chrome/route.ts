import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { logError } from '@/lib/log-error'
import { readEmailChrome, writeEmailChrome, validateEmailChrome, DEFAULT_EMAIL_CHROME } from '@/lib/email-chrome'
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

  const chrome = await readEmailChrome(createServiceClient())
  return NextResponse.json({ chrome, defaults: DEFAULT_EMAIL_CHROME })
}

// Reversible copy change → plain PATCH, no typed confirm.
export async function PATCH(request: NextRequest) {
  const { denied } = await requireAdmin()
  if (denied) return denied

  const body = await request.json().catch(() => ({}))
  const parsed = validateEmailChrome(body)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { error } = await writeEmailChrome(createServiceClient(), parsed.chrome)
  if (error) {
    console.error('Error updating email chrome:', error)
    await logError({ source: 'api:admin/email-chrome', message: `Update email chrome failed: ${error}`, path: 'PATCH /api/admin/email-chrome' })
    return NextResponse.json({ error: 'Failed to save the email header/footer.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, chrome: parsed.chrome })
}
