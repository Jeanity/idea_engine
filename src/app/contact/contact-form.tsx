'use client'

import { useState } from 'react'
import Link from 'next/link'

type Category = 'feedback' | 'complaint' | 'question' | 'billing' | 'partnership'

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'feedback', label: 'Feedback' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'billing', label: 'Billing & refunds' },
  { value: 'question', label: 'General question' },
  { value: 'partnership', label: 'Partnership & advertising' },
]

const inputCls =
  'w-full rounded-lg border border-white/10 bg-slate-900/60 light:bg-white light:border-gray-300 px-3 py-2 text-sm text-white light:text-gray-900 placeholder:text-slate-600 light:placeholder:text-gray-400 focus:outline-none focus:border-indigo-500'
const labelCls = 'block text-xs font-medium text-slate-400 light:text-gray-500 mb-1.5'

export function ContactForm({ defaultName, defaultEmail }: { defaultName: string; defaultEmail: string }) {
  const [category, setCategory] = useState<Category>('question')
  const [name, setName] = useState(defaultName)
  const [email, setEmail] = useState(defaultEmail)
  const [message, setMessage] = useState('')
  // Honeypot: a field real visitors never see or fill. Bots that auto-fill
  // every input on a page will populate it, so a non-empty value here means
  // "reject silently" — no captcha, no friction for real users.
  const [website, setWebsite] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const trimmedName = name.trim()
    const trimmedEmail = email.trim()
    const trimmedMessage = message.trim()
    if (!trimmedName || !trimmedEmail || !trimmedMessage) {
      setError('Please fill in your name, email, and message.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          name: trimmedName,
          email: trimmedEmail,
          message: trimmedMessage,
          website, // honeypot
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong — please try again.')
        return
      }
      setDone(true)
    } catch {
      setError('Something went wrong — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-5 py-5 light:border-emerald-200 light:bg-emerald-50">
        <p className="text-sm font-semibold text-emerald-200 light:text-emerald-900">Message sent</p>
        <p className="mt-1 text-sm text-emerald-100/90 light:text-emerald-800">
          Thanks for reaching out — we read every message and will get back to you at {email} if a
          reply is needed.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Honeypot — hidden from real users via CSS, not display:none (some bots skip those). */}
      <div className="absolute left-[-9999px] top-auto h-0 w-0 overflow-hidden" aria-hidden="true">
        <label htmlFor="website">Leave this field empty</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={e => setWebsite(e.target.value)}
        />
      </div>

      <div>
        <span className={labelCls}>What&apos;s this about?</span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CATEGORIES.map(c => (
            <label
              key={c.value}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                category === c.value
                  ? 'border-indigo-400/50 bg-indigo-500/10 text-white light:border-indigo-300 light:bg-indigo-50 light:text-gray-900'
                  : 'border-white/10 text-slate-300 hover:border-white/20 light:border-gray-200 light:text-gray-600 light:hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="category"
                value={c.value}
                checked={category === c.value}
                onChange={() => setCategory(c.value)}
                className="accent-indigo-500"
              />
              {c.label}
            </label>
          ))}
        </div>
        {category === 'billing' && (
          <p className="mt-2 text-xs text-slate-400 light:text-gray-500">
            Our refund policy is in the{' '}
            <Link href="/terms" className="text-indigo-400 hover:text-indigo-300 light:text-indigo-600 light:hover:text-indigo-700 underline">
              Terms
            </Link>
            .
          </p>
        )}
      </div>

      <div>
        <label className={labelCls} htmlFor="name">
          Name
        </label>
        <input id="name" className={inputCls} value={name} onChange={e => setName(e.target.value)} required />
      </div>

      <div>
        <label className={labelCls} htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          className={inputCls}
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
      </div>

      <div>
        <label className={labelCls} htmlFor="message">
          Message
        </label>
        <textarea
          id="message"
          className={`${inputCls} min-h-[140px]`}
          value={message}
          onChange={e => setMessage(e.target.value)}
          maxLength={5000}
          required
        />
      </div>

      {error && <p className="text-sm text-red-300 light:text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition-colors hover:bg-indigo-400 disabled:opacity-50"
      >
        {submitting ? 'Sending…' : 'Send message'}
      </button>
    </form>
  )
}
