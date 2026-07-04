import { createDbClient } from '@/lib/db'
import { NextResponse, type NextRequest } from 'next/server'
import type { IdeaArchetype } from '@/lib/database.types'

const VALID_ARCHETYPES: IdeaArchetype[] = [
  'physical_product', 'local_service', 'software_app', 'ecommerce_brand',
  'content_education', 'marketplace', 'invention', 'other',
]

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const { archetype, is_override } = body
  if (!VALID_ARCHETYPES.includes(archetype)) {
    return NextResponse.json({ error: 'Invalid archetype' }, { status: 422 })
  }

  const { error } = await supabase
    .from('ideas')
    .update({
      archetype,
      archetype_source: is_override ? 'user_override' : 'classifier',
      status: 'questioning',
    })
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) return NextResponse.json({ error: 'Failed to update idea' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
