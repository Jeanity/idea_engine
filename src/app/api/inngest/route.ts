import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest'
import { generateTeaser } from '@/lib/inngest/generate-teaser'
import { generateReport } from '@/lib/inngest/generate-report'
import { notifyEngineResumed } from '@/lib/inngest/notify-engine-resumed'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generateTeaser, generateReport, notifyEngineResumed],
})
