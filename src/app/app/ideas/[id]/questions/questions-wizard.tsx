'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { COUNTRIES, symbolForCountry } from '@/lib/countries'

interface Question {
  key: string
  text: string
  subtext?: string | null
  input_type: 'text' | 'select' | 'number' | 'multiselect' | 'country'
  options?: string[]
  required: boolean
  maps_to?: string
}

const COUNTRY_QUESTION_KEY = 'founder_location_country'

// Number questions whose answer is an amount of money (as opposed to watts,
// minutes, batch counts…) — these get the currency-symbol prefix.
const MONEY_MAPS_TO = new Set([
  'cost.materials',
  'cost.packaging_per_unit',
  'cost.hourly_rate',
  'cost.unit_cost_estimate',
])

// Money-flavoured option strings in the static banks are written with a plain
// "$" (e.g. "$500–$2,000"). Once the founder's country is known, show — and
// store — them in the founder's own currency symbol.
function localiseCurrency(text: string, symbol: string): string {
  if (!symbol || symbol === '$') return text
  return text.replace(/(?<![A-Za-z])\$/g, symbol)
}

interface ExistingAnswer {
  question_key: string
  answer_text: string
  position: number
}

interface ApiResponse {
  questions: Question[]
  existing_answers: ExistingAnswer[]
}

function parseValue(q: Question, saved: string): string | string[] {
  if (q.input_type === 'multiselect') {
    try { return JSON.parse(saved) as string[] } catch { return [] }
  }
  return saved
}

function encodeValue(value: string | string[]): string {
  if (Array.isArray(value)) return value.length > 0 ? JSON.stringify(value) : ''
  return value.trim()
}

// ── Input components ──────────────────────────────────────────

function TextInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <textarea
      className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-slate-500 light:bg-white light:border-gray-300 light:text-gray-900 light:placeholder-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
      rows={4}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder="Type your answer…"
    />
  )
}

function NumberInput({ value, onChange, symbol }: { value: string; onChange: (v: string) => void; symbol?: string }) {
  return (
    <div className="relative">
      {symbol && (
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400 light:text-gray-500 pointer-events-none">
          {symbol}
        </span>
      )}
      <input
        type="number"
        className={`w-full rounded-lg bg-white/5 border border-white/10 ${symbol ? 'pl-12' : 'px-4'} pr-4 py-3 text-sm text-white placeholder-slate-500 light:bg-white light:border-gray-300 light:text-gray-900 light:placeholder-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-500`}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Enter a number…"
      />
    </div>
  )
}

function CountrySelectInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-3 text-sm text-white
                 light:bg-white light:border-gray-300 light:text-gray-900
                 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
    >
      <option value="">Select your country…</option>
      {COUNTRIES.map(c => (
        <option key={`${c.code}-${c.name}`} value={c.code} disabled={!c.code}>
          {c.name}
        </option>
      ))}
    </select>
  )
}

function SelectInput({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      {options.map(opt => (
        <label key={opt} className="flex items-center gap-3 cursor-pointer group">
          <input
            type="radio"
            name="select-option"
            value={opt}
            checked={value === opt}
            onChange={() => onChange(opt)}
            className="h-4 w-4 border-white/10 bg-white/5 text-indigo-500 light:border-gray-300 light:bg-white focus:ring-indigo-500"
          />
          <span className={`text-sm ${value === opt ? 'text-white light:text-gray-900 font-medium' : 'text-slate-300 group-hover:text-white light:text-gray-700 light:group-hover:text-gray-900'}`}>
            {opt}
          </span>
        </label>
      ))}
    </div>
  )
}

function MultiSelectInput({ value, options, onChange }: { value: string[]; options: string[]; onChange: (v: string[]) => void }) {
  function toggle(opt: string) {
    onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt])
  }
  return (
    <div className="space-y-2">
      {options.map(opt => (
        <label key={opt} className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            value={opt}
            checked={value.includes(opt)}
            onChange={() => toggle(opt)}
            className="h-4 w-4 rounded border-white/10 bg-white/5 text-indigo-500 light:border-gray-300 light:bg-white focus:ring-indigo-500"
          />
          <span className={`text-sm ${value.includes(opt) ? 'text-white light:text-gray-900 font-medium' : 'text-slate-300 group-hover:text-white light:text-gray-700 light:group-hover:text-gray-900'}`}>
            {opt}
          </span>
        </label>
      ))}
      {value.length > 0 && (
        <p className="text-xs text-indigo-400 light:text-indigo-700 mt-1">{value.length} selected</p>
      )}
    </div>
  )
}

// ── Wizard ─────────────────────────────────────────────────────

export default function QuestionsWizard({ ideaId, editKey }: { ideaId: string; editKey?: string }) {
  const router = useRouter()
  const isEditing = Boolean(editKey)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Map<string, string>>(new Map())
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasFetchedDynamic, setHasFetchedDynamic] = useState(false)
  const [currentValue, setCurrentValue] = useState<string | string[]>('')
  const [validationError, setValidationError] = useState<string | null>(null)

  const fetchQuestions = useCallback(async (): Promise<ApiResponse> => {
    const res = await fetch(`/api/ideas/${ideaId}/questions`)
    if (!res.ok) throw new Error('Failed to fetch questions')
    return res.json()
  }, [ideaId])

  // Initial load
  useEffect(() => {
    fetchQuestions()
      .then(data => {
        const qs = data.questions ?? []
        const answerMap = new Map<string, string>()
        ;(data.existing_answers ?? []).forEach(a => answerMap.set(a.question_key, a.answer_text))

        setQuestions(qs)
        setAnswers(answerMap)

        // Jump straight to the question being edited (from the review page),
        // otherwise resume from the first unanswered question
        const editIdx = editKey ? qs.findIndex(q => q.key === editKey) : -1
        const firstUnanswered = qs.findIndex(q => !answerMap.has(q.key))
        const resumeIdx = editIdx !== -1
          ? editIdx
          : firstUnanswered === -1 ? Math.max(0, qs.length - 1) : firstUnanswered
        setCurrentIndex(resumeIdx)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [fetchQuestions, editKey])

  // Sync input value when navigating to a different question
  useEffect(() => {
    const q = questions[currentIndex]
    if (!q) return
    setCurrentValue(parseValue(q, answers.get(q.key) ?? ''))
    setValidationError(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, questions])

  async function saveAnswer(q: Question, answerText: string) {
    await fetch(`/api/ideas/${ideaId}/answers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question_key: q.key,
        question_text: q.text,
        answer_text: answerText,
        position: currentIndex,
      }),
    })
  }

  async function completeWizard() {
    const res = await fetch(`/api/ideas/${ideaId}/complete`, { method: 'POST' })
    if (res.ok) {
      router.push(`/app/ideas/${ideaId}/summary`)
    } else {
      const data = await res.json()
      setValidationError(data.error ?? 'Could not complete. Please check all required questions are answered.')
    }
  }

  async function handleNext() {
    const q = questions[currentIndex]
    if (!q) return

    const answerText = encodeValue(currentValue)

    if (q.required && !answerText) {
      setValidationError('Please answer this question before continuing.')
      return
    }

    setSaving(true)
    setValidationError(null)

    try {
      let updatedQuestions = questions
      const newAnswers = new Map(answers)

      if (answerText) {
        await saveAnswer(q, answerText)
        newAnswers.set(q.key, answerText)
        setAnswers(newAnswers)
      }

      // Edit mode: this was a one-question visit — back to the review page
      if (isEditing) {
        router.push(`/app/ideas/${ideaId}/summary`)
        return
      }

      // After answering last required static question, fetch to pick up dynamic questions
      if (!hasFetchedDynamic) {
        const allRequiredAnswered = questions
          .filter(qq => qq.required)
          .every(qq => newAnswers.has(qq.key))

        if (allRequiredAnswered) {
          const data = await fetchQuestions()
          updatedQuestions = data.questions ?? questions
          setQuestions(updatedQuestions)
          setHasFetchedDynamic(true)
        }
      }

      if (currentIndex < updatedQuestions.length - 1) {
        setCurrentIndex(currentIndex + 1)
      } else {
        await completeWizard()
      }
    } catch (err) {
      console.error(err)
      setValidationError('Something went wrong saving your answer. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSkip() {
    setValidationError(null)
    setSaving(true)
    try {
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(currentIndex + 1)
      } else {
        await completeWizard()
      }
    } finally {
      setSaving(false)
    }
  }

  function handleBack() {
    if (isEditing) {
      router.push(`/app/ideas/${ideaId}/summary`)
      return
    }
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      setValidationError(null)
    }
  }

  // ── Render ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400 light:text-gray-500 text-sm">
        No questions available for this idea type.
      </div>
    )
  }

  const q = questions[currentIndex]
  const isLast = currentIndex === questions.length - 1
  const answeredCount = questions.filter(qq => answers.has(qq.key)).length
  const progressPct = Math.round((answeredCount / questions.length) * 100)

  // Country is the first question, so money questions after it can render in
  // the founder's own currency symbol.
  const answeredCountry = answers.get(COUNTRY_QUESTION_KEY) ?? ''
  const currencySymbol = answeredCountry ? symbolForCountry(answeredCountry) : ''
  const isMoneyQuestion = !!q.maps_to && (q.maps_to.startsWith('price.') || MONEY_MAPS_TO.has(q.maps_to))
  const localisedOptions = q.options && currencySymbol
    ? q.options.map(o => localiseCurrency(o, currencySymbol))
    : q.options

  return (
    <div className="space-y-8">
      {/* Progress (hidden when editing a single answer) */}
      {!isEditing && (
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-slate-500 light:text-gray-400 font-medium">
              Question {currentIndex + 1} of {questions.length}
            </span>
            <span className="text-xs text-slate-500 light:text-gray-400">{progressPct}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/10 light:bg-gray-200">
            <div
              className="h-1.5 rounded-full bg-indigo-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Question card */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm p-6">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-sm font-medium text-white light:text-gray-900">{q.text}</span>
          {!q.required && (
            <span className="rounded-full bg-white/10 light:bg-gray-200 px-2 py-0.5 text-xs text-slate-400 light:text-gray-500">Optional</span>
          )}
        </div>
        {q.subtext && (
          <p className="mb-5 text-xs text-slate-400 light:text-gray-500">{q.subtext}</p>
        )}
        {!q.subtext && <div className="mb-5" />}

        {q.input_type === 'text' && (
          <TextInput
            value={currentValue as string}
            onChange={v => setCurrentValue(v)}
          />
        )}
        {q.input_type === 'number' && (
          <NumberInput
            value={currentValue as string}
            onChange={v => setCurrentValue(v)}
            symbol={isMoneyQuestion && currencySymbol ? currencySymbol : undefined}
          />
        )}
        {q.input_type === 'country' && (
          <CountrySelectInput
            value={currentValue as string}
            onChange={v => setCurrentValue(v)}
          />
        )}
        {q.input_type === 'select' && localisedOptions && (
          <SelectInput
            value={currentValue as string}
            options={localisedOptions}
            onChange={v => setCurrentValue(v)}
          />
        )}
        {q.input_type === 'multiselect' && localisedOptions && (
          <MultiSelectInput
            value={currentValue as string[]}
            options={localisedOptions}
            onChange={v => setCurrentValue(v)}
          />
        )}

        {validationError && (
          <p className="mt-3 text-xs text-red-300 light:text-red-600">{validationError}</p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleBack}
          disabled={(currentIndex === 0 && !isEditing) || saving}
          className="text-sm text-slate-300 hover:text-white light:text-gray-700 light:hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isEditing ? '← Back to review' : '← Back'}
        </button>

        <div className="flex items-center gap-3">
          {!q.required && !isEditing && (
            <button
              onClick={handleSkip}
              disabled={saving}
              className="text-sm text-slate-400 hover:text-slate-200 light:text-gray-500 light:hover:text-gray-700 disabled:opacity-30"
            >
              Skip
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving && (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
            {isEditing ? 'Save & back to review' : isLast ? 'Generate Report →' : 'Continue →'}
          </button>
        </div>
      </div>
    </div>
  )
}
