import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'fs'
import path from 'path'

export const DEFAULT_MODEL = 'claude-sonnet-5'
const MAX_TOKENS = 4096

/** Cheapest model — used for no-web-search fallback generation. */
export const HAIKU_MODEL = 'claude-haiku-4-5-20251001'

// Per-model pricing in USD per million tokens [input, output].
// Covers every active model on the Anthropic API (aliases). Sonnet 5 is intro
// pricing through 2026-08-31; update to [3, 15] after that if Anthropic does
// not extend the discount.
const MODEL_PRICING: Record<string, [number, number]> = {
  'claude-fable-5':             [10,   50],
  'claude-opus-4-8':            [5,    25],
  'claude-opus-4-7':            [5,    25],
  'claude-opus-4-6':            [5,    25],
  'claude-opus-4-5':            [5,    25],
  'claude-sonnet-5':            [2,    10],
  'claude-sonnet-4-6':          [3,    15],
  'claude-sonnet-4-5':          [3,    15],
  'claude-haiku-4-5':           [1,     5],
  'claude-haiku-4-5-20251001':  [1,     5],
}

/**
 * Selectable models for the admin report-model experiment (admin Settings).
 * One entry per active API model. `note` renders as the hint in the picker.
 */
export const REPORT_MODEL_OPTIONS: Array<{ id: string; label: string; inPerM: number; outPerM: number; note: string }> = [
  { id: 'claude-fable-5',   label: 'Fable 5',    inPerM: 10, outPerM: 50, note: 'Most capable, premium price. Thinking always on (billed as output). May refuse security/bio topics; requires 30-day data retention on the org.' },
  { id: 'claude-opus-4-8',  label: 'Opus 4.8',   inPerM: 5,  outPerM: 25, note: 'Most capable Opus tier.' },
  { id: 'claude-opus-4-7',  label: 'Opus 4.7',   inPerM: 5,  outPerM: 25, note: 'Previous-generation Opus.' },
  { id: 'claude-opus-4-6',  label: 'Opus 4.6',   inPerM: 5,  outPerM: 25, note: 'Older Opus.' },
  { id: 'claude-opus-4-5',  label: 'Opus 4.5',   inPerM: 5,  outPerM: 25, note: 'Legacy Opus.' },
  { id: 'claude-sonnet-5',  label: 'Sonnet 5 (default)', inPerM: 2, outPerM: 10, note: 'App default. Intro pricing through 2026-08-31 (then $3/$15).' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6', inPerM: 3, outPerM: 15, note: 'Previous-generation Sonnet.' },
  { id: 'claude-sonnet-4-5', label: 'Sonnet 4.5', inPerM: 3, outPerM: 15, note: 'Legacy Sonnet.' },
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5',  inPerM: 1,  outPerM: 5,  note: 'Fastest and cheapest. 64K output cap (still far above our per-step caps).' },
]

/** Model ids the admin may select as the report model. */
export function isSelectableReportModel(id: string): boolean {
  return REPORT_MODEL_OPTIONS.some(m => m.id === id)
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
  /** Override model. Defaults to claude-sonnet-5. */
  model?: string
  /** Per-call provider override (e.g. admin demo mode forces 'mock'). Defaults to AI_PROVIDER env. */
  provider?: 'anthropic' | 'mock' | 'ollama'
}

export interface AIResult {
  text: string
  inputTokens: number
  outputTokens: number
  webSearchRequests: number
  /** Model that actually served the call (resolved default, or the mock/ollama id). */
  model: string
  /** Estimated USD cost of this call, including web-search request fees. */
  costUsd: number
}

/**
 * Thrown by callAI when the API responded and was billed but the response is
 * unusable (truncated at max_tokens, or no text block). Carries the already-
 * incurred cost so callers can still account for it — Anthropic bills these
 * calls even though we discard the output. Network failures before a response
 * throw a plain Error (no cost, generally not billed).
 */
export class AICallError extends Error {
  costUsd: number
  inputTokens: number
  outputTokens: number
  webSearchRequests: number
  model: string
  /** 'truncated' = hit max_tokens (retry with a HIGHER cap, same cap will fail again); 'no_text' = no text block. */
  kind: 'truncated' | 'no_text'
  constructor(message: string, fields: { costUsd: number; inputTokens: number; outputTokens: number; webSearchRequests: number; model: string; kind: 'truncated' | 'no_text' }) {
    super(message)
    this.name = 'AICallError'
    this.costUsd = fields.costUsd
    this.inputTokens = fields.inputTokens
    this.outputTokens = fields.outputTokens
    this.webSearchRequests = fields.webSearchRequests
    this.model = fields.model
    this.kind = fields.kind
  }
}

// Anthropic web search: $10 per 1,000 requests (search-result tokens are
// additionally billed as normal input tokens, already counted above).
const WEB_SEARCH_COST_PER_REQUEST = 0.01

// tag -> fixture filename. ':' is not filesystem-friendly, so it's sanitized
// to '-' (report:competitors -> report-competitors.json).
function fixtureFilenameForTag(tag: string): string {
  return `${tag.replace(/:/g, '-')}.json`
}

function readFixture(tag: string): string {
  const filename = fixtureFilenameForTag(tag)
  const filePath = path.join(process.cwd(), 'src/lib/fixtures', filename)
  try {
    return readFileSync(filePath, 'utf-8')
  } catch {
    throw new Error(
      `No mock fixture found for tag="${tag}" (expected src/lib/fixtures/${filename}). ` +
      `Run "npx tsx scripts/capture-fixtures.ts" to generate fixtures.`
    )
  }
}

async function callMock(tag: string): Promise<AIResult> {
  const text = readFixture(tag)
  console.log(JSON.stringify({ event: 'ai_call', tag, provider: 'mock', model: 'mock', input_tokens: 0, output_tokens: 0, web_search_requests: 0, cost_usd: 0 }))
  return { text, inputTokens: 0, outputTokens: 0, webSearchRequests: 0, model: 'mock', costUsd: 0 }
}

async function callOllama({ messages, system, maxTokens, tag = 'unknown', tools }: CallOptions): Promise<AIResult> {
  if (tools) {
    console.warn(`AI_PROVIDER=ollama: web search is unavailable locally (tag=${tag}) — falling back to mock fixture.`)
    return callMock(tag)
  }

  const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
  const model = process.env.OLLAMA_MODEL ?? 'qwen2.5:14b'

  const ollamaMessages = [
    ...(system ? [{ role: 'system', content: system }] : []),
    ...messages.map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    })),
  ]

  let response: Response
  try {
    response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        format: 'json',
        messages: ollamaMessages,
        options: { num_predict: maxTokens ?? MAX_TOKENS },
      }),
    })
  } catch (err) {
    throw new Error(`Failed to reach Ollama at ${baseUrl} — is Ollama running? (ollama serve). Original error: ${err instanceof Error ? err.message : err}`)
  }

  if (!response.ok) {
    throw new Error(`Ollama request failed with status ${response.status} — is Ollama running? (ollama serve)`)
  }

  const data = await response.json()
  const text = (data?.message?.content ?? '').trim()
  const inputTokens = data?.prompt_eval_count ?? 0
  const outputTokens = data?.eval_count ?? 0

  console.log(JSON.stringify({ event: 'ai_call', tag, provider: 'ollama', model, input_tokens: inputTokens, output_tokens: outputTokens, web_search_requests: 0, cost_usd: 0 }))

  return { text, inputTokens, outputTokens, webSearchRequests: 0, model, costUsd: 0 }
}

export async function callAI(options: CallOptions): Promise<AIResult> {
  const provider = options.provider ?? process.env.AI_PROVIDER ?? 'anthropic'
  const { tag = 'unknown' } = options

  if (provider === 'mock') {
    return callMock(tag)
  }

  if (provider === 'ollama') {
    return callOllama(options)
  }

  return callAnthropic(options)
}

async function callAnthropic({ messages, system, maxTokens = MAX_TOKENS, tag = 'unknown', tools, model = DEFAULT_MODEL }: CallOptions): Promise<AIResult> {
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
      provider: 'anthropic',
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      web_search_requests: webSearchRequests,
      cost_usd: costUsd,
    })
  )

  // A max_tokens stop means the output was cut off mid-answer — for JSON
  // responses that guarantees a parse failure downstream, so fail loudly here.
  // The call was still billed, so carry the cost on the error (AICallError).
  if (response.stop_reason === 'max_tokens') {
    throw new AICallError(`Response truncated at ${maxTokens} output tokens (tag=${tag}) — raise maxTokens for this call`,
      { costUsd, inputTokens, outputTokens, webSearchRequests, model, kind: 'truncated' })
  }

  // Extract text blocks — web search responses have tool_use + tool_result blocks mixed in
  const textBlocks = response.content.filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
  if (textBlocks.length === 0) {
    throw new AICallError(`No text block in Claude response. stop_reason=${response.stop_reason}`,
      { costUsd, inputTokens, outputTokens, webSearchRequests, model, kind: 'no_text' })
  }

  // Use the last text block — with web search, Claude writes a preamble before
  // searching and puts the final JSON answer in the last text block.
  const text = textBlocks[textBlocks.length - 1].text.trim()
  return { text, inputTokens, outputTokens, webSearchRequests, model, costUsd }
}
