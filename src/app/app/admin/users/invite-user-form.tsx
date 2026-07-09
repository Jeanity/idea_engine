'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TemplatePicker } from '@/components/admin'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const DEFAULT_MESSAGE =
  "Hi! I'd like to invite you to try Idea Engine — it turns a business idea into a researched, actionable report. Click below to set up your account."

// Add-account action. Opens a modal (Danny's standing modals-over-navigation
// rule) where the invite message can be edited before sending — follows the
// conventions of the contact reply modal (src/app/app/admin/contact/contact-queue-list.tsx):
// backdrop + Escape close, body scroll lock, discard-confirm if either field
// was edited. The server creates the account via generateLink and sends the
// email itself (src/lib/mailer.ts) rather than Supabase's fixed template —
// see the route comment for the created-but-email-failed handling.
function InviteModal({ onClose, onSent }: { onClose: () => void; onSent: (email: string) => void }) {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState(DEFAULT_MESSAGE)
  // Tracks whatever the box was auto-filled with (hardcoded default, or the
  // 'invite' kind's default template once it loads) — comparing against this
  // rather than the hardcoded DEFAULT_MESSAGE means swapping in the template
  // default doesn't itself count as an edit worth discard-confirming.
  const [baselineMessage, setBaselineMessage] = useState(DEFAULT_MESSAGE)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)

  const dirty = email.trim() !== '' || message !== baselineMessage

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

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const trimmedEmail = email.trim().toLowerCase()
    const trimmedMessage = message.trim()
    if (!EMAIL_RE.test(trimmedEmail)) {
      setError('Enter a valid email address.')
      return
    }
    if (!trimmedMessage) {
      setError('Write a message for the invitee.')
      return
    }
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/admin/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, message: trimmedMessage }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Failed to send invite')
        setSending(false)
        return
      }
      onSent(trimmedEmail)
    } catch {
      setError('Failed to send invite')
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

        <h2 className="text-sm font-semibold text-white light:text-gray-900 mb-1">Invite a new user</h2>
        <p className="text-xs text-slate-400 light:text-gray-500 mb-4">
          Creates their account and emails them a link to set it up. You can edit the message below.
        </p>

        {confirmingDiscard ? (
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 light:bg-amber-50 light:border-amber-200 px-4 py-3 mb-4">
            <p className="text-sm text-amber-200 light:text-amber-900 mb-2">Discard this unsent invite?</p>
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
            <label className="block text-xs font-medium text-slate-300 light:text-gray-600 mb-1">Email address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
              autoFocus
              className="w-full rounded-lg border border-white/10 bg-white/5 light:bg-gray-50 light:border-gray-200 px-3 py-2 text-sm text-slate-200 light:text-gray-800 placeholder:text-slate-600 light:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-3"
            />

            <label className="block text-xs font-medium text-slate-300 light:text-gray-600 mb-1">Message</label>
            <TemplatePicker
              kind="invite"
              value={message}
              onApply={setMessage}
              onLoaded={({ defaultTemplate }) => {
                if (!defaultTemplate) return
                setMessage(prev => (prev === DEFAULT_MESSAGE ? defaultTemplate.body : prev))
                setBaselineMessage(defaultTemplate.body)
              }}
            />
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              required
              maxLength={2000}
              rows={6}
              className="w-full rounded-lg border border-white/10 bg-white/5 light:bg-gray-50 light:border-gray-200 px-3 py-2 text-sm text-slate-200 light:text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-3"
            />

            {error && <p className="text-xs text-red-300 light:text-red-600 mb-2">{error}</p>}

            <button
              type="submit"
              disabled={sending || !email.trim() || !message.trim()}
              className="w-full rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? 'Sending…' : 'Send invitation'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export function InviteUserForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [success, setSuccess] = useState('')

  return (
    <div className="mb-6">
      <button
        onClick={() => {
          setSuccess('')
          setOpen(true)
        }}
        className="text-sm font-medium px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white"
      >
        + Invite user
      </button>

      {success && <p className="text-sm text-emerald-300 light:text-emerald-600 mt-3">{success}</p>}

      {open && (
        <InviteModal
          onClose={() => setOpen(false)}
          onSent={email => {
            setOpen(false)
            setSuccess(`Invitation sent to ${email}.`)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
