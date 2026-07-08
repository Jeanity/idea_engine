'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Check, ChevronRight, ChevronDown, Trash2 } from 'lucide-react'

export interface ErrorRow {
  id: string
  occurred_at: string
  source: string
  message: string
  detail: unknown
  path: string | null
  user_id: string | null
}

const CLEAR_ALL_PHRASE = 'DELETE ALL'

function rowToText(r: ErrorRow): string {
  const lines = [
    `[${new Date(r.occurred_at).toISOString()}] ${r.source}`,
    r.message,
  ]
  if (r.path) lines.push(`path: ${r.path}`)
  if (r.user_id) lines.push(`user: ${r.user_id}`)
  if (r.detail !== null && r.detail !== undefined) {
    lines.push(`detail: ${JSON.stringify(r.detail, null, 2)}`)
  }
  return lines.join('\n')
}

// Colour the source badge by broad category so the eye can group at a glance.
function sourceTone(source: string): string {
  if (source.startsWith('inngest')) return 'bg-violet-500/15 text-violet-300 light:bg-violet-100 light:text-violet-700'
  if (source.startsWith('api')) return 'bg-cyan-500/15 text-cyan-300 light:bg-cyan-100 light:text-cyan-700'
  return 'bg-white/10 text-slate-300 light:bg-gray-100 light:text-gray-600'
}

function CopyButton({ getText, label = 'Copy', className = '' }: { getText: () => string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  async function handle() {
    try {
      await navigator.clipboard.writeText(getText())
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard can be blocked (insecure context) — no-op, the button just won't confirm
    }
  }
  return (
    <button
      onClick={handle}
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg border border-white/10 text-slate-300 hover:border-white/20 hover:text-white light:border-gray-200 light:text-gray-600 light:hover:border-gray-300 light:hover:text-gray-900 transition-colors ${className}`}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : label}
    </button>
  )
}

function ErrorItem({ row }: { row: ErrorRow }) {
  const [open, setOpen] = useState(false)
  const hasDetail = row.detail !== null && row.detail !== undefined
  return (
    <div className="px-5 py-3">
      <div className="flex items-start justify-between gap-3">
        <button
          onClick={() => setOpen(o => !o)}
          className="min-w-0 flex-1 flex items-start gap-2 text-left"
          aria-expanded={open}
        >
          <span className="mt-0.5 flex-shrink-0 text-slate-500 light:text-gray-400">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${sourceTone(row.source)}`}>{row.source}</span>
              <span className="text-xs text-slate-500 light:text-gray-400 tabular-nums">{new Date(row.occurred_at).toLocaleString()}</span>
            </span>
            <span className="block text-sm text-slate-200 light:text-gray-800 break-words">{row.message}</span>
          </span>
        </button>
        <CopyButton getText={() => rowToText(row)} className="flex-shrink-0" />
      </div>

      {open && (
        <div className="mt-2 ml-6 space-y-1">
          {row.path && <p className="text-xs text-slate-500 light:text-gray-400"><span className="font-medium text-slate-400 light:text-gray-500">path:</span> {row.path}</p>}
          {row.user_id && <p className="text-xs text-slate-500 light:text-gray-400 break-all"><span className="font-medium text-slate-400 light:text-gray-500">user:</span> {row.user_id}</p>}
          {hasDetail && (
            <pre className="text-xs text-slate-300 light:text-gray-700 bg-black/30 light:bg-gray-50 border border-white/10 light:border-gray-200 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words">
              {JSON.stringify(row.detail, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

function ClearAllButton({ disabled }: { disabled: boolean }) {
  const router = useRouter()
  const [armed, setArmed] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleClear() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/admin/errors', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'all', confirm: text }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Failed to clear the log.')
        return
      }
      setArmed(false)
      setText('')
      router.refresh()
    } catch {
      setError('Failed to clear the log.')
    } finally {
      setBusy(false)
    }
  }

  if (!armed) {
    return (
      <button
        onClick={() => setArmed(true)}
        disabled={disabled}
        className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-red-500/30 text-red-300 hover:border-red-500/50 hover:text-red-200 light:border-red-200 light:text-red-600 light:hover:border-red-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Clear all
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      <span className="text-xs text-slate-400 light:text-gray-500">
        Type <span className="font-mono font-semibold text-red-300 light:text-red-600">{CLEAR_ALL_PHRASE}</span> to confirm:
      </span>
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        autoFocus
        className="w-28 rounded-lg border border-white/10 bg-white/5 light:bg-gray-50 light:border-gray-200 px-2 py-1 text-xs text-slate-200 light:text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-400"
      />
      <button
        onClick={handleClear}
        disabled={busy || text !== CLEAR_ALL_PHRASE}
        className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {busy ? 'Clearing…' : 'Confirm'}
      </button>
      <button
        onClick={() => { setArmed(false); setText(''); setError('') }}
        className="text-xs text-slate-400 hover:text-white light:text-gray-500 light:hover:text-gray-900 underline underline-offset-2"
      >
        Cancel
      </button>
      {error && <span className="text-xs text-red-300 light:text-red-600 w-full text-right">{error}</span>}
    </div>
  )
}

export function ErrorLogList({ rows }: { rows: ErrorRow[] }) {
  return (
    <div>
      <div className="flex items-center justify-end gap-2 mb-3">
        {rows.length > 0 && (
          <CopyButton
            label="Copy page"
            getText={() => rows.map(rowToText).join('\n\n' + '─'.repeat(40) + '\n\n')}
          />
        )}
        <ClearAllButton disabled={rows.length === 0} />
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500 light:text-gray-400 py-10 text-center">No errors logged. 🎉</p>
      ) : (
        <div className="rounded-lg border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm divide-y divide-white/10 light:divide-gray-100 overflow-hidden">
          {rows.map(row => <ErrorItem key={row.id} row={row} />)}
        </div>
      )}
    </div>
  )
}
