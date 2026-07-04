import Anthropic from '@anthropic-ai/sdk'

const DEFAULT_MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 4096

// Per-model pricing in USD per million tokens [input, output]
const MODEL_PRICING: Record<string, [number, number]> = {
  'claude-sonnet-4-6':          [3,    15],
  'claude-haiku-4-5-20251001':  [0.80,  4],
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type AIMessage = Anthropic.MessageParam

interface CallOptions {
  messages: AIMessage[]
  system?: string
  maxTokens?: number
  /** Tag logged alongside token counts — use the calling feature name. */
  tag?: string
  /** Pass web_search tool definition to enable Claude's built-in web search. */
  tools?: Anthropic.Messages.MessageCreateParamsNonStreaming['tools']
  /** Override model. Defaults to claude-sonnet-4-6. */
  model?: string
}

interface AIResult {
  text: string
  inputTokens: number
  outputTokens: number
  /** Estimated USD cost of this call, including web-search request fees. */
  costUsd: number
}

// Anthropic web search: $10 per 1,000 requests (search-result tokens are
// additionally billed as normal input tokens, already counted above).
const WEB_SEARCH_COST_PER_REQUEST = 0.01

export async function callAI({ messages, system, maxTokens = MAX_TOKENS, tag = 'unknown', tools, model = DEFAULT_MODEL }: CallOptions): Promise<AIResult> {
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages,
    ...(tools ? { tools } : {}),
  })

  const inputTokens = response.usage.input_tokens
  const outputTokens = response.usage.output_tokens
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usageAny = response.usage as any
  const webSearchRequests = usageAny?.server_tool_use?.web_search_requests ?? 0
  const [inputRate, outputRate] = MODEL_PRICING[model] ?? MODEL_PRICING[DEFAULT_MODEL]
  const costUsd =
    (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000 +
    webSearchRequests * WEB_SEARCH_COST_PER_REQUEST

  console.log(
    JSON.stringify({
      event: 'ai_call',
      tag,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      web_search_requests: webSearchRequests,
      cost_usd: costUsd,
    })
  )

  // A max_tokens stop means the output was cut off mid-answer — for JSON
  // responses that guarantees a parse failure downstream, so fail loudly here.
  if (response.stop_reason === 'max_tokens') {
    throw new Error(`Response truncated at ${maxTokens} output tokens (tag=${tag}) — raise maxTokens for this call`)
  }

  // Extract text blocks — web search responses have tool_use + tool_result blocks mixed in
  const textBlocks = response.content.filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
  if (textBlocks.length === 0) {
    throw new Error(`No text block in Claude response. stop_reason=${response.stop_reason}`)
  }

  // Use the last text block — with web search, Claude writes a preamble before
  // searching and puts the final JSON answer in the last text block.
  const text = textBlocks[textBlocks.length - 1].text.trim()
  return { text, inputTokens, outputTokens, costUsd }
}
