'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, ChevronDown } from 'lucide-react'
import type { ComplianceItem } from '@/lib/compliance-baseline'
import type { EvergreenReviewStatus } from '@/lib/database.types'
import { ADMIN_NAV_SEEN_EVENT } from '@/lib/admin-nav-events'

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

function EvergreenItem({
  row,
  archetypeLabels,
  usage,
  onDeleted,
}: {
  row: EvergreenRow
  archetypeLabels: Record<string, string>
  usage: EvergreenUsage
  onDeleted: () => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
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
  const [error, setError] = useState('')

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

  const label = archetypeLabels[row.archetype] ?? row.archetype

  return (
    <div className="px-5 py-4">
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
          <p className="text-[11px] text-red-300/80 light:text-red-600" title="Regenerate ships in a follow-up build (Workstream C2)">
            Not being served — regenerate to restore (coming next)
          </p>
        </div>
      )}

      {open && (
        <div className="mt-3 ml-6">
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
}: {
  rows: EvergreenRow[]
  archetypeLabels: Record<string, string>
  usageByRow: Record<string, EvergreenUsage>
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
          onDeleted={() => handleDeleted(row.id)}
        />
      ))}
    </div>
  )
}
