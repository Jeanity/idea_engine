import Anthropic from '@anthropic-ai/sdk'

// Single model name for all generation tasks — swap here to change everywhere.
const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 4096

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type AIMessage = Anthropic.MessageParam

interface CallOptions {
  messages: AIMessage[]
  system?: string
  maxTokens?: number
  /** Tag logged alongside token counts — use the calling feature name (e.g. 'classifier', 'report:competitors'). */
  tag?: string
}

interface AIResult {
  text: string
  inputTokens: number
  outputTokens: number
}

/**
 * Central wrapper for all Claude API calls.
 * Logs input/output token counts to stdout so cost is always observable.
 * All phases must call through here — never instantiate Anthropic directly.
 */
export async function callAI({ messages, system, maxTokens = MAX_TOKENS, tag = 'unknown' }: CallOptions): Promise<AIResult> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages,
  })

  const inputTokens = response.usage.input_tokens
  const outputTokens = response.usage.output_tokens

  // Structured cost log — easy to grep and pipe to a cost dashboard later
  console.log(
    JSON.stringify({
      event: 'ai_call',
      tag,
      model: MODEL,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      // Approximate cost in USD at claude-sonnet-4-6 pricing ($3/$15 per 1M tokens)
      cost_usd: (inputTokens * 3 + outputTokens * 15) / 1_000_000,
    })
  )

  const block = response.content[0]
  if (block.type !== 'text') {
    throw new Error(`Unexpected response type from Claude: ${block.type}`)
  }

  return { text: block.text, inputTokens, outputTokens }
}
