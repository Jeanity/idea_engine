import { inngest } from '@/lib/inngest'
import { createServiceClient } from '@/lib/db'
import { callAI } from '@/lib/ai'
import { providerOverrideForUser } from '@/lib/demo-mode'
import { TEASER_SYSTEM_PROMPT, buildTeaserMessage } from '@/lib/prompts/teaser'
import { logError, errorMessage } from '@/lib/log-error'
import type { Json } from '@/lib/database.types'

interface Question {
  key: string
  maps_to: string
}

function loadBank(archetype: string): Question[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(`@/lib/questions/${archetype}.json`) as Question[]
  } catch {
    return []
  }
}

function extractJson(text: string): unknown {
  const objectMatch = text.match(/\{[\s\S]*\}/)
  if (!objectMatch) throw new Error(`No JSON object in teaser response: ${text.slice(0, 120)}`)
  return JSON.parse(objectMatch[0])
}

export const generateTeaser = inngest.createFunction(
  {
    id: 'generate-teaser',
    retries: 2,
    triggers: [{ event: 'idea-engine/report.requested' }],
  },
  async ({ event }: { event: { data: { reportId: string; ideaId: string; userId: string } } }) => {
    const { reportId, ideaId, userId } = event.data
    try {
    const supabase = createServiceClient()
    const provider = await providerOverrideForUser(supabase, userId)

    const { data: idea } = await supabase
      .from('ideas')
      .select('id, raw_text, archetype, location_country, location_region, restatement')
      .eq('id', ideaId)
      .single()

    if (!idea) throw new Error(`Idea ${ideaId} not found`)

    const { data: answersRows } = await supabase
      .from('answers')
      .select('question_key, answer_text')
      .eq('idea_id', ideaId)

    const bank = loadBank(idea.archetype)
    const answers = (answersRows ?? []).flatMap(row => {
      const bankQ = bank.find(q => q.key === row.question_key)
      return bankQ ? [{ maps_to: bankQ.maps_to, answer: row.answer_text }] : []
    })

    // Read existing cost before this run so the new total is additive, not a
    // clobbering overwrite (rerun/upgrade scenarios accumulate spend).
    const { data: existingReport } = await supabase
      .from('reports')
      .select('cost_usd')
      .eq('id', reportId)
      .single()

    await supabase
      .from('reports')
      .update({ status: 'running', generation_started_at: new Date().toISOString() })
      .eq('id', reportId)

    const { text, costUsd } = await callAI({
      model: 'claude-haiku-4-5-20251001',
      messages: [{ role: 'user', content: buildTeaserMessage({
        idea_raw_text: idea.raw_text,
        archetype: idea.archetype,
        location_country: idea.location_country,
        location_region: idea.location_region,
        restatement: idea.restatement,
        answers,
      }) }],
      system: TEASER_SYSTEM_PROMPT,
      maxTokens: 1024,
      tag: 'report:teaser',
      provider,
    })

    const teaser = extractJson(text) as {
      summary: unknown
      viability_snapshot: unknown
      next_steps_preview: unknown
    }

    // `teaser` is parsed from the model's JSON response, so its fields are
    // typed `unknown` above for callers; here we're just storing the whole
    // parsed object into the untyped `Json` column, which any JSON.parse
    // result satisfies at runtime.
    await supabase.from('reports').update({
      preview_sections: teaser as unknown as Json,
      sections: {},
      status: 'complete',
      generation_completed_at: new Date().toISOString(),
      model_version: 'claude-haiku-4-5-20251001',
      cost_usd: Math.round(((existingReport?.cost_usd ?? 0) + costUsd) * 10000) / 10000,
    }).eq('id', reportId)
    } catch (err) {
      // Best-effort record then rethrow so Inngest's own retry/failure handling
      // (retries: 2) is unchanged — this only adds visibility to the admin log.
      await logError({
        source: 'inngest:generate-teaser',
        message: `Teaser generation failed for report ${reportId}: ${errorMessage(err)}`,
        detail: err,
        path: 'generate-teaser',
        userId,
      })
      throw err
    }
  }
)
