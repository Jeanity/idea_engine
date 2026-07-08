'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { OfferAudience } from '@/lib/database.types'
import { offerLifecycleStatus, formatDiscount, type OfferLifecycleStatus } from '@/lib/offers'

export interface OfferRow {
  id: string
  code: string
  description: string
  percent_off: number | null
  amount_off_cents: number | null
  audience: OfferAudience
  show_on_homepage: boolean
  show_in_account: boolean
  starts_at: string
  ends_at: string | null
  max_redemptions: number | null
  redemption_count: number
  active: boolean
  stripe_promotion_code_id: string | null
  created_at: string
}

interface FormState {
  code: string
  description: string
  percent_off: string
  amount_off_cents: string
  audience: OfferAudience
  show_on_homepage: boolean
  show_in_account: boolean
  starts_at: string
  ends_at: string
  max_redemptions: string
}

const EMPTY_FORM: FormState = {
  code: '',
  description: '',
  percent_off: '',
  amount_off_cents: '',
  audience: 'everyone',
  show_on_homepage: false,
  show_in_account: false,
  starts_at: '',
  ends_at: '',
  max_redemptions: '',
}

const AUDIENCE_LABELS: Record<OfferAudience, string> = {
  new_users: 'New users',
  account_holders: 'Account holders',
  everyone: 'Everyone',
}

const STATUS_STYLES: Record<OfferLifecycleStatus, string> = {
  live: 'bg-emerald-500/10 text-emerald-300 light:bg-emerald-50 light:text-emerald-700',
  scheduled: 'bg-blue-500/10 text-blue-300 light:bg-blue-50 light:text-blue-700',
  expired: 'bg-white/10 text-slate-400 light:bg-gray-100 light:text-gray-500',
}

const STATUS_LABELS: Record<OfferLifecycleStatus, string> = {
  live: 'Live',
  scheduled: 'Scheduled',
  expired: 'Expired',
}

const inputCls =
  'w-full rounded-lg border border-white/10 bg-slate-950/60 light:bg-white light:border-gray-300 px-3 py-2 text-sm text-white light:text-gray-900 placeholder:text-slate-600 light:placeholder:text-gray-400 focus:outline-none focus:border-indigo-500'
const labelCls = 'block text-xs font-medium text-slate-400 light:text-gray-500 mb-1'
const checkboxRowCls = 'flex items-center gap-2 text-sm text-slate-300 light:text-gray-700'

/** ISO string → value for a `datetime-local` input, in the browser's local time. Empty string for null/empty. */
function toDatetimeLocal(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function OffersClient({ initialOffers }: { initialOffers: OfferRow[] }) {
  const router = useRouter()
  // `editing`: null = closed, 'new' = add form, otherwise the id being edited.
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)

  function openNew() {
    setEditing('new')
    setForm(EMPTY_FORM)
    setError('')
  }

  function openEdit(offer: OfferRow) {
    setEditing(offer.id)
    setForm({
      code: offer.code,
      description: offer.description,
      percent_off: offer.percent_off != null ? String(offer.percent_off) : '',
      amount_off_cents: offer.amount_off_cents != null ? String(offer.amount_off_cents) : '',
      audience: offer.audience,
      show_on_homepage: offer.show_on_homepage,
      show_in_account: offer.show_in_account,
      starts_at: toDatetimeLocal(offer.starts_at),
      ends_at: toDatetimeLocal(offer.ends_at ?? ''),
      max_redemptions: offer.max_redemptions != null ? String(offer.max_redemptions) : '',
    })
    setError('')
  }

  function closeForm() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setError('')
  }

  async function save() {
    if (form.percent_off.trim() && form.amount_off_cents.trim()) {
      setError('Set either percent off or amount off, not both.')
      return
    }

    setSaving(true)
    setError('')
    const payload = {
      code: form.code.trim().toUpperCase(),
      description: form.description.trim(),
      percent_off: form.percent_off.trim() ? Number(form.percent_off) : null,
      amount_off_cents: form.amount_off_cents.trim() ? Number(form.amount_off_cents) : null,
      audience: form.audience,
      show_on_homepage: form.show_on_homepage,
      show_in_account: form.show_in_account,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : new Date().toISOString(),
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      max_redemptions: form.max_redemptions.trim() ? Number(form.max_redemptions) : null,
    }
    try {
      const isNew = editing === 'new'
      const res = await fetch('/api/admin/offers', {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isNew ? payload : { id: editing, ...payload }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Failed to save')
        return
      }
      closeForm()
      router.refresh()
    } catch {
      setError('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(offer: OfferRow) {
    setBusyId(offer.id)
    try {
      const res = await fetch('/api/admin/offers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: offer.id, active: !offer.active }),
      })
      if (res.ok) router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  async function confirmDelete(id: string) {
    setBusyId(id)
    try {
      const res = await fetch('/api/admin/offers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, confirm: true }),
      })
      if (res.ok) {
        setConfirmingDelete(null)
        router.refresh()
      }
    } finally {
      setBusyId(null)
    }
  }

  const renderForm = (
    <div className="rounded-lg border border-indigo-500/30 bg-slate-900/80 light:bg-white light:border-indigo-200 light:shadow-sm px-5 py-5 mb-6">
      <h2 className="text-sm font-semibold text-white light:text-gray-900 mb-4">
        {editing === 'new' ? 'Add offer' : 'Edit offer'}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Code</label>
          <input className={inputCls} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="LAUNCH20" />
        </div>
        <div>
          <label className={labelCls}>Audience</label>
          <select
            className={inputCls}
            value={form.audience}
            onChange={e => setForm({ ...form, audience: e.target.value as OfferAudience })}
          >
            {(Object.keys(AUDIENCE_LABELS) as OfferAudience[]).map(a => (
              <option key={a} value={a}>{AUDIENCE_LABELS[a]}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Description (shown to users)</label>
          <input className={inputCls} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="20% off your first full report" />
        </div>
        <div>
          <label className={labelCls}>Percent off (1–100)</label>
          <input
            type="number"
            min={1}
            max={100}
            className={inputCls}
            value={form.percent_off}
            onChange={e => setForm({ ...form, percent_off: e.target.value, amount_off_cents: e.target.value ? '' : form.amount_off_cents })}
            placeholder="20"
          />
        </div>
        <div>
          <label className={labelCls}>Amount off (cents)</label>
          <input
            type="number"
            min={1}
            className={inputCls}
            value={form.amount_off_cents}
            onChange={e => setForm({ ...form, amount_off_cents: e.target.value, percent_off: e.target.value ? '' : form.percent_off })}
            placeholder="500"
          />
          <p className="text-xs text-slate-500 light:text-gray-400 mt-1">Use one or the other, not both.</p>
        </div>
        <div>
          <label className={labelCls}>Starts at</label>
          <input type="datetime-local" className={inputCls} value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} />
          <p className="text-xs text-slate-500 light:text-gray-400 mt-1">Leave blank to start now.</p>
        </div>
        <div>
          <label className={labelCls}>Ends at (optional)</label>
          <input type="datetime-local" className={inputCls} value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} />
        </div>
        <div>
          <label className={labelCls}>Max redemptions (optional)</label>
          <input
            type="number"
            min={1}
            className={inputCls}
            value={form.max_redemptions}
            onChange={e => setForm({ ...form, max_redemptions: e.target.value })}
            placeholder="Unlimited"
          />
        </div>
        <div className="flex flex-col justify-end gap-2">
          <label className={checkboxRowCls}>
            <input type="checkbox" checked={form.show_on_homepage} onChange={e => setForm({ ...form, show_on_homepage: e.target.checked })} />
            Show on homepage banner
          </label>
          <label className={checkboxRowCls}>
            <input type="checkbox" checked={form.show_in_account} onChange={e => setForm({ ...form, show_in_account: e.target.checked })} />
            Show in account banner
          </label>
        </div>
      </div>
      {error && <p className="text-sm text-red-300 light:text-red-600 mt-3">{error}</p>}
      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={save}
          disabled={saving}
          className="text-sm font-medium px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : editing === 'new' ? 'Create offer' : 'Save changes'}
        </button>
        <button onClick={closeForm} disabled={saving} className="text-sm text-slate-400 hover:text-white light:text-gray-500 light:hover:text-gray-900">
          Cancel
        </button>
      </div>
    </div>
  )

  return (
    <div>
      {editing === 'new' ? (
        renderForm
      ) : (
        <button
          onClick={openNew}
          className="text-sm font-medium px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white mb-6"
        >
          + Add offer
        </button>
      )}

      {initialOffers.length === 0 ? (
        <p className="text-sm text-slate-500 light:text-gray-400 py-8 text-center">No offers yet.</p>
      ) : (
        <div className="space-y-4">
          {initialOffers.map(offer =>
            editing === offer.id ? (
              <div key={offer.id}>{renderForm}</div>
            ) : (
              <div
                key={offer.id}
                className="rounded-lg border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm px-5 py-4"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <code className="text-sm font-semibold px-2 py-0.5 rounded bg-white/10 text-white light:bg-gray-100 light:text-gray-900">{offer.code}</code>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[offerLifecycleStatus(offer)]}`}>
                        {STATUS_LABELS[offerLifecycleStatus(offer)]}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-400 light:bg-gray-100 light:text-gray-500">
                        {AUDIENCE_LABELS[offer.audience]}
                      </span>
                      {formatDiscount(offer) && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 light:bg-indigo-50 light:text-indigo-700">
                          {formatDiscount(offer)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-300 light:text-gray-700">{offer.description}</p>
                    <p className="text-xs text-slate-500 light:text-gray-400 mt-1">
                      {offer.show_on_homepage && 'Homepage'}
                      {offer.show_on_homepage && offer.show_in_account && ' · '}
                      {offer.show_in_account && 'Account'}
                      {!offer.show_on_homepage && !offer.show_in_account && 'Not displayed anywhere'}
                      {offer.max_redemptions != null && ` · ${offer.redemption_count}/${offer.max_redemptions} redeemed`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <button onClick={() => openEdit(offer)} className="text-xs font-medium px-2.5 py-1 rounded-lg border border-white/10 text-slate-300 hover:border-white/20 light:border-gray-200 light:text-gray-600 light:hover:border-gray-300">
                    Edit
                  </button>
                  <button
                    onClick={() => toggleActive(offer)}
                    disabled={busyId === offer.id}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg border border-white/10 text-slate-300 hover:border-white/20 disabled:opacity-50 light:border-gray-200 light:text-gray-600 light:hover:border-gray-300"
                  >
                    {offer.active ? 'Deactivate' : 'Activate'}
                  </button>

                  {confirmingDelete === offer.id ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="text-xs text-red-300 light:text-red-600">Delete permanently?</span>
                      <button
                        onClick={() => confirmDelete(offer.id)}
                        disabled={busyId === offer.id}
                        className="text-xs font-medium px-2.5 py-1 rounded-lg bg-red-500/80 hover:bg-red-500 text-white disabled:opacity-50"
                      >
                        {busyId === offer.id ? 'Deleting…' : 'Yes, delete'}
                      </button>
                      <button onClick={() => setConfirmingDelete(null)} className="text-xs text-slate-400 hover:text-white light:text-gray-500 light:hover:text-gray-900">
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmingDelete(offer.id)}
                      className="text-xs font-medium px-2.5 py-1 rounded-lg border border-red-500/20 text-red-300/80 hover:border-red-500/40 hover:text-red-300 light:border-red-200 light:text-red-500 light:hover:border-red-300"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}
