import { createDbClient } from '@/lib/db'
import { inngest } from '@/lib/inngest'
import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { idea_id } = body
  if (typeof idea_id !== 'string') {
    return NextResponse.json({ error: 'idea_id required' }, { status: 400 })
  }

  const { data: idea } = await supabase
    .from('ideas')
    .select('id')
    .eq('id', idea_id)
    .eq('owner_id', user.id)
    .single()

  if (!idea) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: report } = await supabase
    .from('reports')
    .select('id')
    .eq('idea_id', idea_id)
    .single()

  if (!report) return NextResponse.json({ error: 'No report exists — generate teaser first' }, { status: 404 })

  // Reset to queued, clear sections (preserve preview_sections for fallback if pipeline fails)
  await supabase
    .from('reports')
    .update({
      status: 'queued',
      sections: {},
      generation_started_at: null,
      generation_completed_at: null,
    })
    .eq('id', report.id)

  await inngest.send({
    name: 'idea-engine/full-report.requested',
    data: { reportId: report.id, ideaId: idea_id, userId: user.id },
  })

  return NextResponse.json({ reportId: report.id })
}
