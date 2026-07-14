import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { logError } from '@/lib/log-error'
import { callAI, DEFAULT_MODEL, type AIResult } from '@/lib/ai'
import {
  COMPLIANCE_BASELINE_SYSTEM_PROMPT,
  buildComplianceBaselineMessage,
} from '@/lib/prompts/compliance-baseline'
import { storeEvergreenBaseline, isMissingEvergreenTable } from '@/lib/evergreen'
import type { ComplianceItem } from '@/lib/compliance-baseline'
import { NextResponse, type NextRequest } from 'next/server'

// Workstream C2 — admin-triggered regeneration of one evergreen baseline row.
// Runs the EXACT same generation call as scripts/warm-evergreen.ts and the
// pipeline's evergreen-compliance-baseline aiStep (src/lib/inngest/generate-report.ts):
// same system prompt, same message builder (country + archetype only — no
// region, no idea fields), same tools/maxTokens/model, provider PINNED to
// 'anthropic' (never inherited from AI_PROVIDER — an operator running with
// AI_PROVIDER=mock locally must never be able to write fixture data into the
// shared cache table via this route). On success the row is upserted via
// storeEvergreenBaseline, which always resets review_status to 'unreviewed'
// ("New") and bumps updated_at — this is how a disapproved row gets restored
// to serving, and how the admin nav badge re-lights for the fresh revision.
//
// Auth shape copied verbatim from ../route.ts: isAdminEmail via the RLS
// client BEFORE minting the service client — every admin API route re-checks
// this itself, the /app/admin layout gate does not protect API routes.

async function requireAdmin(): Promise<{ email: string } | NextResponse> {
  const supabase = await createDbClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return { email: user.email! }
}

// ---- Tolerant JSON-array extraction — mirrors extractJson/parseJsonArray in
// src/lib/inngest/generate-report.ts and scripts/warm-evergreen.ts exactly.
// Those are module-private in generate-report.ts (which also registers an
// Inngest function on import, unsafe to import from a route handler) and
// warm-evergreen.ts is a standalone script, not an importable module — so the
// small parsing helpers are duplicated here rather than adding a shared
// module for three call sites of a ~10-line function.
function extractJson(text: string): unknown {
  const arrayMatch = text.match(/\[[\s\S]*\]/)
  const objectMatch = text.match(/\{[\s\S]*\}/)
  const match = arrayMatch && objectMatch
    ? (text.indexOf('[') < text.indexOf('{') ? arrayMatch : objectMatch)
    : arrayMatch ?? objectMatch
  if (!match) throw new Error(`No JSON found in response: ${text.slice(0, 120)}`)
  return JSON.parse(match[0])
}

function parseJsonArray(r: AIResult): unknown[] {
  const parsed = extractJson(r.text)
  if (!Array.isArray(parsed)) throw new Error('Response not a JSON array')
  return parsed
}

// Same tolerance as warm-evergreen.ts's validateItems — parseJsonArray only
// guarantees array-ness, not per-item shape.
function validateItems(raw: unknown[]): ComplianceItem[] {
  const valid: ComplianceItem[] = []
  for (const el of raw) {
    if (el === null || typeof el !== 'object') continue
    const candidate = el as Record<string, unknown>
    if (
      typeof candidate.item === 'string' && candidate.item.trim() !== '' &&
      typeof candidate.summary === 'string' && candidate.summary.trim() !== ''
    ) {
      valid.push(candidate as unknown as ComplianceItem)
    }
  }
  return valid
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const { id } = await params
  if (typeof id !== 'string' || !id) {
    return NextResponse.json({ error: 'Invalid evergreen baseline id' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: row, error: fetchError } = await service
    .from('evergreen_baselines')
    .select('id, country_code, archetype')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    if (isMissingEvergreenTable(fetchError)) {
      return NextResponse.json(
        { error: 'Evergreen baselines table is not available right now — please try again later.' },
        { status: 503 }
      )
    }
    console.error('Error loading evergreen baseline for regeneration:', fetchError)
    await logError({
      source: 'api:admin/evergreen/[id]/regenerate',
      message: `Load evergreen baseline failed: ${fetchError.message}`,
      detail: fetchError,
      path: 'POST /api/admin/evergreen/[id]/regenerate',
    })
    return NextResponse.json({ error: 'Failed to load the baseline.' }, { status: 500 })
  }

  if (!row) {
    return NextResponse.json({ error: 'Evergreen baseline not found.' }, { status: 404 })
  }

  try {
    const r = await callAI({
      messages: [{
        role: 'user',
        content: buildComplianceBaselineMessage({ archetype: row.archetype, location_country: row.country_code }),
      }],
      system: COMPLIANCE_BASELINE_SYSTEM_PROMPT,
      maxTokens: 6144,
      tag: 'admin:evergreen-regenerate',
      tools: [{ type: 'web_search_20250305' as const, name: 'web_search' as const, max_uses: 4 }],
      model: DEFAULT_MODEL,
      // Pinned — never inherit AI_PROVIDER (cache poisoning guard, see file header).
      provider: 'anthropic',
    })

    const rawItems = parseJsonArray(r)
    const validItems = validateItems(rawItems)

    if (validItems.length < 3) {
      return NextResponse.json(
        { error: `Regeneration produced only ${validItems.length} valid item(s) (need at least 3) — the row was left untouched.` },
        { status: 502 }
      )
    }

    const stored = await storeEvergreenBaseline(service, {
      countryCode: row.country_code,
      archetype: row.archetype,
      section: 'compliance',
      items: validItems,
      model: r.model,
      costUsd: r.costUsd,
      // No triggering report — same as the warm script, this is an admin
      // action, not a report-driven cache fill.
      sourceReportId: null,
    })

    if (!stored) {
      return NextResponse.json(
        { error: `Regeneration succeeded ($${r.costUsd.toFixed(4)} spent) but the row could not be stored — please retry.` },
        { status: 502 }
      )
    }

    return NextResponse.json({ ok: true, row: stored, costUsd: r.costUsd })
  } catch (err) {
    const e = err as { costUsd?: number }
    const costUsd = typeof e.costUsd === 'number' ? e.costUsd : 0
    const message = err instanceof Error ? err.message : String(err)
    console.error('Evergreen regeneration failed:', message)
    await logError({
      source: 'api:admin/evergreen/[id]/regenerate',
      message: `Regenerate evergreen baseline failed: ${message}`,
      detail: { costUsd },
      path: 'POST /api/admin/evergreen/[id]/regenerate',
    })
    return NextResponse.json(
      { error: `Regeneration failed: ${message}${costUsd > 0 ? ` ($${costUsd.toFixed(4)} was still spent on the failed call)` : ''} — the row was left untouched.` },
      { status: 502 }
    )
  }
}
