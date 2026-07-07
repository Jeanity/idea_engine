'use client'

import { useState } from 'react'

export type PeriodPreset = 'today' | '7d' | '30d' | 'custom'

export interface PeriodRange {
  preset: PeriodPreset
  /** yyyy-mm-dd, UTC, inclusive */
  from: string
  /** yyyy-mm-dd, UTC, inclusive */
  to: string
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// Ranges are computed in UTC (see Block 8 note: pick UTC, label it, so
// dashboard/graph date buckets stay consistent with each other).
export function rangeForPreset(preset: Exclude<PeriodPreset, 'custom'>): PeriodRange {
  const today = toISODate(new Date())
  if (preset === 'today') return { preset, from: today, to: today }

  const days = preset === '7d' ? 6 : 29
  const from = new Date()
  from.setUTCDate(from.getUTCDate() - days)
  return { preset, from: toISODate(from), to: today }
}

export const DEFAULT_PERIOD: PeriodRange = rangeForPreset('today')

const PRESETS: { key: Exclude<PeriodPreset, 'custom'>; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
]

const pillClass = (active: boolean) =>
  `text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
    active
      ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30 light:bg-indigo-100 light:text-indigo-700 light:border-indigo-200'
      : 'bg-white/5 text-slate-400 border-white/10 hover:text-white light:bg-gray-50 light:text-gray-500 light:border-gray-200 light:hover:text-gray-900'
  }`

/**
 * Today / 7d / 30d / Custom (from–to) period picker. Controlled component —
 * the caller owns the selected range and re-fetches whatever it drives
 * on change. Reused by Blocks 7/8 (sales, growth graphs) alongside this
 * dashboard, so it stays free of any dashboard-specific data fetching.
 */
export function PeriodPicker({
  value,
  onChange,
}: {
  value: PeriodRange
  onChange: (range: PeriodRange) => void
}) {
  const [customFrom, setCustomFrom] = useState(value.preset === 'custom' ? value.from : value.to)
  const [customTo, setCustomTo] = useState(value.preset === 'custom' ? value.to : value.to)
  const todayStr = toISODate(new Date())

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(rangeForPreset(key))}
          className={pillClass(value.preset === key)}
        >
          {label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange({ preset: 'custom', from: customFrom, to: customTo })}
        className={pillClass(value.preset === 'custom')}
      >
        Custom
      </button>

      {value.preset === 'custom' && (
        <div className="flex items-center gap-2 ml-1">
          <input
            type="date"
            value={customFrom}
            max={customTo}
            onChange={e => {
              const from = e.target.value
              setCustomFrom(from)
              if (from) onChange({ preset: 'custom', from, to: customTo })
            }}
            className="text-xs rounded-lg border border-white/10 bg-slate-900/80 text-slate-200 px-2 py-1.5
                       light:bg-white light:border-gray-200 light:text-gray-800"
          />
          <span className="text-xs text-slate-500 light:text-gray-400">to</span>
          <input
            type="date"
            value={customTo}
            min={customFrom}
            max={todayStr}
            onChange={e => {
              const to = e.target.value
              setCustomTo(to)
              if (to) onChange({ preset: 'custom', from: customFrom, to })
            }}
            className="text-xs rounded-lg border border-white/10 bg-slate-900/80 text-slate-200 px-2 py-1.5
                       light:bg-white light:border-gray-200 light:text-gray-800"
          />
        </div>
      )}
    </div>
  )
}
