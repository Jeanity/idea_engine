import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { logError } from '@/lib/log-error'
import { NextResponse, type NextRequest } from 'next/server'
import type { MessageTemplateKind } from '@/lib/database.types'

// Admin-only CRUD for reusable compose-modal message templates (migration
// 024). Every admin route re-checks isAdminEmail itself — the /app/admin
// layout gate does not protect API routes, per project ground rules. The
// service client is only ever created AFTER that check passes (matches
// src/app/api/admin/contact).

const VALID_KINDS: MessageTemplateKind[] = ['invite', 'contact_reply', 'feedback_reply']

// Postgres 42P01 = undefined_table, PostgREST PGRST205 = "table not found in
// schema cache" — migration 024 (message_templates) not run yet.
function isMissingTable(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

/** The acting admin's email on success, or a NextResponse to return as-is (401/403). */
async function requireAdmin(): Promise<{ email: string } | NextResponse> {
  const supabase = await createDbClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return { email: user.email! }
}

// GET: list templates, optionally filtered by ?kind=. Composing must never
// depend on templates existing, so a missing migration returns an empty
// list + migrationMissing: true rather than an error status — the picker
// component treats that as "render nothing."
export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const kindParam = request.nextUrl.searchParams.get('kind')
  if (kindParam && !VALID_KINDS.includes(kindParam as MessageTemplateKind)) {
    return NextResponse.json({ error: 'Invalid kind.' }, { status: 400 })
  }

  const service = createServiceClient()
  let query = service
    .from('message_templates')
    .select('id, kind, name, body, is_default, created_at, updated_at')
    .order('kind', { ascending: true })
    .order('name', { ascending: true })
  if (kindParam) query = query.eq('kind', kindParam as MessageTemplateKind)

  const { data, error } = await query

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json({ templates: [], migrationMissing: true })
    }
    console.error('Error listing message templates:', error)
    await logError({
      source: 'api:admin/templates',
      message: `List templates failed: ${error.message}`,
      detail: error,
      path: 'GET /api/admin/templates',
    })
    return NextResponse.json({ error: 'Failed to load templates.' }, { status: 500 })
  }

  return NextResponse.json({ templates: data ?? [], migrationMissing: false })
}

// POST: create a template ({ kind, name, body, is_default? }). If is_default
// is true, first clear is_default on the kind's other rows — a separate
// statement, so the partial unique index (migration 024) is a backstop, not
// the primary mechanism.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const body = await request.json().catch(() => ({}))
  const kind = typeof body.kind === 'string' ? (body.kind as MessageTemplateKind) : null
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const templateBody = typeof body.body === 'string' ? body.body.trim() : ''
  const isDefault = body.is_default === true

  if (!kind || !VALID_KINDS.includes(kind)) {
    return NextResponse.json({ error: 'Invalid kind.' }, { status: 400 })
  }
  if (!name || name.length > 80) {
    return NextResponse.json({ error: 'Name is required (max 80 characters).' }, { status: 400 })
  }
  if (!templateBody || templateBody.length > 10000) {
    return NextResponse.json({ error: 'Body is required (max 10,000 characters).' }, { status: 400 })
  }

  const service = createServiceClient()

  if (isDefault) {
    const { error: clearError } = await service
      .from('message_templates')
      .update({ is_default: false })
      .eq('kind', kind)
      .eq('is_default', true)
    if (clearError && isMissingTable(clearError)) {
      return NextResponse.json(
        { error: 'Templates are not available yet — the database migration hasn’t been run.' },
        { status: 503 }
      )
    }
  }

  const { data, error } = await service
    .from('message_templates')
    .insert({ kind, name, body: templateBody, is_default: isDefault })
    .select('id, kind, name, body, is_default, created_at, updated_at')
    .single()

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json(
        { error: 'Templates are not available yet — the database migration hasn’t been run.' },
        { status: 503 }
      )
    }
    console.error('Error creating message template:', error)
    await logError({
      source: 'api:admin/templates',
      message: `Create template failed: ${error.message}`,
      detail: error,
      path: 'POST /api/admin/templates',
    })
    return NextResponse.json({ error: 'Failed to create template.' }, { status: 500 })
  }

  return NextResponse.json({ template: data })
}
