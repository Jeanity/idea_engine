'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, ChevronDown, Trash2 } from 'lucide-react'
import type { BugReportStatus } from '@/lib/database.types'

export interface BugRow {
  id: string
  created_at: string
  user_id: string | null
  idea_id: string | null
  report_id: string | null
  report_tab: string | null
  description: string
  screenshot_path: string | null
  browser_info: string | null
  page_url: string | null
  status: BugReportStatus
  admin_notes: string | null
  screenshot_url: string | null
}

const STATUS_OPTIONS: BugReportStatus[] = ['open', 'triaged', 'resolved', 'wontfix']

// Hard delete requires a two-step confirmation: first click shows the confirm
// prompt, second click (after clicking Confirm) actually deletes.
function DeleteButton({ bugId, onDeleted }: { bugId: string; onDeleted: () => void }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function doDelete() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/bugs/${bugId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Failed to delete')
        return
      }
      onDeleted()
      router.refresh()
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  if (confirming) {
    return (
      <div className="flex flex-col items-end gap-1">
        <p className="text-xs text-red-300 light:text-red-600 mb-1">
          Delete permanently? The screenshot goes with it.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setConfirming(false)
              setError('')
            }}
            disabled={loading}
            className="text-xs font-medium px-2.5 py-1 rounded-full border border-white/10 text-slate-300 hover:border-white/20 light:border-gray-200 light:text-gray-600 light:hover:border-gray-300 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={doDelete}
            disabled={loading}
            className="text-xs font-medium px-2.5 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-red-300 hover:border-red-500/50 hover:bg-red-500/15 light:border-red-200 light:bg-red-50 light:text-red-700 light:hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            {loading ? 'Deleting…' : 'Confirm'}
          </button>
        </div>
        {error && <p className="text-[11px] text-red-300 light:text-red-600 mt-1">{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => setConfirming(true)}
        disabled={loading}
        className="text-xs font-medium px-2.5 py-1 rounded-full border border-red-500/20 text-red-300 hover:border-red-500/30 light:border-red-200 light:text-red-600 light:hover:border-red-300 transition-colors disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  )
}

function statusTone(status: BugReportStatus): string {
  if (status === 'open') return 'bg-indigo-500/15 text-indigo-300 light:bg-indigo-100 light:text-indigo-700'
  if (status === 'triaged') return 'bg-amber-500/15 text-amber-300 light:bg-amber-100 light:text-amber-700'
  if (status === 'resolved') return 'bg-emerald-500/15 text-emerald-300 light:bg-emerald-100 light:text-emerald-700'
  return 'bg-white/10 text-slate-400 light:bg-gray-100 light:text-gray-500'
}

function BugItem({ row, onDeleted }: { row: BugRow; onDeleted: () => void }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState(row.status)
  const [notes, setNotes] = useState(row.admin_notes ?? '')
  const [savingStatus, setSavingStatus] = useState(false)
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)

  async function updateStatus(next: BugReportStatus) {
    const prev = status
    setStatus(next)
    setSavingStatus(true)
    try {
      const res = await fetch('/api/admin/bugs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, status: next }),
      })
      if (res.ok) {
        router.refresh()
      } else {
        setStatus(prev)
      }
    } catch {
      setStatus(prev)
    } finally {
      setSavingStatus(false)
    }
  }

  async function saveNotes() {
    setSavingNotes(true)
    setNotesSaved(false)
    try {
      const res = await fetch('/api/admin/bugs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, admin_notes: notes }),
      })
      if (res.ok) {
        setNotesSaved(true)
        setTimeout(() => setNotesSaved(false), 1500)
      }
    } finally {
      setSavingNotes(false)
    }
  }

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
              <span className="text-xs text-slate-500 light:text-gray-400 tabular-nums">
                {new Date(row.created_at).toLocaleString()}
              </span>
              {row.report_tab && (
                <span className="text-xs text-slate-500 light:text-gray-400">tab: {row.report_tab}</span>
              )}
            </span>
            <span className="block text-sm text-slate-200 light:text-gray-800 break-words whitespace-pre-wrap">
              {row.description}
            </span>
          </span>
        </button>

        <div className="flex flex-col gap-2 shrink-0">
          <select
            value={status}
            disabled={savingStatus}
            onChange={e => updateStatus(e.target.value as BugReportStatus)}
            className="text-xs rounded-lg border border-white/10 bg-white/5 light:bg-white light:border-gray-200 px-2 py-1 text-slate-200 light:text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <DeleteButton bugId={row.id} onDeleted={onDeleted} />
        </div>
      </div>

      {open && (
        <div className="mt-3 ml-6 space-y-3">
          <div className="space-y-1 text-xs text-slate-500 light:text-gray-400">
            {row.idea_id && (
              <p>
                idea:{' '}
                <Link href={`/app/ideas/${row.idea_id}/report`} className="text-indigo-300 light:text-indigo-600 underline underline-offset-2">
                  {row.idea_id}
                </Link>
              </p>
            )}
            {row.report_id && <p>report: {row.report_id}</p>}
            {row.page_url && <p className="break-all">url: {row.page_url}</p>}
            {row.user_id && <p className="break-all">user: {row.user_id}</p>}
            {row.browser_info && <p className="break-all">browser: {row.browser_info}</p>}
          </div>

          {row.screenshot_url && (
            <div>
              <a href={row.screenshot_url} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={row.screenshot_url}
                  alt="Attached screenshot"
                  className="max-h-64 rounded-lg border border-white/10 light:border-gray-200"
                />
              </a>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 light:text-gray-500 mb-1">Admin notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-white/10 bg-white/5 light:bg-white light:border-gray-200 px-3 py-2 text-xs text-slate-200 light:text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="Internal notes…"
            />
            <div className="mt-1.5 flex items-center gap-2">
              <button
                onClick={saveNotes}
                disabled={savingNotes}
                className="text-xs font-medium px-2.5 py-1 rounded-lg border border-white/10 text-slate-300 hover:border-white/20 hover:text-white light:border-gray-200 light:text-gray-600 light:hover:border-gray-300 light:hover:text-gray-900 disabled:opacity-50 transition-colors"
              >
                {savingNotes ? 'Saving…' : 'Save notes'}
              </button>
              {notesSaved && <span className="text-xs text-emerald-400 light:text-emerald-600">Saved</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function BugQueueList({ rows: initialRows }: { rows: BugRow[] }) {
  const [rows, setRows] = useState(initialRows)

  // Sync local state when server data changes (after router.refresh())
  useEffect(() => {
    setRows(initialRows)
  }, [initialRows])

  function handleBugDeleted(deletedId: string) {
    setRows(prev => prev.filter(r => r.id !== deletedId))
  }

  if (rows.length === 0) {
    return <p className="text-sm text-slate-500 light:text-gray-400 py-10 text-center">No bug reports yet.</p>
  }

  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm divide-y divide-white/10 light:divide-gray-100 overflow-hidden">
      {rows.map(row => (
        <BugItem key={row.id} row={row} onDeleted={() => handleBugDeleted(row.id)} />
      ))}
    </div>
  )
}
