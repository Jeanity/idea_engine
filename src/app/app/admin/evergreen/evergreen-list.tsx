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
  generated_by_model: string
  generation_cost_usd: number
  source_report_id: string | null
  expires_at: string
}

function statusTone(status: EvergreenReviewStatus): string {
  if (status === 'approved') return 'bg-emerald-500/15 text-emerald-300 light:bg-emerald-100 light:text-emerald-700'
  return 'bg-amber-500/15 text-amber-300 light:bg-amber-100 light:text-amber-700'
}

function EvergreenItem({
  row,
  archetypeLabels,
  onDeleted,
}: {
  row: EvergreenRow
  archetypeLabels: Record<string, string>
  onDeleted: () => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState(row.review_status)
  const [approving, setApproving] = useState(false)
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
      // The Evergreen nav badge counts unreviewed rows — poke admin-shell to
      // refetch nav-status now so the count drops immediately, not on the
      // next 60s poll (same event MarkSeen uses, admin-nav-events.ts).
      window.dispatchEvent(new Event(ADMIN_NAV_SEEN_EVENT))
      router.refresh()
    } catch {
      setError('Network error — please try again')
    } finally {
      setApproving(false)
    }
  }

  async function doDelete() {
    if (!window.confirm('Evict this baseline? The next report from this country x archetype will regenerate it.')) {
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
      // Evicting an unreviewed row also lowers the nav badge count.
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
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${statusTone(status)}`}>
                {status}
              </span>
              <span className="text-sm font-medium text-slate-200 light:text-gray-800">
                {row.country_code}
                {row.region ? ` / ${row.region}` : ''} · {label} · {row.section}
              </span>
              <span className="text-xs text-slate-500 light:text-gray-400">{row.items.length} items</span>
            </span>
            <span className="block text-xs text-slate-500 light:text-gray-400">
              updated {new Date(row.updated_at).toLocaleString()} · expires {new Date(row.expires_at).toLocaleDateString()} ·{' '}
              {row.generated_by_model} · ${row.generation_cost_usd.toFixed(4)}
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
}: {
  rows: EvergreenRow[]
  archetypeLabels: Record<string, string>
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
          onDeleted={() => handleDeleted(row.id)}
        />
      ))}
    </div>
  )
}
