import { createDbClient, createServiceClient } from '@/lib/db'
import { NextResponse, type NextRequest } from 'next/server'

// Public, unauthenticated, fire-and-forget page-view ingest. Public pages track
// too, so there is NO auth gate — but the route is deliberately narrow: it only
// ever inserts one row into page_events (never a general write) and updates the
// caller's own last_seen_at heartbeat. It stores NO IP and NO user-agent.
//
// Runs on Node (service-role client + cookie session read). Any failure is
// swallowed and returned as 204 so a tracking hiccup never surfaces to the user.

export const runtime = 'nodejs'

const MAX_BODY_BYTES = 1024
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const UTM_KEYS = ['source', 'medium', 'campaign', 'term', 'content'] as const
const LAST_SEEN_THROTTLE_MS = 60_000

function sanitizeUtm(input: unknown): Record<string, string> | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const out: Record<string, string> = {}
  for (const key of UTM_KEYS) {
    const value = (input as Record<string, unknown>)[key]
    if (typeof value === 'string' && value.length > 0 && value.length <= 200) {
      out[key] = value.slice(0, 200)
    }
  }
  return Object.keys(out).length > 0 ? out : null
}

export async function POST(request: NextRequest) {
  try {
    const raw = await request.text()
    // Cheap size guard — reject oversized bodies before parsing.
    if (raw.length > MAX_BODY_BYTES) return new NextResponse(null, { status: 204 })

    let body: unknown
    try {
      body = JSON.parse(raw)
    } catch {
      return new NextResponse(null, { status: 204 })
    }
    if (!body || typeof body !== 'object') return new NextResponse(null, { status: 204 })

    const b = body as Record<string, unknown>

    // Strict allowlist validation.
    const path = typeof b.path === 'string' ? b.path : null
    if (!path || !path.startsWith('/') || path.length > 512) return new NextResponse(null, { status: 204 })

    const sessionId = typeof b.sid === 'string' && UUID_RE.test(b.sid) ? b.sid : null
    if (!sessionId) return new NextResponse(null, { status: 204 })

    const visitorId = typeof b.vid === 'string' && UUID_RE.test(b.vid) ? b.vid : null
    const isNewSession = b.isNewSession === true
    const referrer =
      isNewSession && typeof b.referrer === 'string' && b.referrer.length <= 1024 ? b.referrer : null
    const utm = isNewSession ? sanitizeUtm(b.utm) : null

    // Optional signed-in user — sendBeacon carries same-origin cookies, so the
    // cookie session client can resolve the user without any auth requirement.
    let userId: string | null = null
    try {
      const authed = await createDbClient()
      const {
        data: { user },
      } = await authed.auth.getUser()
      userId = user?.id ?? null
    } catch {
      userId = null
    }

    const service = createServiceClient()

    // Insert the event — the ONLY write this route makes to arbitrary data.
    await service.from('page_events').insert({
      session_id: sessionId,
      visitor_id: visitorId,
      user_id: userId,
      path,
      referrer,
      utm,
      is_new_session: isNewSession,
    })

    // Signed-in heartbeat — throttled so it stays cheap (only when >60s stale).
    if (userId) {
      const { data: profile } = await service
        .from('profiles')
        .select('last_seen_at')
        .eq('id', userId)
        .single()
      const last = profile?.last_seen_at ? new Date(profile.last_seen_at).getTime() : 0
      if (Date.now() - last > LAST_SEEN_THROTTLE_MS) {
        await service.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', userId)
      }
    }
  } catch {
    // Never surface tracking failures to the caller.
  }

  return new NextResponse(null, { status: 204 })
}
