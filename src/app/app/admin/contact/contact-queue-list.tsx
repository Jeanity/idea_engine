'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface ContactRow {
  id: string
  category: 'feedback' | 'complaint' | 'question' | 'partnership'
  name: string
  email: string
  message: string
  user_id: string | null
  status: 'open' | 'replied' | 'closed'
  created_at: string
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

function ContactItem({ row }: { row: ContactRow }) {
  const router = useRouter()
  const [status, setStatus] = useState(row.status)
  const [saving, setSaving] = useState(false)

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
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${statusTone(status)}`}>
            {status}
          </span>
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
