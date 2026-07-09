'use client'

import { useEffect, useState } from 'react'
import type { MessageTemplateKind } from '@/lib/database.types'

export interface TemplateRow {
  id: string
  kind: MessageTemplateKind
  name: string
  body: string
  is_default: boolean
  created_at: string
  updated_at: string
}

const KIND_ORDER: MessageTemplateKind[] = ['invite', 'contact_reply', 'feedback_reply']
const KIND_LABELS: Record<MessageTemplateKind, string> = {
  invite: 'Invite',
  contact_reply: 'Contact reply',
  feedback_reply: 'Feedback reply',
}

const inputCls =
  'w-full rounded-lg border border-white/10 bg-white/5 light:bg-gray-50 light:border-gray-200 px-3 py-2 text-sm text-slate-200 light:text-gray-800 placeholder:text-slate-600 light:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400'
const labelCls = 'block text-xs font-medium text-slate-300 light:text-gray-600 mb-1'

// Create/edit modal — follows the project's standing modal conventions
// (backdrop + Escape close, body scroll lock, discard-confirm on dirty close)
// copied from the contact reply modal in
// src/app/app/admin/contact/contact-queue-list.tsx.
function TemplateModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: TemplateRow | null
  onClose: () => void
  onSaved: (template: TemplateRow) => void
}) {
  const [kind, setKind] = useState<MessageTemplateKind>(editing?.kind ?? 'invite')
  const [name, setName] = useState(editing?.name ?? '')
  const [body, setBody] = useState(editing?.body ?? '')
  const [isDefault, setIsDefault] = useState(editing?.is_default ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)

  const dirty = editing
    ? name !== editing.name || body !== editing.body || isDefault !== editing.is_default
    : name.trim() !== '' || body.trim() !== ''

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, confirmingDiscard])

  function requestClose() {
    if (dirty && !confirmingDiscard) {
      setConfirmingDiscard(true)
      return
    }
    onClose()
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    const trimmedBody = body.trim()
    if (!trimmedName) {
      setError('Name is required.')
      return
    }
    if (!trimmedBody) {
      setError('Body is required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = editing
        ? await fetch(`/api/admin/templates/${editing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: trimmedName, body: trimmedBody, is_default: isDefault }),
          })
        : await fetch('/api/admin/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind, name: trimmedName, body: trimmedBody, is_default: isDefault }),
          })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Failed to save template.')
        setSaving(false)
        return
      }
      onSaved(data.template)
    } catch {
      setError('Failed to save template.')
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm px-4 py-8 sm:py-12"
      onClick={requestClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-slate-950 light:bg-white light:border-gray-200 shadow-2xl px-6 py-6"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={requestClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white light:text-gray-500 light:hover:bg-gray-100 light:hover:text-gray-900"
        >
          ×
        </button>

        <h2 className="text-sm font-semibold text-white light:text-gray-900 mb-1">
          {editing ? 'Edit template' : 'New template'}
        </h2>
        <p className="text-xs text-slate-400 light:text-gray-500 mb-4">
          {editing
            ? 'Changes apply the next time this template is used or set as default.'
            : 'Templates pre-fill their compose modal — the message is still fully editable before send.'}
        </p>

        {confirmingDiscard ? (
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 light:bg-amber-50 light:border-amber-200 px-4 py-3 mb-4">
            <p className="text-sm text-amber-200 light:text-amber-900 mb-2">Discard unsaved changes?</p>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-500/80 hover:bg-amber-500 text-white"
              >
                Discard
              </button>
              <button
                onClick={() => setConfirmingDiscard(false)}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-white/10 text-slate-300 hover:border-white/20 light:border-gray-200 light:text-gray-600"
              >
                Keep editing
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave}>
            <label className={labelCls}>Kind</label>
            <select
              value={kind}
              onChange={e => setKind(e.target.value as MessageTemplateKind)}
              disabled={!!editing}
              className={`${inputCls} mb-3 disabled:opacity-60`}
            >
              {KIND_ORDER.map(k => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </select>

            <label className={labelCls}>Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Standard welcome"
              maxLength={80}
              required
              autoFocus
              className={`${inputCls} mb-3`}
            />

            <label className={labelCls}>Body</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              required
              maxLength={10000}
              rows={7}
              className={`${inputCls} mb-3`}
            />

            <label className="flex items-center gap-2 text-xs text-slate-300 light:text-gray-600 mb-3">
              <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} />
              Set as the default for {KIND_LABELS[kind]} — pre-fills that compose box
            </label>

            {error && <p className="text-xs text-red-300 light:text-red-600 mb-2">{error}</p>}

            <button
              type="submit"
              disabled={saving || !name.trim() || !body.trim()}
              className="w-full rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create template'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

// Hard delete requires a two-step confirmation: first click shows the confirm
// prompt, second click (after clicking Confirm) actually deletes.
function DeleteButton({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function doDelete() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/templates/${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Failed to delete')
        return
      }
      onDeleted()
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-red-300 light:text-red-600">Delete permanently?</span>
        <button
          onClick={doDelete}
          disabled={loading}
          className="text-xs font-medium px-2.5 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-red-300 hover:border-red-500/50 hover:bg-red-500/15 light:border-red-200 light:bg-red-50 light:text-red-700 light:hover:bg-red-100 transition-colors disabled:opacity-50"
        >
          {loading ? 'Deleting…' : 'Confirm'}
        </button>
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
        {error && <p className="text-[11px] text-red-300 light:text-red-600">{error}</p>}
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs font-medium px-2.5 py-1 rounded-full border border-red-500/20 text-red-300 hover:border-red-500/30 light:border-red-200 light:text-red-600 light:hover:border-red-300 transition-colors"
    >
      Delete
    </button>
  )
}

function TemplateItem({
  template,
  onChanged,
  onDeleted,
  onEdit,
}: {
  template: TemplateRow
  onChanged: (updated: TemplateRow) => void
  onDeleted: () => void
  onEdit: () => void
}) {
  const [settingDefault, setSettingDefault] = useState(false)
  const [error, setError] = useState('')

  async function setAsDefault() {
    if (template.is_default || settingDefault) return
    setSettingDefault(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/templates/${template.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_default: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Failed to set default.')
        return
      }
      onChanged(data.template)
    } catch {
      setError('Failed to set default.')
    } finally {
      setSettingDefault(false)
    }
  }

  return (
    <div className="px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-sm font-medium text-white light:text-gray-900">{template.name}</span>
          {template.is_default && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 light:bg-emerald-100 light:text-emerald-700">
              Default
            </span>
          )}
        </div>
        <p className="text-sm text-slate-400 light:text-gray-500 line-clamp-2 whitespace-pre-wrap break-words">
          {template.body}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <label className="flex items-center gap-1.5 text-xs text-slate-400 light:text-gray-500 cursor-pointer">
          <input
            type="radio"
            checked={template.is_default}
            onChange={setAsDefault}
            disabled={settingDefault}
            aria-label={`Set "${template.name}" as the default ${KIND_LABELS[template.kind]} template`}
          />
          Default
        </label>
        <button
          onClick={onEdit}
          className="text-xs font-medium px-2.5 py-1 rounded-full border border-white/10 text-slate-300 hover:border-white/20 light:border-gray-200 light:text-gray-600 light:hover:border-gray-300"
        >
          Edit
        </button>
        <DeleteButton id={template.id} onDeleted={onDeleted} />
      </div>
      {error && <p className="text-[11px] text-red-300 light:text-red-600 w-full">{error}</p>}
    </div>
  )
}

export function TemplatesClient({ initialTemplates }: { initialTemplates: TemplateRow[] }) {
  const [templates, setTemplates] = useState(initialTemplates)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TemplateRow | null>(null)

  function openCreate() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(template: TemplateRow) {
    setEditing(template)
    setModalOpen(true)
  }

  function handleSaved(saved: TemplateRow) {
    setTemplates(prev => {
      // Setting a new default clears is_default on its siblings server-side —
      // mirror that locally so the radio group stays consistent without a refetch.
      const withClearedDefaults = saved.is_default
        ? prev.map(t => (t.kind === saved.kind ? { ...t, is_default: false } : t))
        : prev
      const exists = withClearedDefaults.some(t => t.id === saved.id)
      return exists
        ? withClearedDefaults.map(t => (t.id === saved.id ? saved : t))
        : [...withClearedDefaults, saved]
    })
    setModalOpen(false)
  }

  function handleChanged(updated: TemplateRow) {
    handleSaved(updated)
  }

  function handleDeleted(id: string) {
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  const grouped = KIND_ORDER.map(kind => ({
    kind,
    items: templates.filter(t => t.kind === kind).sort((a, b) => a.name.localeCompare(b.name)),
  }))

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={openCreate}
          className="text-sm font-medium px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white"
        >
          + New template
        </button>
      </div>

      <div className="space-y-8">
        {grouped.map(group => (
          <div key={group.kind}>
            <h2 className="text-sm font-semibold text-white light:text-gray-900 mb-3">{KIND_LABELS[group.kind]}</h2>
            {group.items.length === 0 ? (
              <p className="text-sm text-slate-500 light:text-gray-400 py-4">No templates yet.</p>
            ) : (
              <div className="rounded-lg border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm divide-y divide-white/10 light:divide-gray-100 overflow-hidden">
                {group.items.map(t => (
                  <TemplateItem
                    key={t.id}
                    template={t}
                    onChanged={handleChanged}
                    onDeleted={() => handleDeleted(t.id)}
                    onEdit={() => openEdit(t)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {modalOpen && (
        <TemplateModal editing={editing} onClose={() => setModalOpen(false)} onSaved={handleSaved} />
      )}
    </div>
  )
}
