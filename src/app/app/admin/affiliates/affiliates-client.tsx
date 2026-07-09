'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface AffiliateLinkRow {
  id: string
  slug: string
  name: string
  target_url: string
  match_domains: string[]
  match_terms: string[]
  active: boolean
  notes: string | null
  created_at: string
  updated_at: string
  clicks: { d7: number; d30: number; all: number }
}

interface FormState {
  slug: string
  name: string
  target_url: string
  match_domains: string
  match_terms: string
  notes: string
}

const EMPTY_FORM: FormState = { slug: '', name: '', target_url: '', match_domains: '', match_terms: '', notes: '' }

// Split a comma/newline-separated textarea into a trimmed, lowercased array.
function splitList(v: string): string[] {
  return v
    .split(/[\n,]/)
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
}

const inputCls =
  'w-full rounded-lg border border-white/10 bg-slate-950/60 light:bg-white light:border-gray-300 px-3 py-2 text-sm text-white light:text-gray-900 placeholder:text-slate-600 light:placeholder:text-gray-400 focus:outline-none focus:border-indigo-500'
const labelCls = 'block text-xs font-medium text-slate-400 light:text-gray-500 mb-1'

export function AffiliatesClient({ initialLinks }: { initialLinks: AffiliateLinkRow[] }) {
  const router = useRouter()
  // `editing`: null = closed, 'new' = add form, otherwise the id being edited.
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)

  function openNew() {
    setEditing('new')
    setForm(EMPTY_FORM)
    setError('')
  }

  function openEdit(link: AffiliateLinkRow) {
    setEditing(link.id)
    setForm({
      slug: link.slug,
      name: link.name,
      target_url: link.target_url,
      match_domains: link.match_domains.join('\n'),
      match_terms: link.match_terms.join('\n'),
      notes: link.notes ?? '',
    })
    setError('')
  }

  function closeForm() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setError('')
  }

  async function save() {
    setSaving(true)
    setError('')
    const payload = {
      slug: form.slug.trim().toLowerCase(),
      name: form.name.trim(),
      target_url: form.target_url.trim(),
      match_domains: splitList(form.match_domains),
      match_terms: splitList(form.match_terms),
      notes: form.notes.trim() || null,
    }
    try {
      const isNew = editing === 'new'
      const res = await fetch('/api/admin/affiliates', {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isNew ? payload : { id: editing, ...payload }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Failed to save')
        return
      }
      closeForm()
      router.refresh()
    } catch {
      setError('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(link: AffiliateLinkRow) {
    setBusyId(link.id)
    try {
      const res = await fetch('/api/admin/affiliates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: link.id, active: !link.active }),
      })
      if (res.ok) router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  async function confirmDelete(id: string) {
    setBusyId(id)
    try {
      const res = await fetch('/api/admin/affiliates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, confirm: true }),
      })
      if (res.ok) {
        setConfirmingDelete(null)
        router.refresh()
      }
    } finally {
      setBusyId(null)
    }
  }

  const renderForm = (
    <div className="rounded-lg border border-indigo-500/30 bg-slate-900/80 light:bg-white light:border-indigo-200 light:shadow-sm px-5 py-5 mb-6">
      <h2 className="text-sm font-semibold text-white light:text-gray-900 mb-4">
        {editing === 'new' ? 'Add affiliate link' : 'Edit affiliate link'}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Name</label>
          <input className={inputCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Vistaprint" />
        </div>
        <div>
          <label className={labelCls}>Slug (/go/…)</label>
          <input className={inputCls} value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="vistaprint" />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Target URL (full affiliate URL incl. tracking params)</label>
          <input className={inputCls} value={form.target_url} onChange={e => setForm({ ...form, target_url: e.target.value })} placeholder="https://www.vistaprint.com/?clickid=…" />
        </div>
        <div>
          <label className={labelCls}>Match domains (one per line)</label>
          <textarea className={`${inputCls} h-24 resize-y`} value={form.match_domains} onChange={e => setForm({ ...form, match_domains: e.target.value })} placeholder={'vistaprint.com\nvistaprint.co.uk'} />
        </div>
        <div>
          <label className={labelCls}>Match terms (v2 — unused, one per line)</label>
          <textarea className={`${inputCls} h-24 resize-y`} value={form.match_terms} onChange={e => setForm({ ...form, match_terms: e.target.value })} placeholder="business cards" />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Notes (optional)</label>
          <input className={inputCls} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Awin network — approved 2026" />
        </div>
      </div>
      {error && <p className="text-sm text-red-300 light:text-red-600 mt-3">{error}</p>}
      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={save}
          disabled={saving}
          className="text-sm font-medium px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : editing === 'new' ? 'Create link' : 'Save changes'}
        </button>
        <button onClick={closeForm} disabled={saving} className="text-sm text-slate-400 hover:text-white light:text-gray-500 light:hover:text-gray-900">
          Cancel
        </button>
      </div>
    </div>
  )

  return (
    <div>
      {editing === 'new' ? (
        renderForm
      ) : (
        <button
          onClick={openNew}
          className="text-sm font-medium px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white mb-6"
        >
          + Add affiliate link
        </button>
      )}

      {initialLinks.length === 0 ? (
        <p className="text-sm text-slate-500 light:text-gray-400 py-8 text-center">No affiliate links yet.</p>
      ) : (
        <div className="space-y-4">
          {initialLinks.map(link =>
            editing === link.id ? (
              <div key={link.id}>{renderForm}</div>
            ) : (
              <div
                key={link.id}
                className="rounded-lg border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm px-5 py-4"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-semibold text-white light:text-gray-900">{link.name}</span>
                      <code className="text-xs px-2 py-0.5 rounded bg-white/10 text-slate-300 light:bg-gray-100 light:text-gray-600">/go/{link.slug}</code>
                      {link.active ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 light:bg-emerald-50 light:text-emerald-700">Active</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-400 light:bg-gray-100 light:text-gray-500">Inactive</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 light:text-gray-500 truncate max-w-xl">→ {link.target_url}</p>
                    {link.match_domains.length > 0 && (
                      <p className="text-xs text-slate-500 light:text-gray-400 mt-1">Matches: {link.match_domains.join(', ')}</p>
                    )}
                    {link.notes && <p className="text-xs text-slate-600 light:text-gray-400 mt-1 italic">{link.notes}</p>}
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div className="text-xs text-slate-400 light:text-gray-500">
                      <div><span className="text-white light:text-gray-900 font-semibold">{link.clicks.d7}</span> 7d</div>
                      <div><span className="text-white light:text-gray-900 font-semibold">{link.clicks.d30}</span> 30d</div>
                      <div><span className="text-white light:text-gray-900 font-semibold">{link.clicks.all}</span> all</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <button onClick={() => openEdit(link)} className="text-xs font-medium px-2.5 py-1 rounded-lg border border-white/10 text-slate-300 hover:border-white/20 light:border-gray-200 light:text-gray-600 light:hover:border-gray-300">
                    Edit
                  </button>
                  <button
                    onClick={() => toggleActive(link)}
                    disabled={busyId === link.id}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg border border-white/10 text-slate-300 hover:border-white/20 disabled:opacity-50 light:border-gray-200 light:text-gray-600 light:hover:border-gray-300"
                  >
                    {link.active ? 'Deactivate' : 'Activate'}
                  </button>

                  {confirmingDelete === link.id ? (
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <span className="text-xs text-red-300 light:text-red-600">Delete permanently? Clicks are lost.</span>
                      <button
                        onClick={() => confirmDelete(link.id)}
                        disabled={busyId === link.id}
                        className="text-xs font-medium px-2.5 py-1 rounded-lg bg-red-500/80 hover:bg-red-500 text-white disabled:opacity-50"
                      >
                        {busyId === link.id ? 'Deleting…' : 'Yes, delete'}
                      </button>
                      <button onClick={() => setConfirmingDelete(null)} className="text-xs text-slate-400 hover:text-white light:text-gray-500 light:hover:text-gray-900">
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmingDelete(link.id)}
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
