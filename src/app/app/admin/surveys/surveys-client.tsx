'use client'

import { useState, useEffect, useCallback } from 'react'

type QType = 'text' | 'rating' | 'multiple_choice'

interface Question {
  id: string
  prompt: string
  qtype: QType
  options: string[] | null
  sort_order: number
  active: boolean
  created_at: string
  responseCount: number
}

interface QuestionsState {
  migrationMissing: boolean
  enabled: boolean
  questions: Question[]
}

interface RatingResult {
  id: string
  prompt: string
  qtype: 'rating'
  active: boolean
  respondentCount: number
  average: number | null
  distribution: Record<number, number>
}
interface ChoiceResult {
  id: string
  prompt: string
  qtype: 'multiple_choice'
  active: boolean
  respondentCount: number
  options: string[] | null
  counts: Record<string, number>
}
interface TextResult {
  id: string
  prompt: string
  qtype: 'text'
  active: boolean
  respondentCount: number
  texts: Array<{ answer: string; name: string; createdAt: string }>
}
type QuestionResult = RatingResult | ChoiceResult | TextResult

const inputCls =
  'w-full rounded-lg border border-white/10 bg-slate-950/60 light:bg-white light:border-gray-300 px-3 py-2 text-sm text-white light:text-gray-900 placeholder:text-slate-600 light:placeholder:text-gray-400 focus:outline-none focus:border-indigo-500'
const labelCls = 'block text-xs font-medium text-slate-400 light:text-gray-500 mb-1'
const cardCls = 'rounded-lg border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm'

function MigrationMissingNotice() {
  return (
    <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 light:bg-amber-50 light:border-amber-200 px-5 py-5">
      <p className="text-sm font-semibold text-amber-200 light:text-amber-900 mb-1">Survey tables not found</p>
      <p className="text-sm text-amber-100/90 light:text-amber-800">
        Run <code className="rounded bg-black/20 light:bg-amber-100 px-1.5 py-0.5">supabase/migrations/014_surveys.sql</code> in
        the Supabase SQL editor, then reload this page.
      </p>
    </div>
  )
}

export function SurveysClient() {
  const [state, setState] = useState<QuestionsState | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [toggling, setToggling] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetch('/api/admin/surveys')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setLoadError(data.error ?? 'Failed to load surveys.')
        return
      }
      setState(data)
    } catch {
      setLoadError('Failed to load surveys.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleEnabled() {
    if (!state) return
    setToggling(true)
    try {
      const res = await fetch('/api/admin/surveys', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !state.enabled }),
      })
      if (res.ok) await load()
    } finally {
      setToggling(false)
    }
  }

  if (loading && !state) {
    return <p className="text-sm text-slate-400 light:text-gray-500">Loading…</p>
  }
  if (loadError) {
    return <p className="text-sm text-red-300 light:text-red-600">{loadError}</p>
  }
  if (!state) return null
  if (state.migrationMissing) return <MigrationMissingNotice />

  return (
    <div className="space-y-8">
      <div className={`${cardCls} px-5 py-4 flex items-center justify-between gap-4 flex-wrap`}>
        <div>
          <h2 className="font-semibold text-white light:text-gray-900 mb-0.5">Survey card</h2>
          <p className="text-xs text-slate-500 light:text-gray-400">
            Shown at the end of every report page when there are active questions.
          </p>
        </div>
        <button
          onClick={toggleEnabled}
          disabled={toggling}
          className={`text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50 ${
            state.enabled
              ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 light:bg-emerald-50 light:text-emerald-700'
              : 'bg-white/10 text-slate-300 hover:bg-white/15 light:bg-gray-100 light:text-gray-700'
          }`}
        >
          {state.enabled ? 'On — click to turn off' : 'Off — click to turn on'}
        </button>
      </div>

      <QuestionsManager questions={state.questions} onChanged={load} />

      <ResponsesView />
    </div>
  )
}

// ── Question manager ─────────────────────────────────────────────────────

const QTYPE_LABELS: Record<QType, string> = { text: 'Text', rating: 'Rating (1-5)', multiple_choice: 'Multiple choice' }

function QuestionsManager({ questions, onChanged }: { questions: Question[]; onChanged: () => void }) {
  const [adding, setAdding] = useState(false)
  const [newPrompt, setNewPrompt] = useState('')
  const [newType, setNewType] = useState<QType>('text')
  const [newOptions, setNewOptions] = useState('')
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<Record<string, string>>({})

  const sorted = [...questions].sort((a, b) => a.sort_order - b.sort_order)

  async function createQuestion() {
    const prompt = newPrompt.trim()
    if (!prompt) {
      setCreateError('Prompt is required.')
      return
    }
    const options = newType === 'multiple_choice'
      ? newOptions.split('\n').map(o => o.trim()).filter(Boolean)
      : undefined
    if (newType === 'multiple_choice' && (!options || options.length < 2)) {
      setCreateError('Add at least 2 options (one per line).')
      return
    }
    setCreating(true)
    setCreateError('')
    try {
      const res = await fetch('/api/admin/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, qtype: newType, options }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setCreateError(data.error ?? 'Failed to create question.')
        return
      }
      setAdding(false)
      setNewPrompt('')
      setNewOptions('')
      setNewType('text')
      onChanged()
    } catch {
      setCreateError('Failed to create question.')
    } finally {
      setCreating(false)
    }
  }

  async function toggleActive(q: Question) {
    setBusyId(q.id)
    try {
      const res = await fetch(`/api/admin/surveys/${q.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !q.active }),
      })
      if (res.ok) onChanged()
    } finally {
      setBusyId(null)
    }
  }

  async function move(q: Question, direction: 'up' | 'down') {
    const index = sorted.findIndex(x => x.id === q.id)
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (index === -1 || swapIndex < 0 || swapIndex >= sorted.length) return
    const other = sorted[swapIndex]
    setBusyId(q.id)
    try {
      await Promise.all([
        fetch(`/api/admin/surveys/${q.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort_order: other.sort_order }),
        }),
        fetch(`/api/admin/surveys/${other.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort_order: q.sort_order }),
        }),
      ])
      onChanged()
    } finally {
      setBusyId(null)
    }
  }

  async function confirmDelete(q: Question) {
    setBusyId(q.id)
    try {
      const res = await fetch(`/api/admin/surveys/${q.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setDeleteError(prev => ({ ...prev, [q.id]: data.error ?? 'Failed to delete.' }))
        return
      }
      setConfirmingDelete(null)
      onChanged()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-white light:text-gray-900">Questions</h2>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white"
          >
            + Add question
          </button>
        )}
      </div>

      {adding && (
        <div className={`${cardCls} px-5 py-5 mb-4`}>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Prompt</label>
              <input className={inputCls} value={newPrompt} onChange={e => setNewPrompt(e.target.value)} maxLength={500} autoFocus />
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select className={inputCls} value={newType} onChange={e => setNewType(e.target.value as QType)}>
                <option value="text">Text</option>
                <option value="rating">Rating (1-5)</option>
                <option value="multiple_choice">Multiple choice</option>
              </select>
            </div>
            {newType === 'multiple_choice' && (
              <div>
                <label className={labelCls}>Options (one per line)</label>
                <textarea className={`${inputCls} min-h-[80px]`} value={newOptions} onChange={e => setNewOptions(e.target.value)} />
              </div>
            )}
          </div>
          {createError && <p className="text-sm text-red-300 light:text-red-600 mt-3">{createError}</p>}
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={createQuestion}
              disabled={creating}
              className="text-sm font-medium px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create question'}
            </button>
            <button onClick={() => { setAdding(false); setCreateError('') }} disabled={creating} className="text-sm text-slate-400 hover:text-white light:text-gray-500 light:hover:text-gray-900">
              Cancel
            </button>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="text-sm text-slate-500 light:text-gray-400 py-6 text-center">No questions yet.</p>
      ) : (
        <div className="space-y-3">
          {sorted.map((q, i) => (
            <div key={q.id} className={`${cardCls} px-5 py-4`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-medium text-white light:text-gray-900">{q.prompt}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 light:bg-indigo-50 light:text-indigo-700">
                      {QTYPE_LABELS[q.qtype]}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      q.active
                        ? 'bg-emerald-500/10 text-emerald-300 light:bg-emerald-50 light:text-emerald-700'
                        : 'bg-white/10 text-slate-400 light:bg-gray-100 light:text-gray-500'
                    }`}>
                      {q.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {q.options && q.options.length > 0 && (
                    <p className="text-xs text-slate-500 light:text-gray-400">{q.options.join(' · ')}</p>
                  )}
                  <p className="text-xs text-slate-500 light:text-gray-400 mt-0.5">
                    {q.responseCount} response{q.responseCount === 1 ? '' : 's'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => move(q, 'up')}
                    disabled={i === 0 || busyId === q.id}
                    aria-label="Move up"
                    className="text-xs px-2 py-1 rounded-lg border border-white/10 text-slate-300 hover:border-white/20 disabled:opacity-30 light:border-gray-200 light:text-gray-600 light:hover:border-gray-300"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => move(q, 'down')}
                    disabled={i === sorted.length - 1 || busyId === q.id}
                    aria-label="Move down"
                    className="text-xs px-2 py-1 rounded-lg border border-white/10 text-slate-300 hover:border-white/20 disabled:opacity-30 light:border-gray-200 light:text-gray-600 light:hover:border-gray-300"
                  >
                    ↓
                  </button>
                </div>
                <button
                  onClick={() => toggleActive(q)}
                  disabled={busyId === q.id}
                  className="text-xs font-medium px-2.5 py-1 rounded-lg border border-white/10 text-slate-300 hover:border-white/20 disabled:opacity-50 light:border-gray-200 light:text-gray-600 light:hover:border-gray-300"
                >
                  {q.active ? 'Deactivate' : 'Activate'}
                </button>

                {q.responseCount > 0 ? (
                  <span className="text-xs text-slate-500 light:text-gray-400" title="Questions with responses can only be deactivated — responses are never destroyed.">
                    Has responses — deactivate instead of deleting
                  </span>
                ) : confirmingDelete === q.id ? (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <span className="text-xs text-red-300 light:text-red-600">Delete this question permanently?</span>
                    <button
                      onClick={() => confirmDelete(q)}
                      disabled={busyId === q.id}
                      className="text-xs font-medium px-2.5 py-1 rounded-lg bg-red-500/80 hover:bg-red-500 text-white disabled:opacity-50"
                    >
                      {busyId === q.id ? 'Deleting…' : 'Yes, delete'}
                    </button>
                    <button onClick={() => setConfirmingDelete(null)} className="text-xs text-slate-400 hover:text-white light:text-gray-500 light:hover:text-gray-900">
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmingDelete(q.id)}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg border border-red-500/20 text-red-300/80 hover:border-red-500/40 hover:text-red-300 light:border-red-200 light:text-red-500 light:hover:border-red-300"
                  >
                    Delete
                  </button>
                )}
              </div>
              {deleteError[q.id] && <p className="text-xs text-red-300 light:text-red-600 mt-2">{deleteError[q.id]}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Responses view ───────────────────────────────────────────────────────

function ResponsesView() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [questions, setQuestions] = useState<QuestionResult[]>([])
  const [totalRespondents, setTotalRespondents] = useState(0)
  const [summarising, setSummarising] = useState(false)
  const [summary, setSummary] = useState('')
  const [summaryError, setSummaryError] = useState('')

  useEffect(() => {
    fetch('/api/admin/surveys/responses')
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setQuestions(data.questions ?? [])
          setTotalRespondents(data.totalRespondents ?? 0)
        }
      })
      .catch(() => setError('Failed to load responses.'))
      .finally(() => setLoading(false))
  }, [])

  async function summarise() {
    setSummarising(true)
    setSummaryError('')
    setSummary('')
    try {
      const res = await fetch('/api/admin/surveys/summary', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSummaryError(data.error ?? 'Failed to generate a summary.')
        return
      }
      setSummary(data.summary)
    } catch {
      setSummaryError('Failed to generate a summary.')
    } finally {
      setSummarising(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="font-semibold text-white light:text-gray-900">Responses</h2>
          <p className="text-xs text-slate-500 light:text-gray-400">{totalRespondents} total respondent{totalRespondents === 1 ? '' : 's'}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={summarise}
            disabled={summarising || totalRespondents === 0}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-violet-500/15 text-violet-300 hover:bg-violet-500/25 disabled:opacity-50 light:bg-violet-50 light:text-violet-700"
          >
            {summarising ? 'Summarising…' : 'Summarise responses'}
          </button>
          <span className="text-[11px] text-slate-500 light:text-gray-400">Uses a small amount of AI credit</span>
        </div>
      </div>

      {summaryError && <p className="text-sm text-red-300 light:text-red-600 mb-4">{summaryError}</p>}
      {summary && (
        <div className="rounded-lg border border-violet-500/25 bg-violet-500/5 light:bg-violet-50 light:border-violet-200 px-5 py-4 mb-6 whitespace-pre-wrap text-sm text-slate-200 light:text-gray-800 leading-relaxed">
          {summary}
        </div>
      )}

      {loading && <p className="text-sm text-slate-400 light:text-gray-500">Loading…</p>}
      {error && <p className="text-sm text-red-300 light:text-red-600">{error}</p>}

      {!loading && !error && questions.length === 0 && (
        <p className="text-sm text-slate-500 light:text-gray-400 py-6 text-center">No questions yet.</p>
      )}

      <div className="space-y-4">
        {questions.map(q => (
          <div key={q.id} className={`${cardCls} px-5 py-4`}>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <p className="text-sm font-medium text-white light:text-gray-900">{q.prompt}</p>
              <span className="text-xs text-slate-500 light:text-gray-400">
                {q.respondentCount} response{q.respondentCount === 1 ? '' : 's'}
              </span>
            </div>

            {q.qtype === 'rating' && (
              <div>
                <p className="text-sm text-slate-300 light:text-gray-700 mb-2">
                  Average: <span className="font-semibold text-white light:text-gray-900">{q.average !== null ? q.average.toFixed(2) : '—'}</span> / 5
                </p>
                <div className="space-y-1">
                  {[5, 4, 3, 2, 1].map(star => {
                    const count = q.distribution[star] ?? 0
                    const pct = q.respondentCount > 0 ? (count / q.respondentCount) * 100 : 0
                    return (
                      <div key={star} className="flex items-center gap-2 text-xs">
                        <span className="w-8 text-slate-400 light:text-gray-500">{star}★</span>
                        <div className="flex-1 h-2 rounded-full bg-white/10 light:bg-gray-100 overflow-hidden">
                          <div className="h-full bg-amber-400" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-6 text-right text-slate-400 light:text-gray-500">{count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {q.qtype === 'multiple_choice' && (
              <div className="space-y-1">
                {Object.entries(q.counts).map(([option, count]) => {
                  const pct = q.respondentCount > 0 ? (count / q.respondentCount) * 100 : 0
                  return (
                    <div key={option} className="flex items-center gap-2 text-xs">
                      <span className="w-32 shrink-0 truncate text-slate-400 light:text-gray-500" title={option}>{option}</span>
                      <div className="flex-1 h-2 rounded-full bg-white/10 light:bg-gray-100 overflow-hidden">
                        <div className="h-full bg-indigo-400" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-6 text-right text-slate-400 light:text-gray-500">{count}</span>
                    </div>
                  )
                })}
              </div>
            )}

            {q.qtype === 'text' && (
              q.texts.length === 0 ? (
                <p className="text-xs text-slate-500 light:text-gray-400">No responses yet.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {q.texts.map((t, i) => (
                    <div key={i} className="rounded-lg bg-white/5 light:bg-gray-50 px-3 py-2">
                      <p className="text-sm text-slate-200 light:text-gray-800">{t.answer}</p>
                      <p className="text-xs text-slate-500 light:text-gray-400 mt-1">{t.name} · {new Date(t.createdAt).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
