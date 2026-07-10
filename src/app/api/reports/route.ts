import { createDbClient, createServiceClient } from '@/lib/db'
import { inngest } from '@/lib/inngest'
import { maybeGateReport } from '@/lib/teaser-gating'
import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

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
  return NextResponse.json({ report: await maybeGateReport(createServiceClient(), report) })
}
