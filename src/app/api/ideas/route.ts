import { createDbClient, createServiceClient } from '@/lib/db'
import { callAI } from '@/lib/ai'
import { providerOverrideForUser } from '@/lib/demo-mode'
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

async function classify(idea: string, location: string | null, provider: 'mock' | undefined): Promise<ClassifyResult> {
  const locationForPrompt = location && location.trim().length > 0 ? location : 'unknown'
  const attempt = async () => {
    const { text } = await callAI({
      messages: [{ role: 'user', content: buildClassifyUserMessage(idea, locationForPrompt) }],
      system: CLASSIFY_SYSTEM_PROMPT,
      maxTokens: 256,
      tag: 'classifier',
      provider,
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

  const { raw_text } = body

  if (!raw_text || typeof raw_text !== 'string' || raw_text.trim().length < 3) {
    return NextResponse.json({ error: 'Idea text is required (min 3 characters)' }, { status: 422 })
  }

  // Location is collected later, at the questions step (country is required
  // there before the report can run) — classification doesn't need it.
  // Demo mode (sitewide or this user's flag) mocks classification too, so a
  // demo account's whole intake→report flow is spend-free.
  const provider = await providerOverrideForUser(createServiceClient(), user.id)
  const result = await classify(raw_text.trim(), null, provider)

  const { data: idea, error } = await supabase
    .from('ideas')
    .insert({
      owner_id: user.id,
      raw_text: raw_text.trim(),
      archetype: result.archetype,
      archetype_source: 'classifier',
      archetype_confidence: result.confidence,
      // NOT NULL + char_length()=2 CHECK constraint — 'ZZ' (ISO 3166
      // user-assigned "unknown") means "not set yet", filled in by the
      // questions-complete step once the founder answers the country question.
      location_country: 'ZZ',
      location_region: null,
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
