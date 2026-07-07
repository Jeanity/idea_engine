import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import type { Database, OfferAudience } from '@/lib/database.types'
import { NextResponse, type NextRequest } from 'next/server'

type OfferUpdate = Database['public']['Tables']['offers']['Update']

// Admin CRUD for offers. The /app/admin layout gates the PAGE, but that gate
// does NOT protect this route — every admin API route re-checks isAdminEmail
// itself, per project ground rules. The service client is only ever created
// AFTER that check passes. Redemption/enforcement (Stripe) is out of scope —
// this route only creates/edits the scaffolding rows.

/** 401 if signed out, 403 if not an admin, else null. */
async function requireAdmin() {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

const CODE_RE = /^[A-Z0-9]+(?:[_-][A-Z0-9]+)*$/
const AUDIENCES: OfferAudience[] = ['new_users', 'account_holders', 'everyone']

function validateAudience(v: unknown): OfferAudience | null {
  return typeof v === 'string' && (AUDIENCES as string[]).includes(v) ? (v as OfferAudience) : null
}

/** Parses an optional ISO datetime string; returns undefined (unset), null (explicit clear), or a valid ISO string. Invalid input is signalled with the sentinel `false`. */
function parseOptionalDate(v: unknown): string | null | undefined | false {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  if (typeof v !== 'string') return false
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? false : d.toISOString()
}

interface ParsedOfferFields {
  code?: string
  description?: string
  percent_off?: number | null
  amount_off_cents?: number | null
  audience?: OfferAudience
  show_on_homepage?: boolean
  show_in_account?: boolean
  starts_at?: string
  ends_at?: string | null
  max_redemptions?: number | null
  active?: boolean
}

/** Validates whichever of the offer fields are present in `body`. Returns either the parsed fields or an error message. */
function parseFields(body: Record<string, unknown>, { requireAll }: { requireAll: boolean }): { fields: ParsedOfferFields } | { error: string } {
  const fields: ParsedOfferFields = {}

  if (requireAll || 'code' in body) {
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
    if (!CODE_RE.test(code)) return { error: 'Code must be uppercase letters, numbers, hyphens and underscores.' }
    fields.code = code
  }

  if (requireAll || 'description' in body) {
    const description = typeof body.description === 'string' ? body.description.trim() : ''
    if (!description) return { error: 'Description is required.' }
    fields.description = description
  }

  if (requireAll || 'percent_off' in body) {
    const raw = body.percent_off
    if (raw === null || raw === '' || raw === undefined) {
      fields.percent_off = null
    } else {
      const n = Number(raw)
      if (!Number.isInteger(n) || n < 1 || n > 100) return { error: 'Percent off must be an integer between 1 and 100.' }
      fields.percent_off = n
    }
  }

  if (requireAll || 'amount_off_cents' in body) {
    const raw = body.amount_off_cents
    if (raw === null || raw === '' || raw === undefined) {
      fields.amount_off_cents = null
    } else {
      const n = Number(raw)
      if (!Number.isInteger(n) || n < 1) return { error: 'Amount off must be a positive whole number of cents.' }
      fields.amount_off_cents = n
    }
  }

  if (fields.percent_off != null && fields.amount_off_cents != null) {
    return { error: 'Set either percent off or amount off, not both.' }
  }

  if (requireAll || 'audience' in body) {
    const audience = validateAudience(body.audience)
    if (!audience) return { error: 'Audience must be one of new_users, account_holders, everyone.' }
    fields.audience = audience
  }

  if (requireAll || 'show_on_homepage' in body) {
    if (typeof body.show_on_homepage !== 'boolean') return { error: 'show_on_homepage must be a boolean.' }
    fields.show_on_homepage = body.show_on_homepage
  }

  if (requireAll || 'show_in_account' in body) {
    if (typeof body.show_in_account !== 'boolean') return { error: 'show_in_account must be a boolean.' }
    fields.show_in_account = body.show_in_account
  }

  if (requireAll || 'starts_at' in body) {
    const parsed = parseOptionalDate(body.starts_at)
    if (parsed === false) return { error: 'starts_at must be a valid date.' }
    fields.starts_at = parsed ?? new Date().toISOString()
  }

  if (requireAll || 'ends_at' in body) {
    const parsed = parseOptionalDate(body.ends_at)
    if (parsed === false) return { error: 'ends_at must be a valid date.' }
    fields.ends_at = parsed
  }

  if (fields.starts_at && fields.ends_at && new Date(fields.ends_at) <= new Date(fields.starts_at)) {
    return { error: 'End date must be after the start date.' }
  }

  if (requireAll || 'max_redemptions' in body) {
    const raw = body.max_redemptions
    if (raw === null || raw === '' || raw === undefined) {
      fields.max_redemptions = null
    } else {
      const n = Number(raw)
      if (!Number.isInteger(n) || n < 1) return { error: 'Max redemptions must be a positive whole number.' }
      fields.max_redemptions = n
    }
  }

  if (requireAll || 'active' in body) {
    fields.active = body.active === false ? false : true
  }

  return { fields }
}

// ── Create ──────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied

  const body = await request.json().catch(() => ({}))
  const parsed = parseFields(body, { requireAll: true })
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  // requireAll: true guarantees code/description are set — parseFields'
  // return type stays fully-optional because it's shared with the PATCH
  // (partial-update) path, so narrow it here for the Insert shape.
  const insert: Database['public']['Tables']['offers']['Insert'] = {
    ...parsed.fields,
    code: parsed.fields.code!,
    description: parsed.fields.description!,
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('offers')
    .insert(insert)
    .select('id')
    .single()

  if (error) {
    // 23505 = unique_violation (duplicate code).
    if (error.code === '23505') {
      return NextResponse.json({ error: 'That code is already in use.' }, { status: 409 })
    }
    console.error('Error creating offer:', error)
    return NextResponse.json({ error: 'Failed to create offer.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: data.id })
}

// ── Update / toggle active ──────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied

  const body = await request.json().catch(() => ({}))
  const id = typeof body.id === 'string' ? body.id : ''
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })

  const parsed = parseFields(body, { requireAll: false })
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const update: OfferUpdate = parsed.fields

  const service = createServiceClient()
  const { error } = await service.from('offers').update(update).eq('id', id)

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'That code is already in use.' }, { status: 409 })
    }
    console.error('Error updating offer:', error)
    return NextResponse.json({ error: 'Failed to update offer.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// ── Hard delete (requires explicit confirmation) ────────────────────────
// Deactivate is preferred (keeps history + redemption_count intact). A hard
// delete permanently removes the row. The UI must send { confirm: true }
// after an explicit confirmation step (deletion ground rule).
export async function DELETE(request: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied

  const body = await request.json().catch(() => ({}))
  const id = typeof body.id === 'string' ? body.id : ''
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })
  if (body.confirm !== true) {
    return NextResponse.json({ error: 'Deletion must be confirmed.' }, { status: 400 })
  }

  const service = createServiceClient()
  const { error } = await service.from('offers').delete().eq('id', id)

  if (error) {
    console.error('Error deleting offer:', error)
    return NextResponse.json({ error: 'Failed to delete offer.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
