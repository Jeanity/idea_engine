import { callAI } from '@/lib/ai'
import { NextResponse } from 'next/server'

// Smoke-test endpoint for task 1.5 acceptance criteria.
// Remove or protect this route before launch (Phase 6).
export async function GET() {
  const result = await callAI({
    messages: [{ role: 'user', content: 'Reply with the single word: ready' }],
    maxTokens: 10,
    tag: 'smoke-test',
  })
  return NextResponse.json({ ok: true, reply: result.text.trim() })
}
