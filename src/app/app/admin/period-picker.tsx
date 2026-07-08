'use client'

import { useState } from 'react'

export type PeriodPreset = 'today' | 'yesterday' | '7d' | '30d' | 'wtd' | 'mtd' | 'ytd' | 'custom'

export interface PeriodRange {
  preset: PeriodPreset
  /** yyyy-mm-dd, local time, inclusive */
  from: string
  /** yyyy-mm-dd, local time, inclusive */
  to: string
}

function toLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d)
  const dow = copy.getDay()
  const diff = dow === 0 ? 6 : dow - 1
  copy.setDate(copy.getDate() - diff)
  return copy
}

export function rangeForPreset(preset: Exclude<PeriodPreset, 'custom'>): PeriodRange {
  const now = new Date()
  const today = toLocalDate(now)

  if (preset === 'today') return { preset, from: today, to: today }

  if (preset === 'yesterday') {
    const y = new Date(now)
    y.setDate(y.getDate() - 1)
    const yd = toLocalDate(y)
    return { preset, from: yd, to: yd }
  }

  if (preset === 'wtd') {
    return { preset, from: toLocalDate(startOfWeek(now)), to: today }
  }

  if (preset === 'mtd') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    return { preset, from: toLocalDate(monthStart), to: today }
  }

  if (preset === 'ytd') {
    const yearStart = new Date(now.getFullYear(), 0, 1)
    return { preset, from: toLocalDate(yearStart), to: today }
  }

  // 7d / 30d
  const days = preset === '7d' ? 6 : 29
  const from = new Date(now)
  from.setDate(from.getDate() - days)
  return { preset, from: toLocalDate(from), to: today }
}

export const DEFAULT_PERIOD: PeriodRange = rangeForPreset('today')

const PRESETS: { key: Exclude<PeriodPreset, 'custom'>; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: 'wtd', label: 'WTD' },
  { key: 'mtd', label: 'MTD' },
  { key: 'ytd', label: 'YTD' },
]

const pillClass = (active: boolean) =>
  `text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
    active
      ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30 light:bg-indigo-100 light:text-indigo-700 light:border-indigo-200'
      : 'bg-white/5 text-slate-400 border-white/10 hover:text-white light:bg-gray-50 light:text-gray-500 light:border-gray-200 light:hover:text-gray-900'
  }`

/**
 * Period picker with preset ranges and custom date inputs. All dates are in
 * the browser's local timezone so "Today" matches the user's actual day.
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
  const todayStr = toLocalDate(new Date())

  return (
    <div className="flex flex-wrap items-center gap-1.5">
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
