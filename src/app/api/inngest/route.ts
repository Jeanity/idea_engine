import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest'
import { generateReport } from '@/lib/inngest/generate-report'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generateReport],
})
