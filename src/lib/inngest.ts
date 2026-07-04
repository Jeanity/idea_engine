import { Inngest } from 'inngest'

export const inngest = new Inngest({ id: 'idea-engine' })

export interface ReportRequestedEvent {
  name: 'idea-engine/report.requested'
  data: {
    reportId: string
    ideaId: string
    userId: string
  }
}
