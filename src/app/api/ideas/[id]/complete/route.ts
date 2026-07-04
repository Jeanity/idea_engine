import { createDbClient } from '@/lib/db'
import { NextResponse, type NextRequest } from 'next/server'

function loadRequiredKeys(archetype: string): string[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bank = require(`@/lib/questions/${archetype}.json`) as Array<{ key: string; required: boolean }>
    return bank.filter(q => q.required).map(q => q.key)
  } catch {
    return []
  }
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: idea } = await supabase
    .from('ideas')
    .select('id, archetype')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()
  if (!idea) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: answers } = await supabase
    .from('answers')
    .select('question_key')
    .eq('idea_id', id)

  const answeredKeys = new Set((answers ?? []).map(a => a.question_key))
  const requiredKeys = loadRequiredKeys(idea.archetype)
  const missing = requiredKeys.filter(k => !answeredKeys.has(k))

  if (missing.length > 0) {
    return NextResponse.json({ error: 'Required questions not answered', missing }, { status: 400 })
  }

  const { error } = await supabase
    .from('ideas')
    .update({ status: 'researching' })
    .eq('id', id)

  if (error) {
    console.error('Error updating idea status:', error)
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
