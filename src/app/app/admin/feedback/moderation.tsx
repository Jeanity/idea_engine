'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TemplatePicker } from '@/components/admin'

interface Reply {
  id: string
  body: string
  is_public: boolean
  created_at: string
  created_by: string
}

// Hard delete requires a two-step confirmation: first click shows the confirm
// prompt, second click (after clicking Confirm) actually deletes.
export function DeleteButton({ feedbackId, onDeleted }: { feedbackId: string; onDeleted: () => void }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function doDelete() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/feedback/${feedbackId}`, {
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
          Delete permanently? This also removes its replies.
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

// Reversible admin toggles — hide is a moderation action (spammy/abusive
// feedback) and admin_public is the publish decision independent of the
// user's own allow_public consent. Both are plain toggles (no typed
// confirm) per the deletion ground rule: only hard deletes need that.
export function HideToggle({ feedbackId, initialHidden }: { feedbackId: string; initialHidden: boolean }) {
  const router = useRouter()
  const [hidden, setHidden] = useState(initialHidden)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function toggle() {
    const next = !hidden
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback_id: feedbackId, hidden: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Failed to update')
        return
      }
      setHidden(next)
      router.refresh()
    } catch {
      setError('Failed to update')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={toggle}
        disabled={loading}
        className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors disabled:opacity-50 ${
          hidden
            ? 'bg-red-500/15 text-red-300 border-red-500/30 light:bg-red-100 light:text-red-700 light:border-red-200'
            : 'bg-white/5 text-slate-300 border-white/10 hover:border-white/20 light:bg-gray-50 light:text-gray-600 light:border-gray-200 light:hover:border-gray-300'
        }`}
      >
        {loading ? 'Saving…' : hidden ? 'Hidden — Unhide' : 'Hide'}
      </button>
      {error && <p className="text-[11px] text-red-300 light:text-red-600">{error}</p>}
    </div>
  )
}

export function AdminPublicToggle({ feedbackId, initialAdminPublic }: { feedbackId: string; initialAdminPublic: boolean }) {
  const router = useRouter()
  const [adminPublic, setAdminPublic] = useState(initialAdminPublic)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function toggle() {
    const next = !adminPublic
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback_id: feedbackId, admin_public: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Failed to update')
        return
      }
      setAdminPublic(next)
      router.refresh()
    } catch {
      setError('Failed to update')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={toggle}
        disabled={loading}
        title="Independent of the user's own public-quote consent — both must be on to show publicly"
        className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors disabled:opacity-50 ${
          adminPublic
            ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30 light:bg-emerald-100 light:text-emerald-700 light:border-emerald-200'
            : 'bg-white/5 text-slate-300 border-white/10 hover:border-white/20 light:bg-gray-50 light:text-gray-600 light:border-gray-200 light:hover:border-gray-300'
        }`}
      >
        {loading ? 'Saving…' : adminPublic ? 'Approved for public ✓' : 'Approve for public'}
      </button>
      {error && <p className="text-[11px] text-red-300 light:text-red-600">{error}</p>}
    </div>
  )
}

// Reply modal — the composer used to be an inline textarea directly on the
// card; converted to a modal (Danny's standing modals-over-navigation rule)
// following the contact reply modal's conventions
// (src/app/app/admin/contact/contact-queue-list.tsx): backdrop + Escape
// close, body scroll lock, discard-confirm on unsent text. All prior
// behaviour is preserved — public-reply checkbox, sent reply appended to the
// card's reply list, same POST /api/admin/feedback/replies contract.
function FeedbackReplyModal({
  feedbackId,
  onClose,
  onSent,
}: {
  feedbackId: string
  onClose: () => void
  onSent: (reply: Reply) => void
}) {
  const [body, setBody] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)

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
  }, [body, confirmingDiscard])

  function requestClose() {
    if (body.trim() && !confirmingDiscard) {
      setConfirmingDiscard(true)
      return
    }
    onClose()
  }

  async function send() {
    const trimmed = body.trim()
    if (!trimmed) return
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/admin/feedback/replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback_id: feedbackId, body: trimmed, is_public: isPublic }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Failed to send reply')
        setSending(false)
        return
      }
      onSent(data.reply)
    } catch {
      setError('Failed to send reply')
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

        <h2 className="text-sm font-semibold text-white light:text-gray-900 mb-4">Reply to this feedback</h2>

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
          <>
            <label className="block text-xs font-medium text-slate-300 light:text-gray-600 mb-1">Your reply</label>
            <TemplatePicker
              kind="feedback_reply"
              value={body}
              onApply={setBody}
              onLoaded={({ defaultTemplate }) => {
                if (defaultTemplate) setBody(prev => (prev === '' ? defaultTemplate.body : prev))
              }}
            />
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Write a reply…"
              rows={6}
              autoFocus
              className="w-full rounded-lg border border-white/10 bg-white/5 light:bg-gray-50 light:border-gray-200 px-3 py-2 text-sm text-slate-200 light:text-gray-800 placeholder:text-slate-500 light:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-3"
            />

            <label className="flex items-center gap-2 text-xs text-slate-400 light:text-gray-500 mb-3">
              <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} />
              Public reply — may appear as a homepage testimonial reply
            </label>

            {error && <p className="text-xs text-red-300 light:text-red-600 mb-2">{error}</p>}

            <button
              onClick={send}
              disabled={sending || !body.trim()}
              className="w-full rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? 'Sending…' : 'Send reply'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export function ReplySection({ feedbackId, initialReplies }: { feedbackId: string; initialReplies: Reply[] }) {
  const [replies, setReplies] = useState(initialReplies)
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div className="border-t border-white/10 light:border-gray-200 pt-3 mt-1 flex flex-col gap-2">
      {replies.length > 0 && (
        <div className="flex flex-col gap-2">
          {replies.map(reply => (
            <div key={reply.id} className="rounded-lg bg-white/5 light:bg-gray-50 px-3 py-2">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[11px] font-medium text-slate-300 light:text-gray-600">
                  Reply from {reply.created_by}
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    reply.is_public
                      ? 'bg-emerald-500/10 text-emerald-300 light:bg-emerald-50 light:text-emerald-700'
                      : 'bg-white/10 text-slate-400 light:bg-gray-100 light:text-gray-500'
                  }`}
                >
                  {reply.is_public ? 'Public' : 'Private'}
                </span>
              </div>
              <p className="text-xs text-slate-300 light:text-gray-700 leading-relaxed whitespace-pre-wrap">{reply.body}</p>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => setModalOpen(true)}
        className="self-start text-xs font-medium px-3 py-1 rounded-full border border-white/10 text-slate-300 hover:border-white/20 light:border-gray-200 light:text-gray-600 light:hover:border-gray-300"
      >
        Reply
      </button>

      {modalOpen && (
        <FeedbackReplyModal
          feedbackId={feedbackId}
          onClose={() => setModalOpen(false)}
          onSent={reply => {
            setReplies(prev => [...prev, reply])
            setModalOpen(false)
          }}
        />
      )}
    </div>
  )
}
