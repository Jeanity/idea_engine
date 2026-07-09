'use client'

import { useState } from 'react'

export interface SurveyCardQuestion {
  id: string
  prompt: string
  qtype: 'text' | 'rating' | 'multiple_choice'
  options: string[] | null
  sort_order: number
}

export interface SurveyData {
  show: boolean
  questions: SurveyCardQuestion[]
  alreadyAnswered: boolean
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

export function SurveyCard({ data, reportId }: { data: SurveyData; reportId: string | null }) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(data.alreadyAnswered)

  if (!data.show) return null

  if (submitted) {
    return (
      <div className="max-w-3xl mx-auto px-6 print:hidden">
        <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/5 light:bg-emerald-50/50 light:border-emerald-200 light:shadow-sm px-5 py-4">
          <p className="text-sm font-medium text-emerald-200 light:text-emerald-800">Thanks for the feedback!</p>
        </div>
      </div>
    )
  }

  function setAnswer(questionId: string, value: string) {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }

  async function handleSubmit() {
    const missing = data.questions.some(q => !answers[q.id]?.trim())
    if (missing) {
      setError('Please answer every question.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_id: reportId,
          answers: data.questions.map(q => ({ question_id: q.id, answer: answers[q.id] })),
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(d.error ?? 'Could not save your answers. Please try again.')
        return
      }
      setSubmitted(true)
    } catch {
      setError('Could not save your answers. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 print:hidden">
      <div className="rounded-2xl border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm px-5 py-5">
        <h2 className="font-semibold text-white light:text-gray-900 mb-1">Help us improve — 2 minutes</h2>
        <p className="text-xs text-slate-500 light:text-gray-400 mb-4">Your answers help shape what we build next.</p>

        <div className="space-y-5">
          {[...data.questions].sort((a, b) => a.sort_order - b.sort_order).map(q => (
            <div key={q.id}>
              <p className="text-sm text-slate-200 light:text-gray-800 mb-2">{q.prompt}</p>
              {q.qtype === 'text' && (
                <textarea
                  value={answers[q.id] ?? ''}
                  onChange={e => setAnswer(q.id, e.target.value)}
                  rows={3}
                  maxLength={2000}
                  className="w-full rounded-lg border border-white/10 bg-white/5 light:bg-gray-50 light:border-gray-200 px-3 py-2 text-sm text-slate-200 light:text-gray-800 placeholder:text-slate-500 light:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              )}
              {q.qtype === 'rating' && (
                <StarInput value={Number(answers[q.id]) || 0} onChange={n => setAnswer(q.id, String(n))} />
              )}
              {q.qtype === 'multiple_choice' && (
                <div className="space-y-1.5">
                  {(q.options ?? []).map(opt => (
                    <label key={opt} className="flex items-center gap-2 text-sm text-slate-300 light:text-gray-700 cursor-pointer">
                      <input
                        type="radio"
                        name={`survey-${q.id}`}
                        checked={answers[q.id] === opt}
                        onChange={() => setAnswer(q.id, opt)}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {error && <p className="mt-3 text-xs text-red-300 light:text-red-600">{error}</p>}

        <div className="mt-4">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-lg bg-indigo-500 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-400 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Submitting…' : 'Submit feedback'}
          </button>
        </div>
      </div>
    </div>
  )
}
