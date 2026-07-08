'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Add-account action. Prefers Supabase's inviteUserByEmail (magic link, no
// password handling) over createUser — see server route comment for the
// SMTP caveat. Errors from a not-configured mail provider are surfaced here
// verbatim-ish rather than swallowed, since that's the most likely failure
// mode until Danny sets up Supabase SMTP (see HANDOFF).
export function InviteUserForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function submit() {
    setError('')
    setSuccess('')
    const trimmed = email.trim().toLowerCase()
    if (!EMAIL_RE.test(trimmed)) {
      setError('Enter a valid email address.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/admin/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Failed to send invite')
        return
      }
      setSuccess(`Invite sent to ${trimmed}.`)
      setEmail('')
      router.refresh()
    } catch {
      setError('Failed to send invite')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          setOpen(true)
          setError('')
          setSuccess('')
        }}
        className="text-sm font-medium px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white mb-6"
      >
        + Invite user
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-indigo-500/30 bg-slate-900/80 light:bg-white light:border-indigo-200 light:shadow-sm px-5 py-5 mb-6">
      <h2 className="text-sm font-semibold text-white light:text-gray-900 mb-3">Invite a new user</h2>
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="name@example.com"
          className="w-full sm:w-72 rounded-lg border border-white/10 bg-slate-950/60 light:bg-white light:border-gray-300 px-3 py-2 text-sm text-white light:text-gray-900 placeholder:text-slate-600 light:placeholder:text-gray-400 focus:outline-none focus:border-indigo-500"
        />
        <button
          onClick={submit}
          disabled={busy}
          className="text-sm font-medium px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white disabled:opacity-50"
        >
          {busy ? 'Sending…' : 'Send invite'}
        </button>
        <button
          onClick={() => {
            setOpen(false)
            setError('')
            setSuccess('')
          }}
          disabled={busy}
          className="text-sm text-slate-400 hover:text-white light:text-gray-500 light:hover:text-gray-900"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-sm text-red-300 light:text-red-600 mt-3">{error}</p>}
      {success && <p className="text-sm text-emerald-300 light:text-emerald-600 mt-3">{success}</p>}
    </div>
  )
}
