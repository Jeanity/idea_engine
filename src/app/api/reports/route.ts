import { createDbClient, createServiceClient } from '@/lib/db'
import { inngest } from '@/lib/inngest'
import { maybeGateReport } from '@/lib/teaser-gating'
import { isAdminEmail } from '@/lib/admin'
import { readServiceMode, SERVICE_MODE_MESSAGE } from '@/lib/service-mode'
import {
  countRecentIdeas,
  evaluateGenerationLimit,
  isPayingCustomer,
  GENERATION_LIMIT_MESSAGE,
} from '@/lib/generation-limit'
import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  // Engine kill switch (src/lib/service-mode.ts): both a fresh teaser and a
  // forced regeneration spend AI, so both must stop here — before the ownership
  // read below, let alone the Inngest fire. Admin bypass so Danny can keep
  // testing while paused.
  if (!isAdminEmail(user.email) && (await readServiceMode(createServiceClient()))) {
    return NextResponse.json({ error: SERVICE_MODE_MESSAGE, service_mode: true }, { status: 503 })
  }

  const body = await request.json()
  const { idea_id } = body
  if (typeof idea_id !== 'string') {
    return NextResponse.json({ error: 'idea_id required' }, { status: 400 })
  }

  // Verify ownership + status
  const { data: idea } = await supabase
    .from('ideas')
    .select('id, status')
    .eq('id', idea_id)
    .eq('owner_id', user.id)
    .single()

  if (!idea) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (idea.status !== 'researching' && idea.status !== 'ready') {
    return NextResponse.json({ error: 'Idea must be in researching status' }, { status: 400 })
  }

  // Check for an existing non-failed report
  const force = body.force === true

  const { data: existing } = await supabase
    .from('reports')
    .select('id, status, created_at, generation_started_at')
    .eq('idea_id', idea_id)
    .single()

  // A queued report whose event was lost (or a run that died) would block
  // regeneration forever — treat it as stale and re-fire instead of returning it.
  const STALE_MS = 10 * 60 * 1000
  const age = existing ? Date.now() - new Date(existing.created_at).getTime() : 0
  const startedAge = existing?.generation_started_at
    ? Date.now() - new Date(existing.generation_started_at).getTime()
    : null
  const stale =
    existing != null &&
    ((existing.status === 'queued' && existing.generation_started_at === null && age > STALE_MS) ||
      (existing.status === 'running' && startedAge !== null && startedAge > STALE_MS))

  // Abuse-resistant generation limit (src/lib/generation-limit.ts) — only a
  // fresh generation (no report yet) or an explicit forced regeneration can
  // possibly be blocked, so the common "just return the existing report"
  // path below never pays for the extra DB reads this needs.
  const isFreshGeneration = !existing
  const isForcedRegeneration = force && existing != null
  if (isFreshGeneration || isForcedRegeneration) {
    // Bypasses checked cheapest-first: admin is a free header check; paying
    // customer needs a query, but skips the (also billable-in-latency)
    // new-idea count query below when it already applies.
    const isBypass = isAdminEmail(user.email) || (await isPayingCustomer(supabase, user.id))
    const newIdeaCount = !isBypass && isFreshGeneration ? await countRecentIdeas(supabase, user.id, Date.now()) : 0
    const limit = evaluateGenerationLimit({
      isBypass,
      isFreshGeneration,
      newIdeaCount,
      isForcedRegeneration,
      isStaleRescue: stale,
      generationStartedAt: existing?.generation_started_at ? new Date(existing.generation_started_at) : null,
      now: Date.now(),
    })
    if (!limit.allowed) {
      return NextResponse.json({ error: GENERATION_LIMIT_MESSAGE }, { status: 429 })
    }
  }

  if (existing && existing.status !== 'failed' && !force && !stale) {
    return NextResponse.json({ reportId: existing.id, status: existing.status })
  }

  // Create (or recreate after failure) the report row
  const { data: report, error } = await supabase
    .from('reports')
    .upsert({
      idea_id,
      owner_id: user.id,
      status: 'queued',
      sections: {},
      preview_sections: {},
    }, { onConflict: 'idea_id' })
    .select('id')
    .single()

  if (error || !report) {
    console.error('Error creating report:', error)
    return NextResponse.json({ error: 'Failed to create report' }, { status: 500 })
  }

  // Fire the Inngest event
  await inngest.send({
    name: 'idea-engine/report.requested',
    data: { reportId: report.id, ideaId: idea_id, userId: user.id },
  })

  return NextResponse.json({ reportId: report.id, status: 'queued' })
}

export async function GET(request: NextRequest) {
  const ideaId = request.nextUrl.searchParams.get('idea_id')
  if (!ideaId) return NextResponse.json({ error: 'idea_id required' }, { status: 400 })

  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: report } = await supabase
    .from('reports')
    .select('id, status, sections, preview_sections, error, generation_started_at, generation_completed_at')
    .eq('idea_id', ideaId)
    .single()

  if (!report) return NextResponse.json({ report: null })

  // This poll is the main delivery path for a fresh teaser — the redaction
  // must happen here, not just in the page's server render, or the polled
  // payload would overwrite the gated one with the full snapshot. The
  // service client only reads the app-global toggle (app_settings has no
  // RLS policies at all); the report row itself came through RLS above.
  const service = createServiceClient()

  // Queue depth for the progress screen's "you're in line" notice — only
  // computed while this report is actually waiting (queued is a rare,
  // short-lived state, so the extra count query almost never runs). A bare
  // count of queued reports is the only cross-user fact that ships: no ids,
  // no owners, no position ranking (deliberately — see the progress screen).
  let queueDepth: number | undefined
  if (report.status === 'queued') {
    const { count } = await service
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'queued')
    queueDepth = count ?? undefined
  }

  return NextResponse.json({ report: await maybeGateReport(service, report), queueDepth })
}
