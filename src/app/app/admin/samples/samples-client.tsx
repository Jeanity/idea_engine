'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ARCHETYPE_LABELS } from '@/lib/archetype-labels'

export interface SampleRow {
  id: string
  title: string
  archetype: string
  restatement: string
  headline_score: number
  source_report_id: string | null
  active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

interface SourceReportCandidate {
  reportId: string
  ideaId: string
  restatement: string
  archetype: string
  completedAt: string
}

interface EditForm {
  title: string
  restatement: string
  archetype: string
}

const inputCls =
  'w-full rounded-lg border border-white/10 bg-slate-950/60 light:bg-white light:border-gray-300 px-3 py-2 text-sm text-white light:text-gray-900 placeholder:text-slate-600 light:placeholder:text-gray-400 focus:outline-none focus:border-indigo-500'
const labelCls = 'block text-xs font-medium text-slate-400 light:text-gray-500 mb-1'

function archetypeLabel(key: string): string {
  return ARCHETYPE_LABELS[key] ?? key
}

// ── Migration-missing notice ────────────────────────────────────────────

function MigrationMissingNotice() {
  return (
    <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 light:bg-amber-50 light:border-amber-200 px-5 py-5">
      <p className="text-sm font-semibold text-amber-200 light:text-amber-900 mb-1">
        Sample reports table not found
      </p>
      <p className="text-sm text-amber-100/90 light:text-amber-800">
        Run <code className="rounded bg-black/20 light:bg-amber-100 px-1.5 py-0.5">supabase/migrations/011_sample_reports.sql</code> in
        the Supabase SQL editor, then reload this page. The public sample page keeps working with
        the built-in fallback sample in the meantime.
      </p>
    </div>
  )
}

// ── Main client component ───────────────────────────────────────────────

export function SamplesClient({ initialSamples, migrationMissing }: { initialSamples: SampleRow[]; migrationMissing: boolean }) {
  const router = useRouter()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({ title: '', restatement: '', archetype: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)

  if (migrationMissing) {
    return <MigrationMissingNotice />
  }

  function openEdit(sample: SampleRow) {
    setEditingId(sample.id)
    setEditForm({ title: sample.title, restatement: sample.restatement, archetype: sample.archetype })
    setError('')
  }

  function closeEdit() {
    setEditingId(null)
    setError('')
  }

  async function saveEdit() {
    if (!editingId) return
    const title = editForm.title.trim()
    const restatement = editForm.restatement.trim()
    const archetype = editForm.archetype.trim()
    if (!title || !restatement || !archetype) {
      setError('All fields are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/samples/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, restatement, archetype }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Failed to save')
        return
      }
      closeEdit()
      router.refresh()
    } catch {
      setError('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(sample: SampleRow) {
    setBusyId(sample.id)
    try {
      const res = await fetch(`/api/admin/samples/${sample.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !sample.active }),
      })
      if (res.ok) router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  async function move(sample: SampleRow, direction: 'up' | 'down') {
    const sorted = [...initialSamples].sort((a, b) => a.sort_order - b.sort_order)
    const index = sorted.findIndex(s => s.id === sample.id)
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (index === -1 || swapIndex < 0 || swapIndex >= sorted.length) return
    const other = sorted[swapIndex]

    setBusyId(sample.id)
    try {
      await Promise.all([
        fetch(`/api/admin/samples/${sample.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort_order: other.sort_order }),
        }),
        fetch(`/api/admin/samples/${other.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort_order: sample.sort_order }),
        }),
      ])
      router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  async function confirmDelete(id: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/admin/samples/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      })
      if (res.ok) {
        setConfirmingDelete(null)
        router.refresh()
      }
    } finally {
      setBusyId(null)
    }
  }

  const sorted = [...initialSamples].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setPickerOpen(true)}
          className="text-sm font-medium px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white"
        >
          + New sample
        </button>
      </div>

      {pickerOpen && (
        <SourceReportPicker
          onClose={() => setPickerOpen(false)}
          onCreated={() => {
            setPickerOpen(false)
            router.refresh()
          }}
        />
      )}

      {sorted.length === 0 ? (
        <p className="text-sm text-slate-500 light:text-gray-400 py-8 text-center">
          No samples yet — create one from a completed report.
        </p>
      ) : (
        <div className="space-y-4">
          {sorted.map((sample, i) =>
            editingId === sample.id ? (
              <div
                key={sample.id}
                className="rounded-lg border border-indigo-500/30 bg-slate-900/80 light:bg-white light:border-indigo-200 light:shadow-sm px-5 py-5"
              >
                <h2 className="text-sm font-semibold text-white light:text-gray-900 mb-4">Edit sample</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Title (card headline)</label>
                    <input className={inputCls} value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Restatement (idea one-liner)</label>
                    <textarea
                      className={`${inputCls} min-h-[70px]`}
                      value={editForm.restatement}
                      onChange={e => setEditForm({ ...editForm, restatement: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Archetype</label>
                    <select
                      className={inputCls}
                      value={editForm.archetype}
                      onChange={e => setEditForm({ ...editForm, archetype: e.target.value })}
                    >
                      {Object.keys(ARCHETYPE_LABELS).map(key => (
                        <option key={key} value={key}>{ARCHETYPE_LABELS[key]}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {error && <p className="text-sm text-red-300 light:text-red-600 mt-3">{error}</p>}
                <div className="flex items-center gap-3 mt-4">
                  <button
                    onClick={saveEdit}
                    disabled={saving}
                    className="text-sm font-medium px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                  <button onClick={closeEdit} disabled={saving} className="text-sm text-slate-400 hover:text-white light:text-gray-500 light:hover:text-gray-900">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={sample.id}
                className="rounded-lg border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm px-5 py-4"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-semibold text-white light:text-gray-900">{sample.title}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 light:bg-indigo-50 light:text-indigo-700">
                        {archetypeLabel(sample.archetype)}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          sample.active
                            ? 'bg-emerald-500/10 text-emerald-300 light:bg-emerald-50 light:text-emerald-700'
                            : 'bg-white/10 text-slate-400 light:bg-gray-100 light:text-gray-500'
                        }`}
                      >
                        {sample.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 light:text-gray-700 line-clamp-2">{sample.restatement}</p>
                    <p className="text-xs text-slate-500 light:text-gray-400 mt-1">
                      Score {sample.headline_score} · Created {new Date(sample.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => move(sample, 'up')}
                      disabled={i === 0 || busyId === sample.id}
                      aria-label="Move up"
                      className="text-xs px-2 py-1 rounded-lg border border-white/10 text-slate-300 hover:border-white/20 disabled:opacity-30 light:border-gray-200 light:text-gray-600 light:hover:border-gray-300"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => move(sample, 'down')}
                      disabled={i === sorted.length - 1 || busyId === sample.id}
                      aria-label="Move down"
                      className="text-xs px-2 py-1 rounded-lg border border-white/10 text-slate-300 hover:border-white/20 disabled:opacity-30 light:border-gray-200 light:text-gray-600 light:hover:border-gray-300"
                    >
                      ↓
                    </button>
                  </div>
                  <button onClick={() => openEdit(sample)} className="text-xs font-medium px-2.5 py-1 rounded-lg border border-white/10 text-slate-300 hover:border-white/20 light:border-gray-200 light:text-gray-600 light:hover:border-gray-300">
                    Edit
                  </button>
                  <button
                    onClick={() => toggleActive(sample)}
                    disabled={busyId === sample.id}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg border border-white/10 text-slate-300 hover:border-white/20 disabled:opacity-50 light:border-gray-200 light:text-gray-600 light:hover:border-gray-300"
                  >
                    {sample.active ? 'Deactivate' : 'Activate'}
                  </button>

                  {confirmingDelete === sample.id ? (
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <span className="text-xs text-red-300 light:text-red-600">
                        This removes the sample from the public gallery permanently.
                      </span>
                      <button
                        onClick={() => confirmDelete(sample.id)}
                        disabled={busyId === sample.id}
                        className="text-xs font-medium px-2.5 py-1 rounded-lg bg-red-500/80 hover:bg-red-500 text-white disabled:opacity-50"
                      >
                        {busyId === sample.id ? 'Deleting…' : 'Yes, delete'}
                      </button>
                      <button onClick={() => setConfirmingDelete(null)} className="text-xs text-slate-400 hover:text-white light:text-gray-500 light:hover:text-gray-900">
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmingDelete(sample.id)}
                      className="text-xs font-medium px-2.5 py-1 rounded-lg border border-red-500/20 text-red-300/80 hover:border-red-500/40 hover:text-red-300 light:border-red-200 light:text-red-500 light:hover:border-red-300"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}

// ── "New sample" picker modal ───────────────────────────────────────────

function SourceReportPicker({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<SourceReportCandidate[]>([])
  const [loadError, setLoadError] = useState('')
  const [selected, setSelected] = useState<SourceReportCandidate | null>(null)
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  useEffect(() => {
    fetch('/api/admin/samples?source=reports')
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setLoadError(data.error)
        } else {
          setReports(data.reports ?? [])
        }
      })
      .catch(() => setLoadError('Failed to load reports.'))
      .finally(() => setLoading(false))
  }, [])

  function selectReport(r: SourceReportCandidate) {
    setSelected(r)
    setTitle(r.restatement)
    setCreateError('')
  }

  async function create() {
    if (!selected) return
    const trimmed = title.trim()
    if (!trimmed) {
      setCreateError('Title is required.')
      return
    }
    setCreating(true)
    setCreateError('')
    try {
      const res = await fetch('/api/admin/samples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: selected.reportId, title: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setCreateError(data.error ?? 'Failed to create sample')
        return
      }
      onCreated()
    } catch {
      setCreateError('Failed to create sample')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-white/10 bg-slate-900 light:bg-white light:border-gray-200 shadow-2xl px-5 py-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white light:text-gray-900">
            {selected ? 'Name the sample' : 'Pick a completed report to clone'}
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-white light:text-gray-400 light:hover:text-gray-900 text-lg leading-none">
            ×
          </button>
        </div>

        {!selected ? (
          <>
            {loading && <p className="text-sm text-slate-400 light:text-gray-500 py-6 text-center">Loading reports…</p>}
            {loadError && <p className="text-sm text-red-300 light:text-red-600 py-6 text-center">{loadError}</p>}
            {!loading && !loadError && reports.length === 0 && (
              <p className="text-sm text-slate-400 light:text-gray-500 py-6 text-center">No completed full reports found yet.</p>
            )}
            {!loading && reports.length > 0 && (
              <div className="space-y-2">
                {reports.map(r => (
                  <button
                    key={r.reportId}
                    onClick={() => selectReport(r)}
                    className="w-full text-left rounded-lg border border-white/10 hover:border-indigo-400/50 light:border-gray-200 light:hover:border-indigo-300 px-3 py-2.5 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 light:bg-indigo-50 light:text-indigo-700">
                        {archetypeLabel(r.archetype)}
                      </span>
                      <span className="text-xs text-slate-500 light:text-gray-400">
                        {new Date(r.completedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-200 light:text-gray-800 line-clamp-2">{r.restatement}</p>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div>
            <p className="text-xs text-slate-500 light:text-gray-400 mb-3">{selected.restatement}</p>
            <label className={labelCls}>Card title</label>
            <input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} autoFocus />
            {createError && <p className="text-sm text-red-300 light:text-red-600 mt-2">{createError}</p>}
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={create}
                disabled={creating}
                className="text-sm font-medium px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create sample (inactive)'}
              </button>
              <button onClick={() => setSelected(null)} disabled={creating} className="text-sm text-slate-400 hover:text-white light:text-gray-500 light:hover:text-gray-900">
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
