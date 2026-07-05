/**
 * Local dev mode smoke check — proves a mock callAI round-trip parses.
 * Usage: AI_PROVIDER=mock npx tsx scripts/smoke-mock.ts
 */
import { callAI } from '../src/lib/ai'

async function main() {
  if (process.env.AI_PROVIDER !== 'mock') {
    throw new Error('Run this with AI_PROVIDER=mock npx tsx scripts/smoke-mock.ts')
  }

  const { text, inputTokens, outputTokens, costUsd } = await callAI({
    messages: [{ role: 'user', content: 'smoke test' }],
    tag: 'report:synthesis',
  })

  const parsed = JSON.parse(text)
  const requiredKeys = ['summary', 'viability_snapshot', 'pricing_recommendation', 'risks', 'next_steps']
  const missing = requiredKeys.filter(k => !(k in parsed))
  if (missing.length > 0) {
    throw new Error(`Parsed fixture is missing keys: ${missing.join(', ')}`)
  }

  console.log('OK — mock callAI round-trip parsed successfully.')
  console.log(JSON.stringify({ inputTokens, outputTokens, costUsd, keys: Object.keys(parsed) }))
}

main().catch(e => {
  console.error('SMOKE CHECK FAILED:', e)
  process.exit(1)
})
