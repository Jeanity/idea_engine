'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, ChevronDown } from 'lucide-react'
import type { ComplianceItem } from '@/lib/compliance-baseline'
import type { EvergreenReviewStatus } from '@/lib/database.types'
import { ADMIN_NAV_SEEN_EVENT } from '@/lib/admin-nav-events'
import { shouldOfferRemediation } from '@/lib/evergreen-remediation'

export interface EvergreenRow {
  id: string
  created_at: string
  updated_at: string
  country_code: string
  region: string
  archetype: string
  section: string
  items: ComplianceItem[]
  review_status: EvergreenReviewStatus
  reviewed_at: string | null
  disapproved_at: string | null
  disapprove_note: string | null
  generated_by_model: string
  generation_cost_usd: number
  source_report_id: string | null
  expires_at: string
}

// How many reports were served THIS row's current revision, and how many of
// those were served before Danny approved it — computed server-side in
// page.tsx from evergreen_report_usage (migration 031) and passed down per
// row. Both read as zero when the usage table doesn't exist yet.
export interface EvergreenUsage {
  total: number
  beforeApproval: number
}

// Workstream D3 — one row per usage of this entry (any revision), for the
// "Affected reports" block in row expansion. `current` distinguishes a
// report served the row's live revision from one served a superseded
// revision (mirrors the `evergreen_updated_at === row.updated_at` check
// page.tsx already does for the cohort/usage counts above).
export interface EvergreenAffectedReport {
  report_id: string
  created_at: string
  current: boolean
}

const MAX_AFFECTED_REPORTS_SHOWN = 20

function statusLabel(status: EvergreenReviewStatus): string {
  if (status === 'approved') return 'Approved'
  if (status === 'disapproved') return 'Disapproved'
  return 'New'
}

function statusTone(status: EvergreenReviewStatus): string {
  if (status === 'approved') return 'bg-emerald-500/15 text-emerald-300 light:bg-emerald-100 light:text-emerald-700'
  if (status === 'disapproved') return 'bg-red-500/15 text-red-300 light:bg-red-100 light:text-red-700'
  return 'bg-amber-500/15 text-amber-300 light:bg-amber-100 light:text-amber-700'
}

// Country code -> "NZ (New Zealand)" using the built-in Intl API, no
// dependency (locked design decision, Workstream C). Falls back to the bare
// code for anything Intl.DisplayNames doesn't recognise (or if the runtime
// lacks the region display-names data entirely).
let regionDisplayNames: Intl.DisplayNames | null | undefined
function countryDisplayName(code: string): string {
  const upper = (code ?? '').toUpperCase()
  if (!upper) return code
  if (regionDisplayNames === undefined) {
    try {
      regionDisplayNames = new Intl.DisplayNames(['en'], { type: 'region' })
    } catch {
      regionDisplayNames = null
    }
  }
  try {
    const name = regionDisplayNames?.of(upper)
    return name && name !== upper ? `${upper} (${name})` : upper
  } catch {
    return upper
  }
}

// Summary returned by POST /api/admin/evergreen/[id]/remediate — rendered
// inline after a Patch/Notify run so Danny sees exactly what happened
// without leaving the page.
interface RemediateSummary {
  patched: number
  notified: number
  orphaned: number
  emailsSent: number
  emailsFailed: number
  skipped: number
  remaining: number
}

function EvergreenItem({
  row,
  archetypeLabels,
  usage,
  cohort,
  cohortUsers,
  lastDisapprovedAt,
  affected,
  highlighted,
  onDeleted,
}: {
  row: EvergreenRow
  archetypeLabels: Record<string, string>
  usage: EvergreenUsage
  cohort: number
  cohortUsers: number
  lastDisapprovedAt: string | null
  affected: EvergreenAffectedReport[]
  highlighted: boolean
  onDeleted: () => void
}) {
  const router = useRouter()
  // Workstream D3: a row reached via /app/admin/evergreen?highlight=<id>
  // (linked from the report inspector) renders pre-expanded, per the spec.
  const [open, setOpen] = useState(highlighted)
  const [status, setStatus] = useState(row.review_status)
  const [disapproveNoteState, setDisapproveNoteState] = useState<{ note: string; disapprovedAt: string } | null>(
    row.review_status === 'disapproved' && row.disapprove_note
      ? { note: row.disapprove_note, disapprovedAt: row.disapproved_at ?? '' }
      : null
  )
  const [showDisapproveForm, setShowDisapproveForm] = useState(false)
  const [disapproveNoteInput, setDisapproveNoteInput] = useState('')
  const [approving, setApproving] = useState(false)
  const [disapproving, setDisapproving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [error, setError] = useState('')

  // Workstream C2 remediation form state.
  const [showRemediateForm, setShowRemediateForm] = useState(false)
  const [remediateMode, setRemediateMode] = useState<'patch' | 'notify'>(status === 'approved' ? 'patch' : 'notify')
  const [remediateNoteInput, setRemediateNoteInput] = useState('')
  const [remediating, setRemediating] = useState(false)
  const [remediateSummary, setRemediateSummary] = useState<RemediateSummary | null>(null)
  const [remediateError, setRemediateError] = useState('')

  async function approve() {
    setApproving(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/evergreen/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Failed to approve')
        return
      }
      setStatus('approved')
      // The Evergreen nav badge is seen-based, but approving/disapproving/
      // evicting still poke admin-shell to refetch nav-status immediately
      // rather than waiting for the next 60s poll (same event MarkSeen uses,
      // admin-nav-events.ts).
      window.dispatchEvent(new Event(ADMIN_NAV_SEEN_EVENT))
      router.refresh()
    } catch {
      setError('Network error — please try again')
    } finally {
      setApproving(false)
    }
  }

  async function disapprove() {
    const note = disapproveNoteInput.trim()
    if (!note) {
      setError('A note explaining the disapproval is required.')
      return
    }
    setDisapproving(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/evergreen/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disapprove', note }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Failed to disapprove')
        return
      }
      setStatus('disapproved')
      setDisapproveNoteState({ note, disapprovedAt: new Date().toISOString() })
      setShowDisapproveForm(false)
      setDisapproveNoteInput('')
      window.dispatchEvent(new Event(ADMIN_NAV_SEEN_EVENT))
      router.refresh()
    } catch {
      setError('Network error — please try again')
    } finally {
      setDisapproving(false)
    }
  }

  async function doDelete() {
    if (!window.confirm('Evict this baseline? Usage history for this entry is deleted with it. The next report from this country x archetype will regenerate it.')) {
      return
    }
    setDeleting(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/evergreen/${row.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Failed to delete')
        return
      }
      onDeleted()
      window.dispatchEvent(new Event(ADMIN_NAV_SEEN_EVENT))
      router.refresh()
    } catch {
      setError('Network error — please try again')
    } finally {
      setDeleting(false)
    }
  }

  async function regenerate() {
    if (!window.confirm('Regenerate this entry? This runs a fresh AI research call (~$0.18) and immediately replaces the current content — status resets to New.')) {
      return
    }
    setRegenerating(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/evergreen/${row.id}/regenerate`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Failed to regenerate')
        return
      }
      setStatus('unreviewed')
      setDisapproveNoteState(null)
      window.dispatchEvent(new Event(ADMIN_NAV_SEEN_EVENT))
      router.refresh()
    } catch {
      setError('Network error — please try again')
    } finally {
      setRegenerating(false)
    }
  }

  async function submitRemediate() {
    const note = remediateNoteInput.trim()
    if (!note) {
      setRemediateError('A note is required.')
      return
    }
    const confirmMsg = remediateMode === 'patch'
      ? `Patch reports & notify: up to ${cohort} affected report(s) will be updated, and ${cohortUsers} user(s) will be emailed. Continue?`
      : `Notify only: no reports are changed, but ${cohortUsers} user(s) will be emailed. Continue?`
    if (!window.confirm(confirmMsg)) return

    setRemediating(true)
    setRemediateError('')
    setRemediateSummary(null)
    try {
      const res = await fetch(`/api/admin/evergreen/${row.id}/remediate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: remediateMode, note }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setRemediateError(data.error ?? 'Failed to remediate')
        return
      }
      setRemediateSummary(data)
      router.refresh()
    } catch {
      setRemediateError('Network error — please try again')
    } finally {
      setRemediating(false)
    }
  }

  const label = archetypeLabels[row.archetype] ?? row.archetype

  return (
    <div
      id={`evergreen-${row.id}`}
      className={`px-5 py-4 ${highlighted ? 'bg-indigo-500/5 ring-1 ring-inset ring-indigo-400/40 light:bg-indigo-50/60' : ''}`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <button
          onClick={() => setOpen(o => !o)}
          className="min-w-0 flex-1 flex items-start gap-2 text-left"
          aria-expanded={open}
        >
          <span className="mt-0.5 flex-shrink-0 text-slate-500 light:text-gray-400">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusTone(status)}`}>
                {statusLabel(status)}
              </span>
              <span className="text-sm font-medium text-slate-200 light:text-gray-800">
                {countryDisplayName(row.country_code)}
                {row.region ? ` / ${row.region}` : ''} · {label} · {row.section}
              </span>
              <span className="text-xs text-slate-500 light:text-gray-400">{row.items.length} items</span>
            </span>
            <span className="block text-xs text-slate-500 light:text-gray-400">
              updated {new Date(row.updated_at).toLocaleString()} · expires {new Date(row.expires_at).toLocaleDateString()} ·{' '}
              {row.generated_by_model} · ${row.generation_cost_usd.toFixed(4)}
            </span>
            <span className="block text-xs text-slate-500 light:text-gray-400">
              {usage.total} report{usage.total === 1 ? '' : 's'} on this version ({usage.beforeApproval} before approval)
              {cohort > 0 && (
                <>
                  {' · '}
                  <span className="text-amber-300 light:text-amber-700">
                    {cohort} report{cohort === 1 ? '' : 's'} on superseded version{cohort === 1 ? '' : 's'}
                  </span>
                </>
              )}
            </span>
          </span>
        </button>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex gap-2">
            {status !== 'approved' && (
              <button
                onClick={approve}
                disabled={approving}
                className="text-xs font-medium px-2.5 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:border-emerald-500/50 hover:bg-emerald-500/15 light:border-emerald-200 light:bg-emerald-50 light:text-emerald-700 light:hover:bg-emerald-100 transition-colors disabled:opacity-50"
              >
                {approving ? 'Approving…' : 'Approve'}
              </button>
            )}
            {status !== 'disapproved' && (
              <button
                onClick={() => setShowDisapproveForm(s => !s)}
                className="text-xs font-medium px-2.5 py-1 rounded-full border border-red-500/20 text-red-300 hover:border-red-500/30 light:border-red-200 light:text-red-600 light:hover:border-red-300 transition-colors"
              >
                Disapprove
              </button>
            )}
            {row.source_report_id && (
              <Link
                href={`/app/admin/reports/${row.source_report_id}`}
                className="text-xs font-medium px-2.5 py-1 rounded-full border border-white/10 text-slate-300 hover:border-white/20 hover:text-white light:border-gray-200 light:text-gray-600 light:hover:border-gray-300 light:hover:text-gray-900 text-center transition-colors"
              >
                Source report
              </Link>
            )}
            <button
              onClick={regenerate}
              disabled={regenerating}
              className={
                status === 'disapproved'
                  ? 'text-xs font-medium px-2.5 py-1 rounded-full border border-indigo-500/40 bg-indigo-500/20 text-indigo-200 hover:bg-indigo-500/30 light:border-indigo-300 light:bg-indigo-100 light:text-indigo-800 light:hover:bg-indigo-200 transition-colors disabled:opacity-50'
                  : 'text-xs font-medium px-2.5 py-1 rounded-full border border-white/10 text-slate-300 hover:border-white/20 hover:text-white light:border-gray-200 light:text-gray-600 light:hover:border-gray-300 light:hover:text-gray-900 transition-colors disabled:opacity-50'
              }
            >
              {regenerating ? 'Regenerating…' : 'Regenerate'}
            </button>
            <button
              onClick={doDelete}
              disabled={deleting}
              className="text-xs font-medium px-2.5 py-1 rounded-full border border-red-500/20 text-red-300 hover:border-red-500/30 light:border-red-200 light:text-red-600 light:hover:border-red-300 transition-colors disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
          {error && <p className="text-[11px] text-red-300 light:text-red-600">{error}</p>}
        </div>
      </div>

      {showDisapproveForm && (
        <div className="mt-3 ml-6 flex flex-col gap-2 max-w-lg">
          <textarea
            value={disapproveNoteInput}
            onChange={e => setDisapproveNoteInput(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Explain what's wrong with this entry (required) — shown on the row, and used to plan remediation later."
            className="w-full rounded-lg border border-white/10 bg-slate-950/60 light:bg-white light:border-gray-200 px-3 py-2 text-xs text-slate-200 light:text-gray-800 focus:outline-none focus:ring-1 focus:ring-red-400/50"
          />
          <div className="flex gap-2">
            <button
              onClick={disapprove}
              disabled={disapproving || !disapproveNoteInput.trim()}
              className="text-xs font-medium px-2.5 py-1 rounded-full border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/15 light:border-red-300 light:bg-red-50 light:text-red-700 transition-colors disabled:opacity-50"
            >
              {disapproving ? 'Disapproving…' : 'Confirm disapprove'}
            </button>
            <button
              onClick={() => { setShowDisapproveForm(false); setDisapproveNoteInput('') }}
              className="text-xs font-medium px-2.5 py-1 rounded-full border border-white/10 text-slate-300 hover:border-white/20 light:border-gray-200 light:text-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {status === 'disapproved' && disapproveNoteState && (
        <div className="mt-3 ml-6 max-w-lg rounded-lg border border-red-500/20 bg-red-500/5 light:bg-red-50 light:border-red-200 px-3 py-2">
          <p className="text-xs text-red-200 light:text-red-700 mb-1">
            {disapproveNoteState.disapprovedAt ? `Disapproved ${new Date(disapproveNoteState.disapprovedAt).toLocaleString()}: ` : ''}
            {disapproveNoteState.note}
          </p>
          <p className="text-[11px] text-red-300/80 light:text-red-600">
            Not being served — Regenerate restores it (status resets to New).
          </p>
        </div>
      )}

      {/* Workstream D1: cohorts accrue on ANY revision bump (a routine expiry
          refresh or warm-script re-run supersedes perfectly good content,
          not just a disapprove-driven fix), so "cohort > 0" alone is not a
          call to action — the Remediate control only makes sense when this
          key has a disapproval somewhere in its history
          (last_disapproved_at, migration 032). Otherwise: a muted,
          informational line, no button. */}
      {cohort > 0 && !shouldOfferRemediation(cohort, lastDisapprovedAt) && (
        <p className="mt-3 ml-6 max-w-lg text-xs text-slate-500 light:text-gray-400">
          {cohort} report{cohort === 1 ? '' : 's'} used older version{cohort === 1 ? '' : 's'} of this entry — no
          action needed unless the old version was wrong.
        </p>
      )}

      {cohort > 0 && shouldOfferRemediation(cohort, lastDisapprovedAt) && (
        <div className="mt-3 ml-6 max-w-lg">
          {!showRemediateForm ? (
            <button
              onClick={() => setShowRemediateForm(true)}
              className="text-xs font-medium px-2.5 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15 light:border-amber-300 light:bg-amber-50 light:text-amber-800 light:hover:bg-amber-100 transition-colors"
            >
              Remediate…
            </button>
          ) : (
            <div className="flex flex-col gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 light:bg-amber-50 light:border-amber-200 px-3 py-3">
              <div className="flex items-center gap-3 text-xs text-slate-300 light:text-gray-700">
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name={`remediate-mode-${row.id}`}
                    checked={remediateMode === 'patch'}
                    disabled={status !== 'approved'}
                    onChange={() => setRemediateMode('patch')}
                  />
                  Patch reports &amp; notify
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name={`remediate-mode-${row.id}`}
                    checked={remediateMode === 'notify'}
                    onChange={() => setRemediateMode('notify')}
                  />
                  Notify only
                </label>
              </div>
              {status !== 'approved' && (
                <p className="text-[11px] text-amber-300/80 light:text-amber-700">
                  Patching is disabled until this entry is Approved — Danny must approve the fixed content before it&apos;s pushed into user reports. Notify only is always available.
                </p>
              )}
              <textarea
                value={remediateNoteInput}
                onChange={e => setRemediateNoteInput(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Note to affected users (required) — shown in the email, e.g. what was wrong and what you're doing about it."
                className="w-full rounded-lg border border-white/10 bg-slate-950/60 light:bg-white light:border-gray-200 px-3 py-2 text-xs text-slate-200 light:text-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
              />
              <div className="flex gap-2">
                <button
                  onClick={submitRemediate}
                  disabled={remediating || !remediateNoteInput.trim()}
                  className="text-xs font-medium px-2.5 py-1 rounded-full border border-amber-500/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25 light:border-amber-300 light:bg-amber-100 light:text-amber-800 transition-colors disabled:opacity-50"
                >
                  {remediating ? 'Sending…' : `Send (${cohort} affected)`}
                </button>
                <button
                  onClick={() => { setShowRemediateForm(false); setRemediateNoteInput(''); setRemediateError('') }}
                  className="text-xs font-medium px-2.5 py-1 rounded-full border border-white/10 text-slate-300 hover:border-white/20 light:border-gray-200 light:text-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
              {remediateError && <p className="text-[11px] text-red-300 light:text-red-600">{remediateError}</p>}
            </div>
          )}
          {remediateSummary && (
            <p className="mt-2 text-[11px] text-slate-400 light:text-gray-500">
              Patched {remediateSummary.patched} · Notified {remediateSummary.notified} · Orphaned {remediateSummary.orphaned} · Emails sent {remediateSummary.emailsSent}
              {remediateSummary.emailsFailed > 0 && ` (${remediateSummary.emailsFailed} failed)`} · Skipped {remediateSummary.skipped}
              {remediateSummary.remaining > 0 && ` · ${remediateSummary.remaining} still remaining — run again to continue`}
            </p>
          )}
        </div>
      )}

      {open && (
        <div className="mt-3 ml-6 space-y-3">
          {/* Workstream D3 — every report this entry (any revision) has been
              served to, newest first, capped at MAX_AFFECTED_REPORTS_SHOWN.
              Reuses the usage rows page.tsx already fetches for
              usageByRow/cohortByRow — no new endpoint. */}
          {affected.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-400 light:text-gray-500 mb-1.5">
                Affected reports ({affected.length})
              </p>
              <div className="space-y-1">
                {affected.slice(0, MAX_AFFECTED_REPORTS_SHOWN).map(a => (
                  <p key={`${a.report_id}-${a.created_at}`} className="text-xs text-slate-400 light:text-gray-500">
                    <Link
                      href={`/app/admin/reports/${a.report_id}`}
                      className="text-indigo-300 light:text-indigo-600 underline underline-offset-2"
                    >
                      Report
                    </Link>{' '}
                    · used {new Date(a.created_at).toLocaleDateString()} ·{' '}
                    <span className={a.current ? 'text-emerald-300 light:text-emerald-700' : 'text-amber-300 light:text-amber-700'}>
                      {a.current ? 'current version' : 'superseded version'}
                    </span>
                  </p>
                ))}
                {affected.length > MAX_AFFECTED_REPORTS_SHOWN && (
                  <p className="text-xs text-slate-500 light:text-gray-500">
                    +{affected.length - MAX_AFFECTED_REPORTS_SHOWN} more
                  </p>
                )}
              </div>
            </div>
          )}
          <pre className="overflow-x-auto text-xs text-slate-300 light:text-gray-700 bg-slate-950/60 light:bg-gray-50 px-3 py-3 rounded-lg border border-white/10 light:border-gray-200">
            {JSON.stringify(row.items, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

export function EvergreenList({
  rows: initialRows,
  archetypeLabels,
  usageByRow,
  cohortByRow,
  cohortUsersByRow,
  lastDisapprovedByRow,
  affectedByRow,
  highlightId,
}: {
  rows: EvergreenRow[]
  archetypeLabels: Record<string, string>
  usageByRow: Record<string, EvergreenUsage>
  cohortByRow: Record<string, number>
  cohortUsersByRow: Record<string, number>
  lastDisapprovedByRow: Record<string, string | null>
  affectedByRow: Record<string, EvergreenAffectedReport[]>
  highlightId: string | null
}) {
  const [rows, setRows] = useState(initialRows)
  // Sync local state when server data changes (after router.refresh() re-runs
  // the server component and passes a new `initialRows` array). Adjusted
  // during render rather than in a useEffect — the react-compiler flags
  // setState-in-effect as a cascading-render risk; comparing against a ref of
  // the last-seen prop and calling setState directly in the render body is
  // the React-documented way to mirror a prop into state without that risk
  // (react.dev "Adjusting state when a prop changes").
  const [prevInitialRows, setPrevInitialRows] = useState(initialRows)
  if (initialRows !== prevInitialRows) {
    setPrevInitialRows(initialRows)
    setRows(initialRows)
  }

  function handleDeleted(deletedId: string) {
    setRows(prev => prev.filter(r => r.id !== deletedId))
  }

  if (rows.length === 0) {
    return <p className="text-sm text-slate-500 light:text-gray-400 py-10 text-center">No evergreen baselines yet.</p>
  }

  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm divide-y divide-white/10 light:divide-gray-100 overflow-hidden">
      {rows.map(row => (
        <EvergreenItem
          key={row.id}
          row={row}
          archetypeLabels={archetypeLabels}
          usage={usageByRow[row.id] ?? { total: 0, beforeApproval: 0 }}
          cohort={cohortByRow[row.id] ?? 0}
          cohortUsers={cohortUsersByRow[row.id] ?? 0}
          lastDisapprovedAt={lastDisapprovedByRow[row.id] ?? null}
          affected={affectedByRow[row.id] ?? []}
          highlighted={highlightId === row.id}
          onDeleted={() => handleDeleted(row.id)}
        />
      ))}
    </div>
  )
}
