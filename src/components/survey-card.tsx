'use client'

import { useState } from 'react'

// Client twin of SurveyCardData/SurveyCardQuestion in src/lib/survey.ts —
// kept structural (not imported) so this stays a pure client component.
export interface SurveyCardQuestion {
  id: string
  prompt: string
  qtype: 'text' | 'rating' | 'multiple_choice'
  options: string[] | null
  sort_order: number
}

export interface SurveyData {
  show: boolean
  surveyId: string | null
  questions: SurveyCardQuestion[]
}

function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map(i => {
        const filled = (hover || value) >= i
        return (
          <button
            key={i}
            type="button"
            onMouseEnter={() => setHover(i)}
            onClick={() => onChange(i)}
            aria-label={`Rate ${i} star${i === 1 ? '' : 's'}`}
            className="p-0.5"
          >
            <svg viewBox="0 0 20 20" className={`h-6 w-6 transition-colors ${filled ? 'fill-amber-400' : 'fill-white/10 light:fill-gray-200'}`}>
              <path d="M10 1.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L1.6 7.6l5.8-.8z" />
            </svg>
          </button>
        )
      })}
    </div>
  )
}

// Renders the survey resolved server-side by pickSurveyFor (src/lib/survey.ts)
// — used at the end of report pages and on the account page. An answered
// survey is never re-offered on later visits (eligibility handles that);
// `submitted` only covers the rest of THIS page view.
export function SurveyCard({
  data,
  reportId = null,
  className = 'max-w-3xl mx-auto px-6 print:hidden',
  onComplete,
}: {
  data: SurveyData
  reportId?: string | null
  /** Outer wrapper classes — the default matches the report page layout. */
  className?: string
  /** Called once the survey is done — either freshly submitted, or the API
   *  reports it was already answered (409). Used by promo overlays to
   *  dismiss themselves; a stale overlay must never be able to trap a user
   *  who already answered this survey on a previous visit. */
  onComplete?: () => void
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  if (!data.show || !data.surveyId || data.questions.length === 0) return null

  if (submitted) {
    return (
      <div className={className}>
        <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/5 light:bg-emerald-50/50 light:border-emerald-200 light:shadow-sm px-5 py-4">
          <p className="text-sm font-medium text-emerald-200 light:text-emerald-800">Thanks for the feedback!</p>
        </div>
      </div>
    )
  }

  const sorted = [...data.questions].sort((a, b) => a.sort_order - b.sort_order)
  const question = sorted[Math.min(step, sorted.length - 1)]
  const isLast = step >= sorted.length - 1
  const answered = Boolean(answers[question.id]?.trim())

  function setAnswer(questionId: string, value: string) {
    setError('')
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }

  function handleBack() {
    setError('')
    setStep(s => Math.max(0, s - 1))
  }

  function handleNext() {
    if (!answered) {
      setError('Please answer this question to continue.')
      return
    }
    setError('')
    setStep(s => Math.min(sorted.length - 1, s + 1))
  }

  async function handleSubmit() {
    const missingIdx = sorted.findIndex(q => !answers[q.id]?.trim())
    if (missingIdx !== -1) {
      setStep(missingIdx)
      setError('Please answer this question to continue.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          survey_id: data.surveyId,
          report_id: reportId,
          answers: data.questions.map(q => ({ question_id: q.id, answer: answers[q.id] })),
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        // 409 = already answered (e.g. a duplicate tab, or a resubmit after
        // the local `submitted` state was lost on reload) — treat it as
        // complete rather than an error, so a stale promo overlay can never
        // trap the user.
        if (res.status === 409) {
          setSubmitted(true)
          onComplete?.()
          return
        }
        setError(d.error ?? 'Could not save your answers. Please try again.')
        return
      }
      setSubmitted(true)
      onComplete?.()
    } catch {
      setError('Could not save your answers. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={className}>
      <div className="rounded-2xl border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm px-5 py-5">
        <h2 className="font-semibold text-white light:text-gray-900 mb-1">Help us improve by answering a few quick questions</h2>
        <p className="text-xs text-slate-500 light:text-gray-400 mb-4">Your answers help shape what we build next.</p>

        <div className="mb-4 flex items-center gap-3">
          <div className="h-1 flex-1 rounded-full bg-white/10 light:bg-gray-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{ width: `${((step + 1) / sorted.length) * 100}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 light:text-gray-400 whitespace-nowrap">
            {step + 1} of {sorted.length}
          </p>
        </div>

        <div key={question.id}>
          <p className="text-sm text-slate-200 light:text-gray-800 mb-2">{question.prompt}</p>
          {question.qtype === 'text' && (
            <textarea
              value={answers[question.id] ?? ''}
              onChange={e => setAnswer(question.id, e.target.value)}
              rows={3}
              maxLength={2000}
              className="w-full rounded-lg border border-white/10 bg-white/5 light:bg-gray-50 light:border-gray-200 px-3 py-2 text-sm text-slate-200 light:text-gray-800 placeholder:text-slate-500 light:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          )}
          {question.qtype === 'rating' && (
            <StarInput value={Number(answers[question.id]) || 0} onChange={n => setAnswer(question.id, String(n))} />
          )}
          {question.qtype === 'multiple_choice' && (
            <div className="space-y-1.5">
              {(question.options ?? []).map(opt => (
                <label key={opt} className="flex items-center gap-2 text-sm text-slate-300 light:text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name={`survey-${question.id}`}
                    checked={answers[question.id] === opt}
                    onChange={() => setAnswer(question.id, opt)}
                  />
                  {opt}
                </label>
              ))}
            </div>
          )}
        </div>

        {error && <p className="mt-3 text-xs text-red-300 light:text-red-600">{error}</p>}

        <div className="mt-4 flex items-center gap-2">
          {step > 0 && (
            <button
              onClick={handleBack}
              disabled={submitting}
              className="rounded-lg border border-white/10 light:border-gray-200 px-4 py-2 text-sm font-medium text-slate-300 light:text-gray-600 hover:bg-white/5 light:hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Back
            </button>
          )}
          {isLast ? (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-lg bg-indigo-500 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-400 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Submitting…' : 'Submit feedback'}
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="rounded-lg bg-indigo-500 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-400 transition-colors"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
