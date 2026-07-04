import { createDbClient } from '@/lib/db'
import { inngest } from '@/lib/inngest'
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
  const { data: existing } = await supabase
    .from('reports')
    .select('id, status')
    .eq('idea_id', idea_id)
    .single()

  if (existing && existing.status !== 'failed') {
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

  return NextResponse.json({ report })
}
