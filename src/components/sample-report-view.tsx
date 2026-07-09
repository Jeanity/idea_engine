'use client'

import { FullReportViewer } from '@/app/app/ideas/[id]/report/report-client'
import { ARCHETYPE_LABELS } from '@/lib/archetype-labels'

/**
 * Shared renderer for sample-report content — used by both the public
 * gallery's built-in fallback card (src/app/sample-report/page.tsx) and the
 * lazy-loaded DB-backed modal (src/app/sample-report/sample-gallery-client.tsx).
 * Wraps the real FullReportViewer with the "this is example content" framing
 * and suppresses navigation on the sample's intentionally-disabled '#' links —
 * a public page must never carry link-rotted or fabricated URLs.
 */
export function SampleReportView({
  title,
  restatement,
  archetype,
  sections,
}: {
  title?: string
  restatement: string
  archetype?: string
  sections: Record<string, unknown>
}) {
  return (
    <div>
      <div className="border-b border-white/10 light:border-gray-200 px-6 py-5">
        <span className="inline-flex items-center rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold tracking-wide text-indigo-200 light:bg-indigo-100 light:text-indigo-700">
          SAMPLE REPORT
        </span>
        {title && <p className="mt-3 text-lg font-semibold text-white light:text-gray-900">{title}</p>}
        <p className="mt-1 text-sm text-slate-300 light:text-gray-600">{restatement}</p>
        {archetype && (
          <span className="mt-2 inline-flex items-center rounded-full bg-white/5 light:bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-300 light:text-gray-600">
            {ARCHETYPE_LABELS[archetype] ?? archetype}
          </span>
        )}
        <p className="mt-3 text-xs text-slate-400 light:text-gray-500">
          This is an example report with illustrative data — links are disabled in the sample.
          Real reports include live competitor, source, and funding links.
        </p>
      </div>

      <div
        onClickCapture={(e) => {
          // Disable ALL links in a sample report, not just literal '#' hrefs —
          // a cloned sample keeps its source report's real competitor/source
          // URLs in the stored jsonb (see sanitizeSectionsForSample), but the
          // public sample page must never let a visitor navigate off it via a
          // link we can't vouch for staying live. Same policy as the
          // hand-written fallback, whose links are literally '#'.
          const anchor = (e.target as HTMLElement).closest('a')
          if (anchor) {
            e.preventDefault()
          }
        }}
      >
        <FullReportViewer
          report={{
            id: 'sample',
            status: 'complete',
            sections,
            preview_sections: {},
            error: null,
          }}
        />
      </div>
    </div>
  )
}
