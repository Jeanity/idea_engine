'use client'

import { useEffect, useState } from 'react'
import type { MessageTemplateKind } from '@/lib/database.types'

export interface MessageTemplate {
  id: string
  kind: MessageTemplateKind
  name: string
  body: string
  is_default: boolean
  created_at: string
  updated_at: string
}

interface TemplatePickerProps {
  kind: MessageTemplateKind
  /** The compose textarea's current value — used to decide whether applying
   *  a template needs an overwrite confirm. */
  value: string
  /** Replaces the compose textarea's value with the chosen template's body. */
  onApply: (body: string) => void
  /** Fired once, after the lazy fetch settles, so the owning modal can
   *  pre-fill its textarea from the kind's default template (each modal has
   *  slightly different pre-fill rules — e.g. invite falls back to a
   *  hardcoded default when there's no template default — so that decision
   *  stays with the caller rather than being baked in here). */
  onLoaded?: (info: { templates: MessageTemplate[]; defaultTemplate: MessageTemplate | null }) => void
}

// Shared picker for the three compose surfaces (invite, contact reply,
// feedback reply — see src/app/app/admin/templates for the management page
// where these rows are created/edited). Fetches GET /api/admin/templates
// lazily on mount, i.e. whenever the owning modal opens — no global preload,
// per the design doc. Renders NOTHING when the fetch errors, the migration
// hasn't been run (migrationMissing), or there are simply no templates yet
// for this kind — composing must never depend on templates existing.
export function TemplatePicker({ kind, value, onApply, onLoaded }: TemplatePickerProps) {
  const [templates, setTemplates] = useState<MessageTemplate[] | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null) // awaiting overwrite confirm
  const [savingOpen, setSavingOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch(`/api/admin/templates?kind=${encodeURIComponent(kind)}`)
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok || data.migrationMissing) {
          setTemplates([])
          onLoaded?.({ templates: [], defaultTemplate: null })
          return
        }
        const list: MessageTemplate[] = Array.isArray(data.templates) ? data.templates : []
        setTemplates(list)
        onLoaded?.({ templates: list, defaultTemplate: list.find(t => t.is_default) ?? null })
      } catch {
        if (!cancelled) {
          setTemplates([])
          onLoaded?.({ templates: [], defaultTemplate: null })
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
    // Fetches once per mount (per modal-open) — onLoaded/onApply intentionally
    // excluded so a parent re-render never re-triggers the fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind])

  // Nothing to show yet, or nothing to ever show — stay silent so the
  // compose modal looks exactly as it did before templates existed.
  if (!templates || templates.length === 0) return null

  function applyTemplate(id: string) {
    const tpl = templates!.find(t => t.id === id)
    if (!tpl) return
    const trimmedValue = value.trim()
    if (trimmedValue && trimmedValue !== tpl.body.trim()) {
      setPendingId(id)
      return
    }
    setSelectedId(id)
    onApply(tpl.body)
  }

  function confirmApply() {
    if (!pendingId) return
    const tpl = templates!.find(t => t.id === pendingId)
    setPendingId(null)
    if (!tpl) return
    setSelectedId(tpl.id)
    onApply(tpl.body)
  }

  async function saveAsTemplate() {
    const name = newName.trim()
    const trimmedBody = value.trim()
    if (!name) {
      setSaveError('Name is required.')
      return
    }
    if (!trimmedBody) {
      setSaveError('Nothing to save — the message is empty.')
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      const res = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, name, body: trimmedBody }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSaveError(data.error ?? 'Failed to save template.')
        return
      }
      setTemplates(prev => [...(prev ?? []), data.template])
      setSavingOpen(false)
      setNewName('')
    } catch {
      setSaveError('Failed to save template.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-3 flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={selectedId}
          onChange={e => applyTemplate(e.target.value)}
          className="text-xs rounded-lg border border-white/10 bg-white/5 light:bg-white light:border-gray-200 px-2 py-1.5 text-slate-200 light:text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">Use a template…</option>
          {templates.map(t => (
            <option key={t.id} value={t.id}>
              {t.name}
              {t.is_default ? ' (default)' : ''}
            </option>
          ))}
        </select>

        {!savingOpen && (
          <button
            type="button"
            onClick={() => setSavingOpen(true)}
            className="text-xs font-medium text-indigo-300 hover:text-indigo-200 light:text-indigo-600 light:hover:text-indigo-700"
          >
            + Save as template
          </button>
        )}
      </div>

      {pendingId && (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 light:bg-amber-50 light:border-amber-200 px-3 py-2">
          <p className="text-xs text-amber-200 light:text-amber-900 mb-1.5">
            Replace your current text with this template?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={confirmApply}
              className="text-xs font-medium px-2.5 py-1 rounded-lg bg-amber-500/80 hover:bg-amber-500 text-white"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => setPendingId(null)}
              className="text-xs font-medium px-2.5 py-1 rounded-lg border border-white/10 text-slate-300 hover:border-white/20 light:border-gray-200 light:text-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {savingOpen && (
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Template name"
            maxLength={80}
            autoFocus
            className="text-xs rounded-lg border border-white/10 bg-white/5 light:bg-white light:border-gray-200 px-2 py-1.5 text-slate-200 light:text-gray-800 placeholder:text-slate-500 light:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            type="button"
            onClick={saveAsTemplate}
            disabled={saving}
            className="text-xs font-medium px-2.5 py-1 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => {
              setSavingOpen(false)
              setNewName('')
              setSaveError('')
            }}
            disabled={saving}
            className="text-xs text-slate-400 hover:text-white light:text-gray-500 light:hover:text-gray-900"
          >
            Cancel
          </button>
        </div>
      )}
      {saveError && <p className="text-[11px] text-red-300 light:text-red-600">{saveError}</p>}
    </div>
  )
}
