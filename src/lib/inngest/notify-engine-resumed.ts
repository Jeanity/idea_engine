import { inngest } from '@/lib/inngest'
import { createServiceClient } from '@/lib/db'
import { readServiceMode } from '@/lib/service-mode'
import { buildBrandedEmail, getSiteUrl, sendMail } from '@/lib/mailer'
import { logError } from '@/lib/log-error'

// Batch size mirrors the IONOS SMTP send cap this project stays under
// (Danny's ask, 2026-07-14) — 5/minute, enforced by the sleep between batches
// below rather than trusting the provider not to throttle a burst.
const BATCH_SIZE = 5

// Guards against an infinite loop if something upstream keeps re-inserting
// pending rows forever — 200 batches of 5 is 1,000 emails, generous for any
// realistic notify-list size, and Inngest would time the function out long
// before that anyway.
const MAX_ITERATIONS = 200

type StepTools = {
  run: <T>(id: string, fn: () => Promise<T>) => Promise<T>
  sleep: (id: string, duration: string) => Promise<void>
}

interface BatchResult {
  processed: number
  aborted: boolean
}

export const notifyEngineResumed = inngest.createFunction(
  {
    id: 'engine-resumed-notify',
    retries: 1,
    // Limit 1 so two resumes in quick succession (pause → resume → pause →
    // resume) can never run concurrently and double-send the same batch.
    concurrency: [{ limit: 1 }],
    triggers: [{ event: 'idea-engine/engine.resumed' }],
  },
  async ({ step }: { step: StepTools }) => {
    const supabase = createServiceClient()

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const result = await step.run(`batch-${i}`, async (): Promise<BatchResult> => {
        // Re-paused mid-run — stop immediately rather than keep emailing
        // people that the engine is "back" while it's paused again.
        if (await readServiceMode(supabase)) return { processed: 0, aborted: true }

        const { data: rows } = await supabase
          .from('generation_notify')
          .select('id, user_id, email')
          .is('notified_at', null)
          .order('created_at', { ascending: true })
          .limit(BATCH_SIZE)

        if (!rows || rows.length === 0) return { processed: 0, aborted: false }

        const appUrl = `${getSiteUrl()}/app`
        const { html, text } = await buildBrandedEmail({
          bodyHtml: `<p>Good news — the Engine is back on and generating reports again.</p>
<p><a href="${appUrl}">Head back to your ideas</a></p>
<p>You asked us to let you know — this is that email, and the only one.</p>`,
          bodyText: `Good news — the Engine is back on and generating reports again.\n\nHead back to your ideas: ${appUrl}\n\nYou asked us to let you know — this is that email, and the only one.`,
        })

        for (const row of rows) {
          // Send-then-mark: a crash between the two can rarely double-send on
          // retry — acceptable. The reverse (marked but never sent) is not,
          // so notified_at is set below regardless of whether the send
          // succeeded — a dead address must not wedge the batch loop forever.
          try {
            const { sent } = await sendMail({
              to: row.email,
              subject: 'The Engine is back on',
              html,
              text,
            })
            if (!sent) {
              await logError({
                source: 'inngest:notify-engine-resumed',
                message: `sendMail reported not-sent for user ${row.user_id}`,
                path: 'notify-engine-resumed',
                userId: row.user_id,
              })
            }
          } catch (err) {
            await logError({
              source: 'inngest:notify-engine-resumed',
              message: `Failed to send engine-resumed email to user ${row.user_id}`,
              detail: err,
              path: 'notify-engine-resumed',
              userId: row.user_id,
            })
          }

          await supabase
            .from('generation_notify')
            .update({ notified_at: new Date().toISOString() })
            .eq('id', row.id)
        }

        return { processed: rows.length, aborted: false }
      })

      if (result.aborted) return 'aborted'
      if (result.processed < BATCH_SIZE) return 'done'

      await step.sleep(`sleep-${i}`, '1m')
    }

    return 'max iterations reached'
  }
)
