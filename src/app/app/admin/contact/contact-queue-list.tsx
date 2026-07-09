'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export interface ContactReplyRow {
  id: string
  submission_id: string
  body: string
  created_by: string
  emailed_at: string | null
  created_at: string
}

export interface ContactRow {
  id: string
  category: 'feedback' | 'complaint' | 'question' | 'partnership'
  name: string
  email: string
  message: string
  user_id: string | null
  status: 'open' | 'replied' | 'closed'
  created_at: string
  replies: ContactReplyRow[]
}

const STATUS_OPTIONS: ContactRow['status'][] = ['open', 'replied', 'closed']

function categoryTone(category: ContactRow['category']): string {
  if (category === 'partnership') return 'bg-amber-500/15 text-amber-300 light:bg-amber-100 light:text-amber-700'
  if (category === 'complaint') return 'bg-red-500/15 text-red-300 light:bg-red-100 light:text-red-700'
  return 'bg-white/10 text-slate-300 light:bg-gray-100 light:text-gray-600'
}

function statusTone(status: ContactRow['status']): string {
  if (status === 'open') return 'bg-indigo-500/15 text-indigo-300 light:bg-indigo-100 light:text-indigo-700'
  if (status === 'replied') return 'bg-emerald-500/15 text-emerald-300 light:bg-emerald-100 light:text-emerald-700'
  return 'bg-white/10 text-slate-400 light:bg-gray-100 light:text-gray-500'
}

// Reply modal — follows the project's standing modal conventions (backdrop +
// Escape close, body scroll lock; see src/components/bug-report-widget.tsx and
// src/app/sample-report/sample-gallery-client.tsx). Page-related actions
// happen in modals here, never a full navigation.
function ReplyModal({ row, onClose, onSent }: { row: ContactRow; onClose: () => void; onSent: (sent: boolean) => void }) {
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)

  // Body scroll lock: applied once for the modal's lifetime.
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  // Escape-to-close: re-bound whenever body/confirmingDiscard change so the
  // handler always sees the latest "unsent text?" state.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, confirmingDiscard])

  function requestClose() {
    if (body.trim() && !confirmingDiscard) {
      setConfirmingDiscard(true)
      return
    }
    onClose()
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = body.trim()
    if (!trimmed || sending) return
    setSending(true)
    setError('')
    setWarning('')
    try {
      const res = await fetch('/api/admin/contact/replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: row.id, body: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong — please try again.')
        setSending(false)
        return
      }
      onSent(data.sent === true)
      if (data.sent) {
        onClose()
      } else {
        setWarning('Reply saved but the email failed to send — check the Errors page.')
        setBody('')
        setSending(false)
      }
    } catch {
      setError('Something went wrong — please try again.')
      setSending(false)
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

        <h2 className="text-sm font-semibold text-white light:text-gray-900 mb-1">Reply to {row.name}</h2>
        <p className="text-xs text-slate-400 light:text-gray-500 mb-4">
          Your reply is emailed directly to {row.email}.
        </p>

        <div className="rounded-lg border border-white/10 bg-white/5 light:bg-gray-50 light:border-gray-200 px-4 py-3 mb-4">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${categoryTone(row.category)}`}>
              {row.category}
            </span>
            <span className="text-xs text-slate-500 light:text-gray-400 tabular-nums">
              {new Date(row.created_at).toLocaleString()}
            </span>
          </div>
          <p className="text-sm text-slate-300 light:text-gray-700 whitespace-pre-wrap break-words">{row.message}</p>
        </div>

        {confirmingDiscard ? (
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 light:bg-amber-50 light:border-amber-200 px-4 py-3 mb-4">
            <p className="text-sm text-amber-200 light:text-amber-900 mb-2">Discard this unsent reply?</p>
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
          <form onSubmit={handleSend}>
            <label className="block text-xs font-medium text-slate-300 light:text-gray-600 mb-1">Your reply</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              required
              maxLength={10000}
              rows={6}
              autoFocus
              className="w-full rounded-lg border border-white/10 bg-white/5 light:bg-gray-50 light:border-gray-200 px-3 py-2 text-sm text-slate-200 light:text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-3"
              placeholder="Write your reply…"
            />

            {error && <p className="text-xs text-red-300 light:text-red-600 mb-2">{error}</p>}
            {warning && (
              <p className="text-xs text-amber-300 light:text-amber-700 mb-2">{warning}</p>
            )}

            <button
              type="submit"
              disabled={sending || !body.trim()}
              className="w-full rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? 'Sending…' : 'Send reply'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function ReplyHistory({ replies }: { replies: ContactReplyRow[] }) {
  if (replies.length === 0) return null
  return (
    <div className="mt-3 space-y-2 border-t border-white/10 light:border-gray-100 pt-3">
      {replies.map(reply => (
        <div key={reply.id} className="rounded-lg bg-white/5 light:bg-gray-50 px-3 py-2">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-medium text-slate-300 light:text-gray-600">Reply from {reply.created_by}</span>
            <span className="text-[11px] text-slate-500 light:text-gray-400 tabular-nums">
              {new Date(reply.created_at).toLocaleString()}
            </span>
            <span
              className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                reply.emailed_at
                  ? 'bg-emerald-500/15 text-emerald-300 light:bg-emerald-100 light:text-emerald-700'
                  : 'bg-red-500/15 text-red-300 light:bg-red-100 light:text-red-700'
              }`}
            >
              {reply.emailed_at ? 'sent' : 'send failed'}
            </span>
          </div>
          <p className="text-sm text-slate-300 light:text-gray-700 whitespace-pre-wrap break-words">{reply.body}</p>
        </div>
      ))}
    </div>
  )
}

function ContactItem({ row }: { row: ContactRow }) {
  const router = useRouter()
  const [status, setStatus] = useState(row.status)
  const [saving, setSaving] = useState(false)
  const [replyOpen, setReplyOpen] = useState(false)

  async function updateStatus(next: ContactRow['status']) {
    setStatus(next)
    setSaving(true)
    try {
      const res = await fetch('/api/admin/contact', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, status: next }),
      })
      if (res.ok) {
        router.refresh()
      } else {
        setStatus(row.status) // revert on failure
      }
    } catch {
      setStatus(row.status)
    } finally {
      setSaving(false)
    }
  }

  const isPartnership = row.category === 'partnership'

  return (
    <div
      className={`px-5 py-4 ${
        isPartnership ? 'bg-amber-500/5 light:bg-amber-50/60' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${categoryTone(row.category)}`}>
              {row.category}
            </span>
            <span className="text-sm font-medium text-white light:text-gray-900">{row.name}</span>
            <span className="text-xs text-slate-500 light:text-gray-400">{row.email}</span>
            <span className="text-xs text-slate-500 light:text-gray-400 tabular-nums">
              {new Date(row.created_at).toLocaleString()}
            </span>
          </div>
          <p className="text-sm text-slate-300 light:text-gray-700 whitespace-pre-wrap break-words">{row.message}</p>
          <ReplyHistory replies={row.replies} />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${statusTone(status)}`}>
            {status}
          </span>
          <button
            onClick={() => setReplyOpen(true)}
            className="text-xs font-medium px-2.5 py-1 rounded-lg border border-white/10 text-slate-300 hover:border-white/20 light:border-gray-200 light:text-gray-600 light:hover:border-gray-300"
          >
            Reply
          </button>
          <select
            value={status}
            disabled={saving}
            onChange={e => updateStatus(e.target.value as ContactRow['status'])}
            className="text-xs rounded-lg border border-white/10 bg-white/5 light:bg-white light:border-gray-200 px-2 py-1 text-slate-200 light:text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {replyOpen && (
        <ReplyModal
          row={row}
          onClose={() => setReplyOpen(false)}
          onSent={sent => {
            if (sent) setStatus('replied')
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

export function ContactQueueList({ rows }: { rows: ContactRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500 light:text-gray-400 py-10 text-center">No messages yet.</p>
  }

  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm divide-y divide-white/10 light:divide-gray-100 overflow-hidden">
      {rows.map(row => (
        <ContactItem key={row.id} row={row} />
      ))}
    </div>
  )
}
