import { createDbClient } from '@/lib/db'
import { callAI } from '@/lib/ai'
import { CLASSIFY_SYSTEM_PROMPT, buildClassifyUserMessage } from '@/lib/prompts/classify'
import { NextResponse, type NextRequest } from 'next/server'
import type { IdeaArchetype } from '@/lib/database.types'

const VALID_ARCHETYPES: IdeaArchetype[] = [
  'physical_product', 'local_service', 'software_app', 'ecommerce_brand',
  'content_education', 'marketplace', 'invention', 'other',
]

interface ClassifyResult {
  archetype: IdeaArchetype
  confidence: number
  one_line_restatement: string
  detected_signals: string[]
}

async function classify(idea: string, location: string): Promise<ClassifyResult> {
  const attempt = async () => {
    const { text } = await callAI({
      messages: [{ role: 'user', content: buildClassifyUserMessage(idea, location) }],
      system: CLASSIFY_SYSTEM_PROMPT,
      maxTokens: 256,
      tag: 'classifier',
    })
    return JSON.parse(text) as ClassifyResult
  }

  try {
    const result = await attempt()
    if (!VALID_ARCHETYPES.includes(result.archetype)) throw new Error('invalid archetype')
    return result
  } catch {
    // One retry on malformed JSON or invalid archetype
    try {
      const result = await attempt()
      if (!VALID_ARCHETYPES.includes(result.archetype)) throw new Error('invalid archetype')
      return result
    } catch {
      return {
        archetype: 'other',
        confidence: 0.1,
        one_line_restatement: 'Tell us more about your idea so we can classify it accurately.',
        detected_signals: ['classifier fallback after retry'],
      }
    }
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const { raw_text, location_country, location_region } = body

  if (!raw_text || typeof raw_text !== 'string' || raw_text.trim().length < 3) {
    return NextResponse.json({ error: 'Idea text is required (min 3 characters)' }, { status: 422 })
  }
  if (!location_country || typeof location_country !== 'string' || location_country.length !== 2) {
    return NextResponse.json({ error: 'Country code is required (2-letter ISO code)' }, { status: 422 })
  }

  const locationString = [location_region, location_country].filter(Boolean).join(', ')
  const result = await classify(raw_text.trim(), locationString)

  const { data: idea, error } = await supabase
    .from('ideas')
    .insert({
      owner_id: user.id,
      raw_text: raw_text.trim(),
      archetype: result.archetype,
      archetype_source: 'classifier',
      archetype_confidence: result.confidence,
      location_country: location_country.toUpperCase(),
      location_region: location_region ?? null,
      restatement: result.one_line_restatement,
      status: 'draft',
    })
    .select('id')
    .single()

  if (error) {
    console.error('idea insert error', error)
    return NextResponse.json({ error: 'Failed to save idea' }, { status: 500 })
  }

  return NextResponse.json({ id: idea.id, archetype: result.archetype, restatement: result.one_line_restatement })
}
