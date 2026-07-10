'use client'

import { useEffect, useState } from 'react'

// Admin editor for the email header/footer text (src/lib/email-chrome.ts).
// Every outgoing email — template-based or not — is wrapped in this shell at
// send time, which is why template bodies stay pure message text. Only the
// text is editable; the layout, links row and © year are fixed so the HTML
// stays email-client-safe.

interface Chrome {
  header_title: string
  signature: string
  footer_note: string
}

const inputCls =
  'w-full rounded-lg border border-white/10 bg-white/5 light:bg-gray-50 light:border-gray-200 px-3 py-2 text-sm text-slate-200 light:text-gray-800 placeholder:text-slate-600 light:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400'
const labelCls = 'block text-xs font-medium text-slate-300 light:text-gray-600 mb-1'

export function EmailChromeCard() {
  const [chrome, setChrome] = useState<Chrome | null>(null)
  const [loadError, setLoadError] = useState('')
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    fetch('/api/admin/email-chrome')
      .then(res => res.json())
      .then(data => {
        if (data.chrome) setChrome(data.chrome)
        else setLoadError(data.error ?? 'Failed to load the email header/footer.')
      })
      .catch(() => setLoadError('Failed to load the email header/footer.'))
  }, [])

  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm px-5 py-4 mb-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="font-semibold text-white light:text-gray-900 mb-1">Email header &amp; footer</h2>
          <p className="text-xs text-slate-500 light:text-gray-400 max-w-xl leading-relaxed">
            Wraps <span className="font-medium">every</span> outgoing email automatically — don&rsquo;t repeat it in
            template bodies. The site/contact/privacy links and © year are added automatically.
          </p>
        </div>
        <button
          onClick={() => setEditing(true)}
          disabled={!chrome}
          className="text-sm font-medium px-4 py-2 rounded-lg border border-white/10 text-slate-300 hover:border-white/20 hover:text-white disabled:opacity-50 light:border-gray-200 light:text-gray-600 light:hover:border-gray-300 light:hover:text-gray-900"
        >
          Edit
        </button>
      </div>

      {loadError && <p className="text-xs text-red-300 light:text-red-600 mt-3">{loadError}</p>}

      {chrome && (
        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-xs text-slate-500 light:text-gray-400 mb-0.5">Header title</dt>
            <dd className="text-slate-200 light:text-gray-800">{chrome.header_title}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 light:text-gray-400 mb-0.5">Signature</dt>
            <dd className="text-slate-200 light:text-gray-800">{chrome.signature || <span className="text-slate-500 light:text-gray-400 italic">hidden</span>}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 light:text-gray-400 mb-0.5">Footer note</dt>
            <dd className="text-slate-200 light:text-gray-800">{chrome.footer_note || <span className="text-slate-500 light:text-gray-400 italic">hidden</span>}</dd>
          </div>
        </dl>
      )}

      {editing && chrome && (
        <ChromeModal
          current={chrome}
          onClose={() => setEditing(false)}
          onSaved={next => { setChrome(next); setEditing(false) }}
        />
      )}
    </div>
  )
}

function ChromeModal({ current, onClose, onSaved }: { current: Chrome; onClose: () => void; onSaved: (c: Chrome) => void }) {
  const [headerTitle, setHeaderTitle] = useState(current.header_title)
  const [signature, setSignature] = useState(current.signature)
  const [footerNote, setFooterNote] = useState(current.footer_note)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)

  const dirty =
    headerTitle !== current.header_title || signature !== current.signature || footerNote !== current.footer_note

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
    if (!headerTitle.trim()) {
      setError('Header title is required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/email-chrome', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ header_title: headerTitle, signature, footer_note: footerNote }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Failed to save.')
        setSaving(false)
        return
      }
      onSaved(data.chrome)
    } catch {
      setError('Failed to save.')
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

        <h2 className="text-sm font-semibold text-white light:text-gray-900 mb-1">Edit email header &amp; footer</h2>
        <p className="text-xs text-slate-400 light:text-gray-500 mb-4">
          Applies to every email from the next send onward. Plain text only — the layout, links and
          © year stay fixed so emails render reliably everywhere.
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
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className={labelCls}>Header title — the wordmark, also used in the © line</label>
              <input className={inputCls} value={headerTitle} onChange={e => setHeaderTitle(e.target.value)} maxLength={60} autoFocus />
            </div>
            <div>
              <label className={labelCls}>Signature — leave blank to hide the line</label>
              <input className={inputCls} value={signature} onChange={e => setSignature(e.target.value)} maxLength={120} />
            </div>
            <div>
              <label className={labelCls}>Footer note — leave blank to hide the line</label>
              <textarea className={`${inputCls} min-h-[64px]`} value={footerNote} onChange={e => setFooterNote(e.target.value)} maxLength={300} />
            </div>

            {error && <p className="text-sm text-red-300 light:text-red-600">{error}</p>}

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="text-sm font-medium px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={requestClose} disabled={saving} className="text-sm text-slate-400 hover:text-white light:text-gray-500 light:hover:text-gray-900">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
