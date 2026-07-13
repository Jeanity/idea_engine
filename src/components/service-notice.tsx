'use client'

import { useState } from 'react'

// Shared amber "wrench" notice for the three places a signed-in user can hit
// the engine kill switch's 503 (src/lib/service-mode.ts): NewIdeaForm, the
// ProgressScreen error state, and the promo unlock button — all in
// src/app/app/ideas/[id]/report/report-client.tsx and
// src/components/new-idea-form.tsx. One opt-in button rather than a
// checkbox — a single click is the same consent with one less step.
export function ServiceNotice({ message }: { message: string }) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')

  async function handleClick() {
    setStatus('saving')
    try {
      const res = await fetch('/api/generation-notify', { method: 'POST' })
      setStatus(res.ok ? 'done' : 'error')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 light:bg-amber-50 light:border-amber-200 px-4 py-4 text-center">
      <svg
        className="mx-auto mb-2 w-6 h-6 text-amber-300 light:text-amber-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.652 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085Z"
        />
      </svg>
      <p className="text-sm text-amber-100 light:text-amber-900 mb-3">{message}</p>
      {status === 'done' ? (
        <p className="text-sm font-medium text-emerald-300 light:text-emerald-700">
          You&rsquo;re on the list — we&rsquo;ll email you the moment it&rsquo;s back on.
        </p>
      ) : (
        <>
          <button
            onClick={handleClick}
            disabled={status === 'saving'}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-amber-500/80 hover:bg-amber-500 text-white disabled:opacity-50 transition-colors"
          >
            {status === 'saving' ? 'Saving…' : 'Email me when it’s back on'}
          </button>
          {status === 'error' && (
            <p className="mt-2 text-xs text-red-300 light:text-red-600">Something went wrong — please try again.</p>
          )}
        </>
      )}
    </div>
  )
}
