import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/db'
import { ARCHETYPE_LABELS } from '@/lib/archetype-labels'
import type { BugReportStatus, ReportStatus } from '@/lib/database.types'

export const metadata = { title: 'Report — Admin — HadIdea' }

// This page lives under src/app/app/admin/, whose layout.tsx already gates on
// isAdminEmail (redirects non-admins to /app before this ever renders).
// Reading another user's report (and their bug_reports rows) via
// createServiceClient here is safe BECAUSE that gate already ran — the RLS
// client can't do this (ReportPageContent 404s on someone else's idea by
// design), so this page exists specifically so an admin can eyeball what the
// AI produced for a report a user flagged a bug against.

const cardCls =
  'rounded-lg border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm px-5 py-5'

const statusColor: Record<ReportStatus, string> = {
  complete: 'bg-emerald-500/10 text-emerald-300 light:bg-emerald-50 light:text-emerald-700',
  running: 'bg-amber-500/10 text-amber-300 light:bg-amber-50 light:text-amber-700',
  queued: 'bg-white/10 text-slate-300 light:bg-gray-100 light:text-gray-600',
  failed: 'bg-red-500/10 text-red-300 light:bg-red-50 light:text-red-700',
}

const bugStatusTone: Record<BugReportStatus, string> = {
  open: 'bg-indigo-500/15 text-indigo-300 light:bg-indigo-100 light:text-indigo-700',
  triaged: 'bg-amber-500/15 text-amber-300 light:bg-amber-100 light:text-amber-700',
  resolved: 'bg-emerald-500/15 text-emerald-300 light:bg-emerald-100 light:text-emerald-700',
  wontfix: 'bg-white/10 text-slate-400 light:bg-gray-100 light:text-gray-500',
}

// Shape of _meta as written by src/lib/inngest/generate-report.ts's `assemble`
// step — not a formal schema, just what the pipeline happens to write.
interface StepMeta {
  status?: string
  model?: string
  input_tokens?: number
  output_tokens?: number
  web_search_requests?: number
  cost_usd?: number
  error?: string
}

// Workstream D3: the evergreen stash the pipeline writes to _meta when a
// canonical baseline was served this run (see evergreenMetaStash in
// src/lib/inngest/generate-report.ts and the shared shape in
// src/lib/evergreen-remediation.ts's PatchableSections).
interface EvergreenMetaStash {
  id: string
  updated_at: string
  review_status_at_use: string
}

interface ReportMeta {
  cost_usd?: number
  model?: string
  partial?: boolean
  section_status?: Record<string, string>
  steps?: Record<string, StepMeta>
  evergreen?: EvergreenMetaStash
}

interface BugRow {
  id: string
  created_at: string
  status: BugReportStatus
  report_tab: string | null
  description: string
  page_url: string | null
  browser_info: string | null
  screenshot_url: string | null
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export default async function AdminReportInspectorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const service = createServiceClient()

  const { data: report } = await service
    .from('reports')
    .select('id, idea_id, owner_id, status, model_version, cost_usd, sections, generation_started_at, generation_completed_at, error')
    .eq('id', id)
    .maybeSingle()

  if (!report) notFound()

  const [{ data: idea }, { data: authData }, { data: profile }] = await Promise.all([
    service
      .from('ideas')
      .select('restatement, archetype, location_country, location_region, raw_text')
      .eq('id', report.idea_id)
      .maybeSingle(),
    service.auth.admin.getUserById(report.owner_id),
    service.from('profiles').select('username, display_name').eq('id', report.owner_id).maybeSingle(),
  ])

  const ownerEmail = authData?.user?.email ?? null
  const ownerLabel = ownerEmail ?? profile?.username ?? profile?.display_name ?? report.owner_id

  // bug_reports may not exist yet (migration 018 not run) or the query may
  // otherwise fail — either way this is supplementary context, not the
  // page's reason to exist, so any failure just means "no bugs to show".
  let bugs: BugRow[] = []
  const { data: bugRows } = await service
    .from('bug_reports')
    .select('id, created_at, status, report_tab, description, page_url, browser_info, screenshot_path')
    .eq('report_id', id)
    .order('created_at', { ascending: false })

  if (bugRows) {
    bugs = await Promise.all(
      bugRows.map(async row => {
        let screenshotUrl: string | null = null
        if (row.screenshot_path) {
          const { data: signed } = await service.storage
            .from('bug-screenshots')
            .createSignedUrl(row.screenshot_path, 3600)
          screenshotUrl = signed?.signedUrl ?? null
        }
        return {
          id: row.id,
          created_at: row.created_at,
          status: row.status,
          report_tab: row.report_tab,
          description: row.description,
          page_url: row.page_url,
          browser_info: row.browser_info,
          screenshot_url: screenshotUrl,
        }
      })
    )
  }

  const sectionsObj = isRecord(report.sections) ? report.sections : {}
  const meta = isRecord(sectionsObj._meta) ? (sectionsObj._meta as ReportMeta) : null
  const sectionKeys = Object.keys(sectionsObj).filter(k => k !== '_meta')
  const stepEntries = meta?.steps ? Object.entries(meta.steps) : []
  const sectionStatusEntries = meta?.section_status ? Object.entries(meta.section_status) : []

  // Workstream D3 trace link — resolve the evergreen entry this report was
  // served (if any) so the admin can jump straight from "compliance looks
  // wrong" to the cache entry that produced it. The entry may since have
  // been evicted (or the table itself dropped) — either way this is
  // supplementary trace info, so any failure just means "entry no longer
  // exists", never a crash on this page.
  let evergreenEntryLabel: string | null = null
  if (meta?.evergreen) {
    const { data: evergreenRow } = await service
      .from('evergreen_baselines')
      .select('country_code, archetype')
      .eq('id', meta.evergreen.id)
      .maybeSingle()
    if (evergreenRow) {
      evergreenEntryLabel = `${evergreenRow.country_code} · ${ARCHETYPE_LABELS[evergreenRow.archetype] ?? evergreenRow.archetype}`
    }
  }

  return (
    <div>
      <Link
        href="/app/admin/bugs"
        className="text-sm text-slate-400 hover:text-white light:text-gray-500 light:hover:text-gray-900 mb-4 inline-block"
      >
        &larr; Bugs
      </Link>

      {/* 1. Header */}
      <div className={`${cardCls} mb-6`}>
        <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-white light:text-gray-900 mb-1 break-words">
              {idea?.restatement || idea?.raw_text || 'Untitled idea'}
            </h1>
            <p className="text-sm text-slate-400 light:text-gray-500">
              {idea ? (ARCHETYPE_LABELS[idea.archetype] ?? idea.archetype) : '—'} ·{' '}
              {[idea?.location_region, idea?.location_country].filter(Boolean).join(', ') || '—'}
            </p>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full flex-shrink-0 capitalize ${statusColor[report.status]}`}>
            {report.status}
          </span>
        </div>

        <dl className="text-sm space-y-1.5">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400 light:text-gray-500">Owner</dt>
            <dd className="text-slate-200 light:text-gray-800">
              <Link
                href={`/app/admin/users/${report.owner_id}`}
                className="text-indigo-300 light:text-indigo-600 underline underline-offset-2"
              >
                {ownerLabel}
              </Link>
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400 light:text-gray-500">Model version</dt>
            <dd className="text-slate-200 light:text-gray-800">{report.model_version ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400 light:text-gray-500">Cost</dt>
            <dd className="text-slate-200 light:text-gray-800">
              {report.cost_usd != null ? `$${report.cost_usd.toFixed(4)}` : '—'}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400 light:text-gray-500">Generation started</dt>
            <dd className="text-slate-200 light:text-gray-800">
              {report.generation_started_at ? new Date(report.generation_started_at).toLocaleString() : '—'}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400 light:text-gray-500">Generation completed</dt>
            <dd className="text-slate-200 light:text-gray-800">
              {report.generation_completed_at ? new Date(report.generation_completed_at).toLocaleString() : '—'}
            </dd>
          </div>
          {report.error && (
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400 light:text-gray-500">Error</dt>
              <dd className="text-red-300 light:text-red-600 text-right break-words max-w-[70%]">{report.error}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* 2. Bug context — above report content, this is why the admin is here */}
      {bugs.length > 0 && (
        <div className={`${cardCls} mb-6`}>
          <h2 className="text-sm font-semibold text-white light:text-gray-900 mb-3">
            Bug reports on this report ({bugs.length})
          </h2>
          <div className="divide-y divide-white/10 light:divide-gray-100">
            {bugs.map(bug => (
              <div key={bug.id} className="py-3">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${bugStatusTone[bug.status]}`}>
                    {bug.status}
                  </span>
                  <span className="text-xs text-slate-500 light:text-gray-400 tabular-nums">
                    {new Date(bug.created_at).toLocaleString()}
                  </span>
                  {bug.report_tab && (
                    <span className="text-xs text-slate-500 light:text-gray-400">tab: {bug.report_tab}</span>
                  )}
                </div>
                <p className="text-sm text-slate-200 light:text-gray-800 break-words whitespace-pre-wrap mb-1">
                  {bug.description}
                </p>
                <div className="text-xs text-slate-500 light:text-gray-400 space-y-0.5">
                  {bug.page_url && <p className="break-all">url: {bug.page_url}</p>}
                  {bug.browser_info && <p className="break-all">browser: {bug.browser_info}</p>}
                </div>
                {bug.screenshot_url && (
                  <a href={bug.screenshot_url} target="_blank" rel="noopener noreferrer" className="inline-block mt-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={bug.screenshot_url}
                      alt="Attached screenshot"
                      className="max-h-64 rounded-lg border border-white/10 light:border-gray-200"
                    />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Generation diagnostics */}
      {meta && (
        <div className={`${cardCls} mb-6`}>
          <h2 className="text-sm font-semibold text-white light:text-gray-900 mb-3">Generation diagnostics</h2>
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <span
              className={`text-xs px-2.5 py-1 rounded-full ${
                meta.partial
                  ? 'bg-amber-500/15 text-amber-300 light:bg-amber-100 light:text-amber-700'
                  : 'bg-emerald-500/15 text-emerald-300 light:bg-emerald-100 light:text-emerald-700'
              }`}
            >
              {meta.partial ? 'Partial' : 'Complete'}
            </span>
            {meta.model && <span className="text-xs text-slate-500 light:text-gray-400">model: {meta.model}</span>}
            {meta.cost_usd != null && (
              <span className="text-xs text-slate-500 light:text-gray-400">meta cost: ${meta.cost_usd.toFixed(4)}</span>
            )}
          </div>

          {/* Workstream D3 — trace link to the evergreen entry (if any) that
              fed this report's compliance section. */}
          {meta.evergreen && (
            <div className="mb-4">
              <p className="text-xs font-medium text-slate-400 light:text-gray-500 mb-1.5">Evergreen entry</p>
              <p className="text-xs text-slate-300 light:text-gray-700">
                {evergreenEntryLabel ?? 'entry no longer exists'} · revision{' '}
                {new Date(meta.evergreen.updated_at).toLocaleString()} · {meta.evergreen.review_status_at_use} at use ·{' '}
                <Link
                  href={`/app/admin/evergreen?highlight=${meta.evergreen.id}`}
                  className="text-indigo-300 light:text-indigo-600 underline underline-offset-2"
                >
                  view
                </Link>
              </p>
            </div>
          )}

          {sectionStatusEntries.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-slate-400 light:text-gray-500 mb-1.5">Section status</p>
              <div className="flex flex-wrap gap-1.5">
                {sectionStatusEntries.map(([key, value]) => (
                  <span
                    key={key}
                    className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-slate-300 light:bg-gray-50 light:text-gray-600 border border-white/10 light:border-gray-200"
                  >
                    {key}: {value}
                  </span>
                ))}
              </div>
            </div>
          )}

          {stepEntries.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="text-slate-500 light:text-gray-400 border-b border-white/10 light:border-gray-200">
                    <th className="py-1.5 pr-4 font-medium">Step</th>
                    <th className="py-1.5 pr-4 font-medium">Status</th>
                    <th className="py-1.5 pr-4 font-medium">Model</th>
                    <th className="py-1.5 pr-4 font-medium">In tok</th>
                    <th className="py-1.5 pr-4 font-medium">Out tok</th>
                    <th className="py-1.5 pr-4 font-medium">Searches</th>
                    <th className="py-1.5 pr-4 font-medium">Cost</th>
                    <th className="py-1.5 font-medium">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 light:divide-gray-100">
                  {stepEntries.map(([stepId, s]) => (
                    <tr key={stepId} className="text-slate-300 light:text-gray-700">
                      <td className="py-1.5 pr-4 whitespace-nowrap">{stepId}</td>
                      <td className="py-1.5 pr-4 capitalize">{s.status ?? '—'}</td>
                      <td className="py-1.5 pr-4 whitespace-nowrap">{s.model ?? '—'}</td>
                      <td className="py-1.5 pr-4 tabular-nums">{s.input_tokens ?? '—'}</td>
                      <td className="py-1.5 pr-4 tabular-nums">{s.output_tokens ?? '—'}</td>
                      <td className="py-1.5 pr-4 tabular-nums">{s.web_search_requests ?? '—'}</td>
                      <td className="py-1.5 pr-4 tabular-nums">
                        {s.cost_usd != null ? `$${s.cost_usd.toFixed(4)}` : '—'}
                      </td>
                      <td className="py-1.5 text-red-300 light:text-red-600 break-words max-w-xs">{s.error ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 4. Sections — raw JSON, one collapsible block per top-level key.
          Deliberately NOT ReportClient: that component pulls in surveys,
          gating, affiliates, and owner-scoped RLS queries the admin doesn't
          need — this view is about content fidelity, not visual fidelity. */}
      <div className={cardCls}>
        <h2 className="text-sm font-semibold text-white light:text-gray-900 mb-3">
          Sections ({sectionKeys.length})
        </h2>
        {sectionKeys.length === 0 ? (
          <p className="text-sm text-slate-500 light:text-gray-400">No sections generated yet.</p>
        ) : (
          <div className="space-y-2">
            {sectionKeys.map(key => (
              <details key={key} className="rounded-lg border border-white/10 light:border-gray-200">
                <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-slate-200 light:text-gray-800 hover:text-white light:hover:text-gray-900">
                  {key}
                </summary>
                <pre className="overflow-x-auto text-xs text-slate-300 light:text-gray-700 bg-slate-950/60 light:bg-gray-50 px-3 py-3 rounded-b-lg border-t border-white/10 light:border-gray-200">
                  {JSON.stringify(sectionsObj[key], null, 2)}
                </pre>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
