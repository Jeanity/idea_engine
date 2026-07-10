'use client'

import { useState, useEffect, useCallback } from 'react'
import { PLACEMENT_LABELS } from '../surveys-client'

type Placement = keyof typeof PLACEMENT_LABELS

interface SurveyOption {
  id: string
  name: string
  group_id: string | null
  active: boolean
  placement: Placement
  respondentCount: number
}
interface GroupOption {
  id: string
  name: string
}

interface RatingResult {
  id: string
  prompt: string
  qtype: 'rating'
  active: boolean
  surveyName: string
  respondentCount: number
  average: number | null
  distribution: Record<number, number>
}
interface ChoiceResult {
  id: string
  prompt: string
  qtype: 'multiple_choice'
  active: boolean
  surveyName: string
  respondentCount: number
  options: string[] | null
  counts: Record<string, number>
}
interface TextResult {
  id: string
  prompt: string
  qtype: 'text'
  active: boolean
  surveyName: string
  respondentCount: number
  texts: Array<{ answer: string; name: string; createdAt: string }>
}
type QuestionResult = RatingResult | ChoiceResult | TextResult

// Picker selection: one survey, or a whole group rolled up.
type Selection = { kind: 'survey'; id: string } | { kind: 'group'; id: string }

const cardCls = 'rounded-lg border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm'
const inputCls =
  'rounded-lg border border-white/10 bg-slate-950/60 light:bg-white light:border-gray-300 px-3 py-2 text-sm text-white light:text-gray-900 focus:outline-none focus:border-indigo-500'

function MigrationMissingNotice() {
  return (
    <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 light:bg-amber-50 light:border-amber-200 px-5 py-5">
      <p className="text-sm font-semibold text-amber-200 light:text-amber-900 mb-1">Survey v2 tables not found</p>
      <p className="text-sm text-amber-100/90 light:text-amber-800">
        Run <code className="rounded bg-black/20 light:bg-amber-100 px-1.5 py-0.5">supabase/migrations/025_survey_v2.sql</code> in
        the Supabase SQL editor, then reload this page.
      </p>
    </div>
  )
}

export function AnalyticsClient() {
  const [surveys, setSurveys] = useState<SurveyOption[] | null>(null)
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [migrationMissing, setMigrationMissing] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [selection, setSelection] = useState<Selection | null>(null)

  useEffect(() => {
    fetch('/api/admin/surveys')
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setLoadError(data.error)
          return
        }
        if (data.migrationMissing) {
          setMigrationMissing(true)
          return
        }
        const list: SurveyOption[] = data.surveys ?? []
        setSurveys(list)
        setGroups(data.groups ?? [])
        // Default to the survey with the most respondents, else the first
        // active one, else just the first — whatever gets data on screen.
        const preferred =
          [...list].sort((a, b) => b.respondentCount - a.respondentCount)[0]?.respondentCount
            ? [...list].sort((a, b) => b.respondentCount - a.respondentCount)[0]
            : list.find(s => s.active) ?? list[0]
        if (preferred) setSelection({ kind: 'survey', id: preferred.id })
      })
      .catch(() => setLoadError('Failed to load surveys.'))
  }, [])

  if (migrationMissing) return <MigrationMissingNotice />
  if (loadError) return <p className="text-sm text-red-300 light:text-red-600">{loadError}</p>
  if (!surveys) return <p className="text-sm text-slate-400 light:text-gray-500">Loading…</p>
  if (surveys.length === 0) {
    return <p className="text-sm text-slate-500 light:text-gray-400 py-6 text-center">No surveys yet — create one on the Surveys page.</p>
  }

  const groupsWithSurveys = groups.filter(g => surveys.some(s => s.group_id === g.id))
  const selectionValue = selection ? `${selection.kind}:${selection.id}` : ''

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-xs font-medium text-slate-400 light:text-gray-500" htmlFor="survey-picker">
          Showing
        </label>
        <select
          id="survey-picker"
          className={inputCls}
          value={selectionValue}
          onChange={e => {
            const [kind, id] = e.target.value.split(':')
            setSelection({ kind: kind as Selection['kind'], id })
          }}
        >
          {groupsWithSurveys.length > 0 && (
            <optgroup label="Group rollups">
              {groupsWithSurveys.map(g => (
                <option key={g.id} value={`group:${g.id}`}>
                  {g.name} (all surveys)
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="Surveys">
            {surveys.map(s => (
              <option key={s.id} value={`survey:${s.id}`}>
                {s.name} — {PLACEMENT_LABELS[s.placement]}
                {s.active ? '' : ' (inactive)'}
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      {selection && <ResponsesView key={selectionValue} selection={selection} />}
    </div>
  )
}

// ── Responses for the current selection ──────────────────────────────────

function ResponsesView({ selection }: { selection: Selection }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [questions, setQuestions] = useState<QuestionResult[]>([])
  const [totalRespondents, setTotalRespondents] = useState(0)
  const [summarising, setSummarising] = useState(false)
  const [summary, setSummary] = useState('')
  const [summaryError, setSummaryError] = useState('')

  const isGroup = selection.kind === 'group'

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/surveys/responses?${selection.kind}=${selection.id}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        setError(data.error ?? 'Failed to load responses.')
        return
      }
      setQuestions(data.questions ?? [])
      setTotalRespondents(data.totalRespondents ?? 0)
    } catch {
      setError('Failed to load responses.')
    } finally {
      setLoading(false)
    }
  }, [selection.kind, selection.id])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  async function summarise() {
    setSummarising(true)
    setSummaryError('')
    setSummary('')
    try {
      const res = await fetch('/api/admin/surveys/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ survey_id: selection.id }),
      })
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
          <p className="text-xs text-slate-500 light:text-gray-400">
            {totalRespondents} total respondent{totalRespondents === 1 ? '' : 's'}
          </p>
        </div>
        {!isGroup && (
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
        )}
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
              {isGroup && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 light:bg-indigo-50 light:text-indigo-700">
                  {q.surveyName}
                </span>
              )}
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
