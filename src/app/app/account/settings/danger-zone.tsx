'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

// Self-service account deletion. Follows the project's standing rule that
// every destructive action needs explicit confirmation (see the admin
// delete-user-button.tsx precedent this is visually modeled on): a checkbox
// AND a type-to-confirm "DELETE" input, both required before the button
// enables. On success, sign out client-side then hard-redirect to `/` so no
// stale client state survives the deleted session.
export function DangerZone() {
  const [confirming, setConfirming] = useState(false)
  const [understood, setUnderstood] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const canDelete = understood && typed.trim() === 'DELETE'

  async function doDelete() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/profile/delete-account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: typed.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Failed to delete account')
        setBusy(false)
        return
      }

      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      await supabase.auth.signOut()
      window.location.href = '/'
    } catch {
      setError('Network error — please try again')
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.03] light:border-red-200 light:bg-red-50/40 px-6 py-6">
      <h2 className="text-sm font-semibold text-red-300 light:text-red-700 mb-1">Danger zone</h2>
      <p className="text-sm text-slate-400 light:text-gray-500 mb-4">
        Permanently delete your account, ideas, and reports. This cannot be undone.
      </p>

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-lg border border-red-500/20 px-4 py-2 text-sm font-medium text-red-300/80 hover:border-red-500/40 hover:text-red-300 light:border-red-200 light:text-red-500 light:hover:border-red-300 transition-colors"
        >
          Delete account
        </button>
      ) : (
        <div className="space-y-4 max-w-md">
          <p className="text-xs text-amber-300 light:text-amber-700 rounded-lg bg-amber-500/10 light:bg-amber-50 px-3 py-2">
            Download the PDFs of any reports you want to keep before deleting — reports cannot be
            retrieved afterwards, by anyone, including support. There is no undelete.
          </p>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={understood}
              onChange={e => setUnderstood(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-white/10 bg-white/5 text-red-500 focus:ring-red-500 light:border-gray-300 light:bg-white"
            />
            <span className="text-sm text-slate-300 light:text-gray-700">
              I understand my account, all my ideas, and all reports will be permanently deleted.
            </span>
          </label>

          <div>
            <label className="block text-xs font-medium text-slate-400 light:text-gray-500 mb-1">
              Type <span className="font-mono font-semibold text-red-300 light:text-red-600">DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              placeholder="DELETE"
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-400 light:bg-white light:border-gray-300 light:text-gray-900 light:placeholder:text-gray-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={doDelete}
              disabled={!canDelete || busy}
              className="rounded-lg bg-red-500/80 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {busy ? 'Deleting…' : 'Yes, permanently delete my account'}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false)
                setUnderstood(false)
                setTyped('')
                setError('')
              }}
              disabled={busy}
              className="text-sm text-slate-400 hover:text-white light:text-gray-500 light:hover:text-gray-900"
            >
              Cancel
            </button>
          </div>

          {error && <p className="text-sm text-red-300 light:text-red-600">{error}</p>}
        </div>
      )}
    </div>
  )
}
