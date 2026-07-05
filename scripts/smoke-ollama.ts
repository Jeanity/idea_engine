/**
 * Local dev mode smoke check — proves a live Ollama callAI round-trip parses.
 * Requires Ollama running with the configured model pulled.
 * Usage: npx tsx scripts/smoke-ollama.ts
 */
process.env.AI_PROVIDER = 'ollama'
import { callAI } from '../src/lib/ai'
import { CLASSIFY_SYSTEM_PROMPT, buildClassifyUserMessage } from '../src/lib/prompts/classify'

async function main() {
  const { text, costUsd } = await callAI({
    messages: [{ role: 'user', content: buildClassifyUserMessage('home made pet treats', 'Brisbane, Australia') }],
    system: CLASSIFY_SYSTEM_PROMPT,
    maxTokens: 512,
    tag: 'classifier',
  })
  const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)![0])
  console.log('OLLAMA OK — archetype:', parsed.archetype, '| confidence:', parsed.confidence, '| cost:', costUsd)
}

main().catch(e => { console.error('FAIL:', e instanceof Error ? e.message : e); process.exit(1) })
