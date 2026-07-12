import { inngest } from '@/lib/inngest'
import { createServiceClient } from '@/lib/db'
import { callAI } from '@/lib/ai'
import { providerOverrideForUser } from '@/lib/demo-mode'
import { TEASER_SYSTEM_PROMPT, buildTeaserMessage } from '@/lib/prompts/teaser'
import { logError, errorMessage } from '@/lib/log-error'
import type { Json } from '@/lib/database.types'
import { loadQuestionBank, filterVisibleAnswers } from '@/lib/question-bank'

function extractJson(text: string): unknown {
  const objectMatch = text.match(/\{[\s\S]*\}/)
  if (!objectMatch) throw new Error(`No JSON object in teaser response: ${text.slice(0, 120)}`)
  return JSON.parse(objectMatch[0])
}

export const generateTeaser = inngest.createFunction(
  {
    id: 'generate-teaser',
    retries: 2,
    // Teasers are one small no-search Haiku call, so the cap is generous —
    // it exists only so a signup burst can't trip Anthropic request-rate
    // limits. Kept well above generate-report's cap because a teaser is
    // watched live by the user; queueing here hurts UX far more.
    concurrency: [{ limit: 25 }],
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

    // Stale hidden-branch answers (show_if no longer matches after the
    // founder changed a controlling answer) are dropped before they reach
    // the teaser prompt — see src/lib/question-bank.ts.
    const bank = loadQuestionBank(idea.archetype)
    const visibleAnswersRows = filterVisibleAnswers(bank, answersRows ?? [])
    const answers = visibleAnswersRows.flatMap(row => {
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
      maxTokens: 2048,
      tag: 'report:teaser',
      provider,
    })

    const parsed = extractJson(text) as {
      summary?: { text?: unknown }
      viability_snapshot?: { scores?: unknown; overall_verdict?: unknown }
      next_steps?: unknown
      next_steps_preview?: unknown
      [key: string]: unknown
    }

    // The prompt's output key is `next_steps`, but tolerate an older/odd
    // model response still using the pre-rename `next_steps_preview` key —
    // normalise at the source rather than storing an unreadable teaser.
    if (parsed.next_steps === undefined && parsed.next_steps_preview !== undefined) {
      parsed.next_steps = parsed.next_steps_preview
      delete parsed.next_steps_preview
    }

    // Shape validation: a truncated or malformed response (maxTokens cutoff,
    // model drift) must not be stored as a "complete" teaser — throw so
    // Inngest's retries: 2 regenerates it instead.
    if (typeof parsed.summary?.text !== 'string' || !parsed.summary.text.trim()) {
      throw new Error(`Teaser response missing summary.text: ${text.slice(0, 200)}`)
    }
    if (typeof parsed.viability_snapshot?.scores !== 'object' || parsed.viability_snapshot.scores === null) {
      throw new Error(`Teaser response missing viability_snapshot.scores: ${text.slice(0, 200)}`)
    }

    const teaser = parsed

    // `teaser` is parsed from the model's JSON response, so its fields are
    // typed `unknown`/optional above for callers; here we're just storing
    // the whole parsed object into the untyped `Json` column, which any
    // JSON.parse result satisfies at runtime.
    await supabase.from('reports').update({
      preview_sections: teaser as unknown as Json,
      sections: {},
      status: 'complete',
      generation_completed_at: new Date().toISOString(),
      teaser_completed_at: new Date().toISOString(),
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
