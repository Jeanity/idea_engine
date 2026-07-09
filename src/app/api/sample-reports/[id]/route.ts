import { createPublicClient } from '@/lib/db'
import { NextResponse, type NextRequest } from 'next/server'

// Anonymous, unauthenticated endpoint used by the /sample-report gallery's
// modal to lazy-load one sample's full sections (they're large — the gallery
// page itself only ships id/title/archetype/restatement/headline_score, not
// every sample's jsonb). Uses the anon client so Postgres RLS — not app code
// — is what keeps inactive samples out of reach here.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })

  const publicClient = createPublicClient()
  const { data, error } = await publicClient
    .from('sample_reports')
    .select('title, archetype, restatement, sections')
    .eq('id', id)
    .eq('active', true)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Sample not found.' }, { status: 404 })
  }

  return NextResponse.json({
    title: data.title,
    archetype: data.archetype,
    restatement: data.restatement,
    sections: data.sections,
  })
}
