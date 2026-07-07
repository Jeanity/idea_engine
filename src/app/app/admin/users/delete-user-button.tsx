'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface DeleteUserButtonProps {
  userId: string
  email: string | null
  isAdmin: boolean
  /** Where to send the browser after a successful delete (detail page use). Omitted on the list page — it just refreshes in place. */
  redirectTo?: string
  compact?: boolean
}

// Shared by the users list (one per row) and the user detail page. Deletion
// ground rule: destructive + high-stakes, so the admin must TYPE the target's
// exact email before the confirm button enables — matches the server route's
// own re-check (src/app/api/admin/users/[id]/route.ts), which is the real
// enforcement point. This UI gate is a courtesy against fat-fingering, not security.
export function DeleteUserButton({ userId, email, isAdmin, redirectTo, compact }: DeleteUserButtonProps) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (isAdmin) {
    return (
      <span className="text-xs text-slate-500 light:text-gray-400 italic">Admin — protected</span>
    )
  }

  if (!email) {
    return (
      <span className="text-xs text-slate-500 light:text-gray-400 italic">No email on record — cannot confirm delete</span>
    )
  }

  const matches = typed.trim().toLowerCase() === email.toLowerCase()

  async function doDelete() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: typed.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Failed to delete account')
        return
      }
      if (redirectTo) {
        router.push(redirectTo)
      } else {
        setConfirming(false)
        setTyped('')
        router.refresh()
      }
    } catch {
      setError('Failed to delete account')
    } finally {
      setBusy(false)
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className={`font-medium rounded-lg border border-red-500/20 text-red-300/80 hover:border-red-500/40 hover:text-red-300 light:border-red-200 light:text-red-500 light:hover:border-red-300 ${compact ? 'text-xs px-2.5 py-1' : 'text-sm px-4 py-2'}`}
      >
        Remove account
      </button>
    )
  }

  return (
    <div className="inline-flex flex-col gap-2 items-start">
      <p className="text-xs text-red-300 light:text-red-600">
        This permanently deletes the account and everything owned by it (ideas, reports, purchases). Type{' '}
        <span className="font-mono font-semibold">{email}</span> to confirm.
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          value={typed}
          onChange={e => setTyped(e.target.value)}
          placeholder={email}
          className="text-xs rounded-lg border border-white/10 bg-slate-950/60 light:bg-white light:border-gray-300 px-2.5 py-1.5 text-white light:text-gray-900 placeholder:text-slate-600 light:placeholder:text-gray-400 focus:outline-none focus:border-red-500 min-w-[220px]"
        />
        <button
          onClick={doDelete}
          disabled={!matches || busy}
          className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-red-500/80 hover:bg-red-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? 'Deleting…' : 'Yes, permanently delete'}
        </button>
        <button
          onClick={() => {
            setConfirming(false)
            setTyped('')
            setError('')
          }}
          disabled={busy}
          className="text-xs text-slate-400 hover:text-white light:text-gray-500 light:hover:text-gray-900"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-300 light:text-red-600">{error}</p>}
    </div>
  )
}
