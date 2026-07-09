import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { logError } from '@/lib/log-error'
import type { Database } from '@/lib/database.types'
import { ESSENTIAL_SERVICE_CATEGORIES } from '@/lib/essential-services'
import { COUNTRIES } from '@/lib/countries'
import { NextResponse, type NextRequest } from 'next/server'

type AffiliateLinkUpdate = Database['public']['Tables']['affiliate_links']['Update']

// Admin CRUD for affiliate_links. The /app/admin layout gates the PAGE, but
// that gate does NOT protect this route — every admin API route re-checks
// isAdminEmail itself, per project ground rules. The service client is only
// ever created AFTER that check passes.

/** 401 if signed out, 403 if not an admin, else null. */
async function requireAdmin() {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function cleanStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v
    .map(x => (typeof x === 'string' ? x.trim().toLowerCase() : ''))
    .filter(Boolean)
}

function validateUrl(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  if (!/^https?:\/\//i.test(s)) return null
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:' ? s : null
  } catch {
    return null
  }
}

const KNOWN_CATEGORY_IDS = new Set(ESSENTIAL_SERVICE_CATEGORIES.map(c => c.id))
const KNOWN_COUNTRY_CODES = new Set(COUNTRIES.map(c => c.code).filter(Boolean))

// category: "None (content link)" → null, or a known essential-services
// registry id. Anything else is rejected rather than silently dropped, so a
// typo in admin doesn't silently fall through to a search-link default.
type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string }

function validateCategory(v: unknown): ValidationResult<string | null> {
  if (v === null || v === undefined || v === '') return { ok: true, value: null }
  if (typeof v === 'string' && KNOWN_CATEGORY_IDS.has(v)) return { ok: true, value: v }
  return { ok: false, error: 'Unknown category.' }
}

function validateCountry(v: unknown): ValidationResult<string | null> {
  if (v === null || v === undefined || v === '') return { ok: true, value: null }
  if (typeof v !== 'string') return { ok: false, error: 'Country must be a 2-letter code.' }
  const code = v.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code) || !KNOWN_COUNTRY_CODES.has(code)) {
    return { ok: false, error: 'Country must be a known 2-letter code.' }
  }
  return { ok: true, value: code }
}

function validateNote(v: unknown): ValidationResult<string | null> {
  if (v === null || v === undefined || v === '') return { ok: true, value: null }
  if (typeof v !== 'string') return { ok: false, error: 'Note must be text.' }
  const note = v.trim()
  if (note.length > 120) return { ok: false, error: 'Note must be 120 characters or fewer.' }
  return { ok: true, value: note || null }
}

// ── Create ──────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied

  const body = await request.json().catch(() => ({}))
  const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const targetUrl = validateUrl(body.target_url)

  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: 'Slug must be lowercase letters, numbers and hyphens.' }, { status: 400 })
  }
  if (!name) return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
  if (!targetUrl) return NextResponse.json({ error: 'Target URL must be a valid http(s) URL.' }, { status: 400 })

  const category = validateCategory(body.category)
  if (!category.ok) return NextResponse.json({ error: category.error }, { status: 400 })
  const country = validateCountry(body.country)
  if (!country.ok) return NextResponse.json({ error: country.error }, { status: 400 })
  const note = validateNote(body.note)
  if (!note.ok) return NextResponse.json({ error: note.error }, { status: 400 })

  const service = createServiceClient()
  const { data, error } = await service
    .from('affiliate_links')
    .insert({
      slug,
      name,
      target_url: targetUrl,
      match_domains: cleanStringArray(body.match_domains),
      match_terms: cleanStringArray(body.match_terms),
      active: body.active === false ? false : true,
      notes: typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null,
      category: category.value,
      country: country.value,
      note: note.value,
    })
    .select('id')
    .single()

  if (error) {
    // 23505 = unique_violation (duplicate slug).
    if (error.code === '23505') {
      return NextResponse.json({ error: 'That slug is already in use.' }, { status: 409 })
    }
    console.error('Error creating affiliate link:', error)
    await logError({ source: 'api:admin/affiliates', message: `Create affiliate link failed: ${error.message}`, detail: error, path: 'POST /api/admin/affiliates' })
    return NextResponse.json({ error: 'Failed to create link.' }, { status: 500 })
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

  const update: AffiliateLinkUpdate = { updated_at: new Date().toISOString() }

  if ('active' in body) {
    if (typeof body.active !== 'boolean') {
      return NextResponse.json({ error: 'active must be a boolean.' }, { status: 400 })
    }
    update.active = body.active
  }
  if ('name' in body) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
    update.name = name
  }
  if ('target_url' in body) {
    const targetUrl = validateUrl(body.target_url)
    if (!targetUrl) return NextResponse.json({ error: 'Target URL must be a valid http(s) URL.' }, { status: 400 })
    update.target_url = targetUrl
  }
  if ('slug' in body) {
    const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : ''
    if (!SLUG_RE.test(slug)) {
      return NextResponse.json({ error: 'Slug must be lowercase letters, numbers and hyphens.' }, { status: 400 })
    }
    update.slug = slug
  }
  if ('match_domains' in body) update.match_domains = cleanStringArray(body.match_domains)
  if ('match_terms' in body) update.match_terms = cleanStringArray(body.match_terms)
  if ('notes' in body) {
    update.notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null
  }
  if ('category' in body) {
    const category = validateCategory(body.category)
    if (!category.ok) return NextResponse.json({ error: category.error }, { status: 400 })
    update.category = category.value
  }
  if ('country' in body) {
    const country = validateCountry(body.country)
    if (!country.ok) return NextResponse.json({ error: country.error }, { status: 400 })
    update.country = country.value
  }
  if ('note' in body) {
    const note = validateNote(body.note)
    if (!note.ok) return NextResponse.json({ error: note.error }, { status: 400 })
    update.note = note.value
  }

  const service = createServiceClient()
  const { error } = await service.from('affiliate_links').update(update).eq('id', id)

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'That slug is already in use.' }, { status: 409 })
    }
    console.error('Error updating affiliate link:', error)
    await logError({ source: 'api:admin/affiliates', message: `Update affiliate link failed: ${error.message}`, detail: error, path: 'PATCH /api/admin/affiliates' })
    return NextResponse.json({ error: 'Failed to update link.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// ── Hard delete (requires explicit confirmation) ────────────────────────
// Deactivate is preferred; a hard delete cascades its clicks. The UI must send
// { confirm: true } after an explicit confirmation step (deletion ground rule).
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
  const { error } = await service.from('affiliate_links').delete().eq('id', id)

  if (error) {
    console.error('Error deleting affiliate link:', error)
    await logError({ source: 'api:admin/affiliates', message: `Delete affiliate link failed: ${error.message}`, detail: error, path: 'DELETE /api/admin/affiliates' })
    return NextResponse.json({ error: 'Failed to delete link.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
