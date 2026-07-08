'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface ModelOption {
  id: string
  label: string
  inPerM: number
  outPerM: number
  note: string
}

export function ReportModelPicker({ current, options }: { current: string | null; options: ModelOption[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(current)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const dirty = selected !== current
  const selectedOption = selected ? options.find(o => o.id === selected) : null

  async function save() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch('/api/profile/report-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_model: selected }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error ?? 'Failed to save')
        return
      }
      setSaved(true)
      router.refresh()
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="space-y-2">
        {/* Default option */}
        <label className={`flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
          selected === null
            ? 'border-indigo-400/50 bg-indigo-500/10 light:border-indigo-300 light:bg-indigo-50'
            : 'border-white/10 bg-white/5 hover:border-white/20 light:border-gray-200 light:bg-white light:hover:border-gray-300'
        }`}>
          <input
            type="radio"
            name="report-model"
            checked={selected === null}
            onChange={() => setSelected(null)}
            className="mt-1"
          />
          <span className="min-w-0">
            <span className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-white light:text-gray-900">App default</span>
              <span className="text-xs text-slate-500 light:text-gray-400">follows whatever the pipeline ships with (currently Sonnet 5)</span>
            </span>
          </span>
        </label>

        {options.map(opt => (
          <label
            key={opt.id}
            className={`flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
              selected === opt.id
                ? 'border-indigo-400/50 bg-indigo-500/10 light:border-indigo-300 light:bg-indigo-50'
                : 'border-white/10 bg-white/5 hover:border-white/20 light:border-gray-200 light:bg-white light:hover:border-gray-300'
            }`}
          >
            <input
              type="radio"
              name="report-model"
              checked={selected === opt.id}
              onChange={() => setSelected(opt.id)}
              className="mt-1"
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-sm font-medium text-white light:text-gray-900">{opt.label}</span>
                <span className="text-xs tabular-nums text-slate-400 light:text-gray-500">
                  ${opt.inPerM}/M in · ${opt.outPerM}/M out
                </span>
              </span>
              <span className="block text-xs text-slate-500 light:text-gray-400 mt-0.5">{opt.note}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="rounded-lg bg-indigo-500 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-400 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && !dirty && <span className="text-xs text-emerald-300 light:text-emerald-600">Saved — next full report uses {selectedOption?.label ?? 'the app default'}.</span>}
        {error && <span className="text-xs text-red-300 light:text-red-600">{error}</span>}
      </div>
    </div>
  )
}
