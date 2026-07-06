import { createDbClient } from '@/lib/db'
import { NextResponse, type NextRequest } from 'next/server'

// Kept in sync with COUNTRY_QUESTION in the questions route — that question
// is injected at request time (not part of the static JSON banks), so its
// required key has to be added here explicitly rather than read from the bank.
const COUNTRY_QUESTION_KEY = 'founder_location_country'
const REGION_QUESTION_KEY = 'founder_location_region'

function loadRequiredKeys(archetype: string): string[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bank = require(`@/lib/questions/${archetype}.json`) as Array<{ key: string; required: boolean }>
    return [...bank.filter(q => q.required).map(q => q.key), COUNTRY_QUESTION_KEY]
  } catch {
    return [COUNTRY_QUESTION_KEY]
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
    .select('question_key, answer_text')
    .eq('idea_id', id)

  const answeredKeys = new Set((answers ?? []).map(a => a.question_key))
  const requiredKeys = loadRequiredKeys(idea.archetype)
  const missing = requiredKeys.filter(k => !answeredKeys.has(k))

  if (missing.length > 0) {
    return NextResponse.json({ error: 'Required questions not answered', missing }, { status: 400 })
  }

  // Country is asked at the questions step, not idea submission — validate
  // and copy it (plus the optional region) into ideas.location_country /
  // location_region here, since the whole report pipeline (currency,
  // compliance, financing) reads those columns directly off the idea row.
  const countryAnswer = (answers ?? []).find(a => a.question_key === COUNTRY_QUESTION_KEY)?.answer_text ?? ''
  const countryCode = countryAnswer.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    return NextResponse.json(
      { error: 'A valid 2-letter country code is required before generating a report.', missing: [COUNTRY_QUESTION_KEY] },
      { status: 400 }
    )
  }
  const regionAnswer = (answers ?? []).find(a => a.question_key === REGION_QUESTION_KEY)?.answer_text ?? ''
  const regionValue = regionAnswer.trim().length > 0 ? regionAnswer.trim() : null

  const { error } = await supabase
    .from('ideas')
    .update({ status: 'researching', location_country: countryCode, location_region: regionValue })
    .eq('id', id)

  if (error) {
    console.error('Error updating idea status:', error)
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
