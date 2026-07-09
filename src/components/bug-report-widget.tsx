'use client'

import { useEffect, useRef, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Bug } from 'lucide-react'

// "Report a bug" trigger + in-context modal, rendered inline in the small
// link stacks already used for "Regenerate initial report" / "Review / edit
// answers" in both report viewers (src/app/app/ideas/[id]/report/report-client.tsx).
// No dedicated route — keeps the user in place on the report.
//
// Screenshot upload is best-effort: if it fails (including "the bug-screenshots
// bucket doesn't exist yet because migration 018 hasn't run"), the report still
// submits without it. Never block the bug report on the attachment.

const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024 // 5MB

type ModalStatus = 'closed' | 'open' | 'submitting' | 'success'

export function BugReportWidget({
  ideaId,
  reportId,
  reportTab,
}: {
  ideaId?: string | null
  reportId?: string | null
  reportTab?: string | null
}) {
  const [status, setStatus] = useState<ModalStatus>('closed')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [screenshotNote, setScreenshotNote] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isOpen = status === 'open' || status === 'submitting' || status === 'success'

  useEffect(() => {
    if (!isOpen) return
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  function reset() {
    setDescription('')
    setFile(null)
    setFileError('')
    setSubmitError('')
    setScreenshotNote('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function close() {
    setStatus('closed')
    reset()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFileError('')
    if (!f) {
      setFile(null)
      return
    }
    if (!f.type.startsWith('image/')) {
      setFileError('Please attach an image file.')
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    if (f.size > MAX_SCREENSHOT_BYTES) {
      setFileError('Screenshot must be under 5MB.')
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setFile(f)
  }

  async function uploadScreenshot(): Promise<string | null> {
    if (!file) return null
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return null

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${user.id}/${Date.now()}-${safeName}`
      const { error } = await supabase.storage.from('bug-screenshots').upload(path, file)
      if (error) {
        setScreenshotNote("Couldn't attach the screenshot — the report will still be sent.")
        return null
      }
      return path
    } catch {
      setScreenshotNote("Couldn't attach the screenshot — the report will still be sent.")
      return null
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    setStatus('submitting')
    setSubmitError('')

    const screenshotPath = await uploadScreenshot()

    try {
      const res = await fetch('/api/bug-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          screenshot_path: screenshotPath,
          idea_id: ideaId ?? null,
          report_id: reportId ?? null,
          report_tab: reportTab ?? null,
          browser_info: typeof navigator !== 'undefined' ? navigator.userAgent : null,
          page_url: typeof window !== 'undefined' ? window.location.href : null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSubmitError(data.error ?? 'Something went wrong — please try again.')
        setStatus('open')
        return
      }
      setStatus('success')
    } catch {
      setSubmitError('Something went wrong — please try again.')
      setStatus('open')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setStatus('open')}
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 light:text-gray-400 light:hover:text-gray-700 underline underline-offset-2"
      >
        <Bug className="h-3 w-3" aria-hidden="true" />
        Report a bug
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm px-4 py-8 sm:py-12"
          onClick={close}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-white/10 bg-slate-950 light:bg-white light:border-gray-200 shadow-2xl px-6 py-6"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={close}
              aria-label="Close"
              className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white light:text-gray-500 light:hover:bg-gray-100 light:hover:text-gray-900"
            >
              ×
            </button>

            {status === 'success' ? (
              <div className="py-8 text-center">
                <p className="text-sm font-medium text-white light:text-gray-900">Thanks — we&apos;ll take a look.</p>
                {screenshotNote && (
                  <p className="mt-2 text-xs text-amber-300 light:text-amber-700">{screenshotNote}</p>
                )}
                <button
                  onClick={close}
                  className="mt-4 rounded-lg bg-indigo-500 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-400 transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <h2 className="text-sm font-semibold text-white light:text-gray-900 mb-1">Report a bug</h2>
                <p className="text-xs text-slate-400 light:text-gray-500 mb-4">
                  Tell us what went wrong. A screenshot helps but isn&apos;t required.
                </p>

                <label className="block text-xs font-medium text-slate-300 light:text-gray-600 mb-1">
                  What went wrong
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  required
                  maxLength={5000}
                  rows={4}
                  autoFocus
                  className="w-full rounded-lg border border-white/10 bg-white/5 light:bg-gray-50 light:border-gray-200 px-3 py-2 text-sm text-slate-200 light:text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-3"
                  placeholder="Describe the issue…"
                />

                <label className="block text-xs font-medium text-slate-300 light:text-gray-600 mb-1">
                  Screenshot (optional)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="block w-full text-xs text-slate-400 light:text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-200 hover:file:bg-white/20 light:file:bg-gray-100 light:file:text-gray-700 light:hover:file:bg-gray-200 mb-1"
                />
                {fileError && <p className="text-xs text-red-300 light:text-red-600 mb-2">{fileError}</p>}
                {file && !fileError && (
                  <p className="text-xs text-slate-500 light:text-gray-400 mb-2">{file.name}</p>
                )}
                {screenshotNote && (
                  <p className="text-xs text-amber-300 light:text-amber-700 mb-2">{screenshotNote}</p>
                )}

                {submitError && <p className="text-xs text-red-300 light:text-red-600 mt-1 mb-2">{submitError}</p>}

                <button
                  type="submit"
                  disabled={status === 'submitting' || !description.trim()}
                  className="mt-2 w-full rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {status === 'submitting' ? 'Sending…' : 'Send report'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
