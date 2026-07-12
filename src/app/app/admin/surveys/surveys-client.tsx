'use client'

import { useState, useEffect, useCallback } from 'react'

type QType = 'text' | 'rating' | 'multiple_choice'
type Placement = 'full_report_end' | 'initial_report_end' | 'account' | 'post_purchase'
type Audience = 'all' | 'first_report' | 'first_purchase' | 'promo_users' | 'repeat_users'

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

interface Survey {
  id: string
  name: string
  group_id: string | null
  active: boolean
  placement: Placement
  audience: Audience
  sort_order: number
  created_at: string
  questions: Question[]
  respondentCount: number
  promo_gate: boolean
}

interface Group {
  id: string
  name: string
  created_at: string
}

interface SurveysState {
  migrationMissing: boolean
  groups: Group[]
  surveys: Survey[]
}

export const PLACEMENT_LABELS: Record<Placement, string> = {
  full_report_end: 'End of full report',
  initial_report_end: 'End of initial report',
  account: 'Account page',
  post_purchase: 'After purchase',
}

export const AUDIENCE_LABELS: Record<Audience, string> = {
  all: 'Everyone',
  first_report: 'First report just completed',
  first_purchase: 'First purchase just completed',
  promo_users: 'Promo users',
  repeat_users: 'Repeat users (2+ reports)',
}

const QTYPE_LABELS: Record<QType, string> = { text: 'Text', rating: 'Rating (1-5)', multiple_choice: 'Multiple choice' }

const inputCls =
  'w-full rounded-lg border border-white/10 bg-slate-950/60 light:bg-white light:border-gray-300 px-3 py-2 text-sm text-white light:text-gray-900 placeholder:text-slate-600 light:placeholder:text-gray-400 focus:outline-none focus:border-indigo-500'
const labelCls = 'block text-xs font-medium text-slate-400 light:text-gray-500 mb-1'
const cardCls = 'rounded-lg border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm'
const chipCls = 'text-xs px-2 py-0.5 rounded-full'

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

// ─────────────────────────────────────────────────────────────────────────

export function SurveysClient() {
  const [state, setState] = useState<SurveysState | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [surveyModal, setSurveyModal] = useState<{ mode: 'create' } | { mode: 'edit'; survey: Survey } | null>(null)
  const [groupModal, setGroupModal] = useState<{ mode: 'create' } | { mode: 'rename'; group: Group } | null>(null)

  const load = useCallback(async () => {
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

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  if (loading && !state) {
    return <p className="text-sm text-slate-400 light:text-gray-500">Loading…</p>
  }
  if (loadError) {
    return <p className="text-sm text-red-300 light:text-red-600">{loadError}</p>
  }
  if (!state) return null
  if (state.migrationMissing) return <MigrationMissingNotice />

  const ungrouped = state.surveys.filter(s => s.group_id === null)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-end gap-3 flex-wrap">
        <button
          onClick={() => setGroupModal({ mode: 'create' })}
          className="text-sm font-medium px-4 py-2 rounded-lg border border-white/10 text-slate-300 hover:border-white/20 hover:text-white light:border-gray-200 light:text-gray-600 light:hover:border-gray-300 light:hover:text-gray-900"
        >
          + New group
        </button>
        <button
          onClick={() => setSurveyModal({ mode: 'create' })}
          className="text-sm font-medium px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white"
        >
          + New survey
        </button>
      </div>

      {state.surveys.length === 0 && state.groups.length === 0 && (
        <p className="text-sm text-slate-500 light:text-gray-400 py-6 text-center">
          No surveys yet — create one to get started.
        </p>
      )}

      {state.groups.map(group => (
        <GroupSection
          key={group.id}
          group={group}
          surveys={state.surveys.filter(s => s.group_id === group.id)}
          onChanged={load}
          onEditSurvey={survey => setSurveyModal({ mode: 'edit', survey })}
          onRename={() => setGroupModal({ mode: 'rename', group })}
        />
      ))}

      {(ungrouped.length > 0 || state.groups.length > 0) && (
        <GroupSection
          group={null}
          surveys={ungrouped}
          onChanged={load}
          onEditSurvey={survey => setSurveyModal({ mode: 'edit', survey })}
        />
      )}

      {surveyModal && (
        <SurveyModal
          mode={surveyModal.mode}
          survey={surveyModal.mode === 'edit' ? surveyModal.survey : null}
          groups={state.groups}
          onClose={() => setSurveyModal(null)}
          onSaved={() => { setSurveyModal(null); load() }}
        />
      )}
      {groupModal && (
        <GroupModal
          group={groupModal.mode === 'rename' ? groupModal.group : null}
          onClose={() => setGroupModal(null)}
          onSaved={() => { setGroupModal(null); load() }}
        />
      )}
    </div>
  )
}

// ── Group section ────────────────────────────────────────────────────────

function GroupSection({
  group,
  surveys,
  onChanged,
  onEditSurvey,
  onRename,
}: {
  group: Group | null
  surveys: Survey[]
  onChanged: () => void
  onEditSurvey: (s: Survey) => void
  onRename?: () => void
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  async function confirmDelete() {
    setDeleting(true)
    setDeleteError('')
    try {
      const res = await fetch(`/api/admin/surveys/groups/${group!.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setDeleteError(data.error ?? 'Failed to delete group.')
        return
      }
      setConfirmingDelete(false)
      onChanged()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <h2 className="font-semibold text-white light:text-gray-900">{group ? group.name : 'Ungrouped'}</h2>
        <span className="text-xs text-slate-500 light:text-gray-400">
          {surveys.length} survey{surveys.length === 1 ? '' : 's'}
        </span>
        {group && (
          <span className="inline-flex items-center gap-2 ml-auto">
            <button
              onClick={onRename}
              className="text-xs font-medium px-2.5 py-1 rounded-lg border border-white/10 text-slate-300 hover:border-white/20 light:border-gray-200 light:text-gray-600 light:hover:border-gray-300"
            >
              Rename
            </button>
            {confirmingDelete ? (
              <>
                <span className="text-xs text-red-300 light:text-red-600">Delete group? Its surveys become ungrouped.</span>
                <button
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="text-xs font-medium px-2.5 py-1 rounded-lg bg-red-500/80 hover:bg-red-500 text-white disabled:opacity-50"
                >
                  {deleting ? 'Deleting…' : 'Yes, delete'}
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="text-xs text-slate-400 hover:text-white light:text-gray-500 light:hover:text-gray-900"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="text-xs font-medium px-2.5 py-1 rounded-lg border border-red-500/20 text-red-300/80 hover:border-red-500/40 hover:text-red-300 light:border-red-200 light:text-red-500 light:hover:border-red-300"
              >
                Delete
              </button>
            )}
          </span>
        )}
      </div>
      {deleteError && <p className="text-xs text-red-300 light:text-red-600 mb-2">{deleteError}</p>}

      {surveys.length === 0 ? (
        <p className="text-sm text-slate-500 light:text-gray-400 py-3">No surveys in this group.</p>
      ) : (
        <div className="space-y-3">
          {surveys.map(s => (
            <SurveyRow key={s.id} survey={s} onChanged={onChanged} onEdit={() => onEditSurvey(s)} />
          ))}
        </div>
      )}
    </section>
  )
}

// ── One survey ───────────────────────────────────────────────────────────

function SurveyRow({ survey, onChanged, onEdit }: { survey: Survey; onChanged: () => void; onEdit: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState('')

  const activeQuestions = survey.questions.filter(q => q.active).length

  async function toggleActive() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/surveys/${survey.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !survey.active }),
      })
      if (res.ok) onChanged()
      else {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Failed to update survey.')
      }
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/surveys/${survey.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Failed to delete survey.')
        return
      }
      setConfirmingDelete(false)
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`${cardCls} px-5 py-4`}>
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <span className="text-sm font-medium text-white light:text-gray-900">{survey.name}</span>
        <span className={`${chipCls} ${
          survey.active
            ? 'bg-emerald-500/10 text-emerald-300 light:bg-emerald-50 light:text-emerald-700'
            : 'bg-white/10 text-slate-400 light:bg-gray-100 light:text-gray-500'
        }`}>
          {survey.active ? 'Active' : 'Inactive'}
        </span>
        <span className={`${chipCls} bg-indigo-500/10 text-indigo-300 light:bg-indigo-50 light:text-indigo-700`}>
          {PLACEMENT_LABELS[survey.placement]}
        </span>
        <span className={`${chipCls} bg-violet-500/10 text-violet-300 light:bg-violet-50 light:text-violet-700`}>
          {AUDIENCE_LABELS[survey.audience]}
        </span>
        {survey.promo_gate && (
          <span className={`${chipCls} bg-amber-500/10 text-amber-300 light:bg-amber-50 light:text-amber-700 font-semibold`}>
            PROMO
          </span>
        )}
      </div>

      <p className="text-xs text-slate-500 light:text-gray-400">
        {survey.questions.length} question{survey.questions.length === 1 ? '' : 's'} ({activeQuestions} active) ·{' '}
        {survey.respondentCount} respondent{survey.respondentCount === 1 ? '' : 's'}
      </p>
      {survey.active && activeQuestions === 0 && (
        <p className="text-xs text-amber-300 light:text-amber-700 mt-1">
          Active but has no active questions — it won&apos;t be shown until questions are added.
        </p>
      )}
      {survey.placement === 'post_purchase' && (
        <p className="text-xs text-slate-500 light:text-gray-400 mt-1">
          After-purchase surveys start showing once payments launch.
        </p>
      )}

      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <button
          onClick={toggleActive}
          disabled={busy}
          className={`text-xs font-medium px-2.5 py-1 rounded-lg disabled:opacity-50 ${
            survey.active
              ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 light:bg-emerald-50 light:text-emerald-700'
              : 'bg-white/10 text-slate-300 hover:bg-white/15 light:bg-gray-100 light:text-gray-700'
          }`}
        >
          {survey.active ? 'On — click to turn off' : 'Off — click to turn on'}
        </button>
        <button
          onClick={onEdit}
          className="text-xs font-medium px-2.5 py-1 rounded-lg border border-white/10 text-slate-300 hover:border-white/20 light:border-gray-200 light:text-gray-600 light:hover:border-gray-300"
        >
          Edit
        </button>
        <button
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
          className="text-xs font-medium px-2.5 py-1 rounded-lg border border-white/10 text-slate-300 hover:border-white/20 light:border-gray-200 light:text-gray-600 light:hover:border-gray-300"
        >
          {expanded ? 'Hide questions' : 'Questions'}
        </button>

        {survey.respondentCount > 0 ? (
          <span className="text-xs text-slate-500 light:text-gray-400" title="Surveys with responses can only be deactivated — responses are never destroyed.">
            Has responses — deactivate instead of deleting
          </span>
        ) : confirmingDelete ? (
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="text-xs text-red-300 light:text-red-600">Delete this survey and its questions permanently?</span>
            <button
              onClick={confirmDelete}
              disabled={busy}
              className="text-xs font-medium px-2.5 py-1 rounded-lg bg-red-500/80 hover:bg-red-500 text-white disabled:opacity-50"
            >
              {busy ? 'Deleting…' : 'Yes, delete'}
            </button>
            <button onClick={() => setConfirmingDelete(false)} className="text-xs text-slate-400 hover:text-white light:text-gray-500 light:hover:text-gray-900">
              Cancel
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirmingDelete(true)}
            className="text-xs font-medium px-2.5 py-1 rounded-lg border border-red-500/20 text-red-300/80 hover:border-red-500/40 hover:text-red-300 light:border-red-200 light:text-red-500 light:hover:border-red-300"
          >
            Delete
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-300 light:text-red-600 mt-2">{error}</p>}

      {expanded && (
        <div className="mt-4 border-t border-white/10 light:border-gray-200 pt-4">
          <QuestionsManager surveyId={survey.id} questions={survey.questions} onChanged={onChanged} />
        </div>
      )}
    </div>
  )
}

// ── Question manager (scoped to one survey) ─────────────────────────────

function QuestionsManager({ surveyId, questions, onChanged }: { surveyId: string; questions: Question[]; onChanged: () => void }) {
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
      const res = await fetch(`/api/admin/surveys/${surveyId}/questions`, {
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
      const res = await fetch(`/api/admin/surveys/${surveyId}/questions/${q.id}`, {
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
        fetch(`/api/admin/surveys/${surveyId}/questions/${q.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort_order: other.sort_order }),
        }),
        fetch(`/api/admin/surveys/${surveyId}/questions/${other.id}`, {
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
      const res = await fetch(`/api/admin/surveys/${surveyId}/questions/${q.id}`, {
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
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white light:text-gray-900">Questions</h3>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white"
          >
            + Add question
          </button>
        )}
      </div>

      {adding && (
        <div className="rounded-lg border border-white/10 light:border-gray-200 px-4 py-4 mb-3">
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
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create question'}
            </button>
            <button onClick={() => { setAdding(false); setCreateError('') }} disabled={creating} className="text-xs text-slate-400 hover:text-white light:text-gray-500 light:hover:text-gray-900">
              Cancel
            </button>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="text-sm text-slate-500 light:text-gray-400 py-3 text-center">No questions yet.</p>
      ) : (
        <div className="space-y-2">
          {sorted.map((q, i) => (
            <div key={q.id} className="rounded-lg bg-white/5 light:bg-gray-50 px-4 py-3">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-sm font-medium text-white light:text-gray-900">{q.prompt}</span>
                <span className={`${chipCls} bg-indigo-500/10 text-indigo-300 light:bg-indigo-50 light:text-indigo-700`}>
                  {QTYPE_LABELS[q.qtype]}
                </span>
                <span className={`${chipCls} ${
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

              <div className="flex items-center gap-3 mt-2 flex-wrap">
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

// ── Create / edit survey modal ───────────────────────────────────────────

function SurveyModal({
  mode,
  survey,
  groups,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit'
  survey: Survey | null
  groups: Group[]
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(survey?.name ?? '')
  const [groupId, setGroupId] = useState<string>(survey?.group_id ?? '')
  const [placement, setPlacement] = useState<Placement>(survey?.placement ?? 'full_report_end')
  const [audience, setAudience] = useState<Audience>(survey?.audience ?? 'all')
  const [promoGate, setPromoGate] = useState(survey?.promo_gate ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Name is required.')
      return
    }
    setSaving(true)
    setError('')
    const payload = { name: trimmed, group_id: groupId || null, placement, audience, promo_gate: promoGate }
    try {
      const res = mode === 'edit'
        ? await fetch(`/api/admin/surveys/${survey!.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/admin/surveys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Failed to save survey.')
        setSaving(false)
        return
      }
      onSaved()
    } catch {
      setError('Failed to save survey.')
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm px-4 py-8 sm:py-12"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-slate-950 light:bg-white light:border-gray-200 shadow-2xl px-6 py-6"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white light:text-gray-500 light:hover:bg-gray-100 light:hover:text-gray-900"
        >
          ×
        </button>

        <h2 className="text-sm font-semibold text-white light:text-gray-900 mb-1">
          {mode === 'edit' ? 'Edit survey' : 'New survey'}
        </h2>
        <p className="text-xs text-slate-400 light:text-gray-500 mb-4">
          {mode === 'edit'
            ? 'Changes apply immediately — including to a live survey.'
            : 'New surveys start switched off — add questions, then turn them on.'}
        </p>

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className={labelCls}>Name</label>
            <input className={inputCls} value={name} onChange={e => setName(e.target.value)} maxLength={120} autoFocus />
          </div>
          <div>
            <label className={labelCls}>Group</label>
            <select className={inputCls} value={groupId} onChange={e => setGroupId(e.target.value)}>
              <option value="">No group</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Where it shows (placement)</label>
            <select className={inputCls} value={placement} onChange={e => setPlacement(e.target.value as Placement)}>
              {(Object.keys(PLACEMENT_LABELS) as Placement[]).map(p => (
                <option key={p} value={p}>{PLACEMENT_LABELS[p]}</option>
              ))}
            </select>
            {placement === 'post_purchase' && (
              <p className="text-xs text-slate-500 light:text-gray-400 mt-1">
                Shows after checkout — available once payments launch.
              </p>
            )}
          </div>
          <div>
            <label className={labelCls}>Who sees it (audience)</label>
            <select className={inputCls} value={audience} onChange={e => setAudience(e.target.value as Audience)}>
              {(Object.keys(AUDIENCE_LABELS) as Audience[]).map(a => (
                <option key={a} value={a}>{AUDIENCE_LABELS[a]}</option>
              ))}
            </select>
            {(audience === 'first_purchase') && (
              <p className="text-xs text-slate-500 light:text-gray-400 mt-1">
                Purchase-based audiences match nobody until payments launch.
              </p>
            )}
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm text-slate-300 light:text-gray-700 cursor-pointer">
              <input type="checkbox" checked={promoGate} onChange={e => setPromoGate(e.target.checked)} />
              Promo overlay survey
            </label>
            <p className="text-xs text-slate-500 light:text-gray-400 mt-1">
              Reserved for promo overlays — never shown in normal placements; select it on the Promo card in Settings.
            </p>
          </div>

          {error && <p className="text-sm text-red-300 light:text-red-600">{error}</p>}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="text-sm font-medium px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Create survey'}
            </button>
            <button type="button" onClick={onClose} disabled={saving} className="text-sm text-slate-400 hover:text-white light:text-gray-500 light:hover:text-gray-900">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Create / rename group modal ──────────────────────────────────────────

function GroupModal({ group, onClose, onSaved }: { group: Group | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(group?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Name is required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = group
        ? await fetch(`/api/admin/surveys/groups/${group.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: trimmed }),
          })
        : await fetch('/api/admin/surveys/groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: trimmed }),
          })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Failed to save group.')
        setSaving(false)
        return
      }
      onSaved()
    } catch {
      setError('Failed to save group.')
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm px-4 py-8 sm:py-12"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-slate-950 light:bg-white light:border-gray-200 shadow-2xl px-6 py-6"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white light:text-gray-500 light:hover:bg-gray-100 light:hover:text-gray-900"
        >
          ×
        </button>

        <h2 className="text-sm font-semibold text-white light:text-gray-900 mb-1">
          {group ? 'Rename group' : 'New group'}
        </h2>
        <p className="text-xs text-slate-400 light:text-gray-500 mb-4">
          Groups organise related surveys — e.g. all your launch-trial surveys in one place.
        </p>

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className={labelCls}>Name</label>
            <input className={inputCls} value={name} onChange={e => setName(e.target.value)} maxLength={120} autoFocus />
          </div>

          {error && <p className="text-sm text-red-300 light:text-red-600">{error}</p>}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="text-sm font-medium px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : group ? 'Save' : 'Create group'}
            </button>
            <button type="button" onClick={onClose} disabled={saving} className="text-sm text-slate-400 hover:text-white light:text-gray-500 light:hover:text-gray-900">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
