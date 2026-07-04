import { createDbClient } from '@/lib/db'
import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: idea } = await supabase
    .from('ideas')
    .select('id')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()
  if (!idea) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const { question_key, question_text, answer_text, position } = body

  if (typeof question_key !== 'string' || !question_key) {
    return NextResponse.json({ error: 'Invalid question_key' }, { status: 400 })
  }
  if (typeof answer_text !== 'string' || !answer_text) {
    return NextResponse.json({ error: 'Invalid answer_text' }, { status: 400 })
  }

  const { error } = await supabase.from('answers').upsert({
    idea_id: id,
    question_key,
    question_text: typeof question_text === 'string' ? question_text : question_key,
    answer_text,
    position: typeof position === 'number' ? position : 0,
  }, { onConflict: 'idea_id,question_key' })

  if (error) {
    console.error('Error saving answer:', error)
    return NextResponse.json({ error: 'Failed to save answer' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
