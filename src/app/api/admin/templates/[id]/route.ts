import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { logError } from '@/lib/log-error'
import { NextResponse, type NextRequest } from 'next/server'
import type { MessageTemplateKind } from '@/lib/database.types'

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

// PATCH: update a template's name/body/is_default ({ name?, body?, is_default? }).
// Setting is_default=true first clears is_default on the kind's other rows
// (two statements — the partial unique index from migration 024 is the
// backstop, not the primary mechanism).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Invalid id.' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const update: { name?: string; body?: string; is_default?: boolean } = {}

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name || name.length > 80) {
      return NextResponse.json({ error: 'Name is required (max 80 characters).' }, { status: 400 })
    }
    update.name = name
  }
  if (body.body !== undefined) {
    const templateBody = typeof body.body === 'string' ? body.body.trim() : ''
    if (!templateBody || templateBody.length > 10000) {
      return NextResponse.json({ error: 'Body is required (max 10,000 characters).' }, { status: 400 })
    }
    update.body = templateBody
  }
  if (body.is_default !== undefined) {
    if (typeof body.is_default !== 'boolean') {
      return NextResponse.json({ error: 'is_default must be a boolean.' }, { status: 400 })
    }
    update.is_default = body.is_default
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: existing, error: fetchError } = await service
    .from('message_templates')
    .select('id, kind')
    .eq('id', id)
    .single()

  if (fetchError) {
    if (isMissingTable(fetchError)) {
      return NextResponse.json(
        { error: 'Templates are not available yet — the database migration hasn’t been run.' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: 'Template not found.' }, { status: 404 })
  }
  if (!existing) return NextResponse.json({ error: 'Template not found.' }, { status: 404 })

  if (update.is_default === true) {
    await service
      .from('message_templates')
      .update({ is_default: false })
      .eq('kind', existing.kind as MessageTemplateKind)
      .eq('is_default', true)
      .neq('id', id)
  }

  const { data, error } = await service
    .from('message_templates')
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, kind, name, body, is_default, created_at, updated_at')
    .single()

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json(
        { error: 'Templates are not available yet — the database migration hasn’t been run.' },
        { status: 503 }
      )
    }
    console.error('Error updating message template:', error)
    await logError({
      source: 'api:admin/templates/[id]',
      message: `Update template failed: ${error.message}`,
      detail: error,
      path: 'PATCH /api/admin/templates/[id]',
    })
    return NextResponse.json({ error: 'Failed to update template.' }, { status: 500 })
  }

  return NextResponse.json({ template: data })
}

// DELETE: hard delete. Confirm-gated in the UI (templates admin page), not here.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Invalid id.' }, { status: 400 })

  const service = createServiceClient()
  const { error } = await service.from('message_templates').delete().eq('id', id)

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json(
        { error: 'Templates are not available yet — the database migration hasn’t been run.' },
        { status: 503 }
      )
    }
    console.error('Error deleting message template:', error)
    await logError({
      source: 'api:admin/templates/[id]',
      message: `Delete template failed: ${error.message}`,
      detail: error,
      path: 'DELETE /api/admin/templates/[id]',
    })
    return NextResponse.json({ error: 'Failed to delete template.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
