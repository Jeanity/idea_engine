import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest'
import { generateTeaser } from '@/lib/inngest/generate-teaser'

// generate-full-report is registered here once Phase 5 payment triggers it
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generateTeaser],
})
