'use client'

import { FullReportViewer } from '@/app/app/ideas/[id]/report/report-client'
import { SAMPLE_REPORT_SECTIONS } from '@/lib/sample-report'

/**
 * Wraps the real report viewer with the sample data and suppresses
 * navigation on the sample's intentionally-disabled '#' links.
 */
export function SampleReportClient() {
  return (
    <div
      onClickCapture={(e) => {
        const anchor = (e.target as HTMLElement).closest('a')
        if (anchor?.getAttribute('href') === '#') {
          e.preventDefault()
        }
      }}
    >
      <FullReportViewer
        report={{
          id: 'sample',
          status: 'complete',
          sections: SAMPLE_REPORT_SECTIONS,
          preview_sections: {},
          error: null,
        }}
      />
    </div>
  )
}
