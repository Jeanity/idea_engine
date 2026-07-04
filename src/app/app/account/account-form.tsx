'use client'

import { useState } from 'react'

const COUNTRIES = [
  { code: 'AU', name: 'Australia' },
  { code: 'CA', name: 'Canada' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IN', name: 'India' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'SG', name: 'Singapore' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: '', name: '─────────────' },
  { code: 'AR', name: 'Argentina' },
  { code: 'BR', name: 'Brazil' },
  { code: 'CN', name: 'China' },
  { code: 'DE', name: 'Germany' },
  { code: 'EG', name: 'Egypt' },
  { code: 'ES', name: 'Spain' },
  { code: 'FR', name: 'France' },
  { code: 'GH', name: 'Ghana' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'IT', name: 'Italy' },
  { code: 'JP', name: 'Japan' },
  { code: 'KE', name: 'Kenya' },
  { code: 'KR', name: 'South Korea' },
  { code: 'MX', name: 'Mexico' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NO', name: 'Norway' },
  { code: 'NP', name: 'Nepal' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'RU', name: 'Russia' },
  { code: 'SE', name: 'Sweden' },
  { code: 'TH', name: 'Thailand' },
  { code: 'TR', name: 'Turkey' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'UG', name: 'Uganda' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'ZW', name: 'Zimbabwe' },
]

interface Profile {
  username: string | null
  display_name: string | null
  default_country: string | null
  default_region: string | null
  marketing_opt_in: boolean
}

interface Props {
  email: string
  profile: Profile
}

export default function AccountForm({ email, profile }: Props) {
  const [username, setUsername] = useState(profile.username ?? '')
  const [displayName, setDisplayName] = useState(profile.display_name ?? '')
  const [country, setCountry] = useState(profile.default_country ?? '')
  const [region, setRegion] = useState(profile.default_region ?? '')
  const [marketingOptIn, setMarketingOptIn] = useState(profile.marketing_opt_in)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)

    if (!username.trim()) {
      setError('Username is required')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim() || null,
          display_name: displayName.trim() || null,
          default_country: country || null,
          default_region: region.trim() || null,
          marketing_opt_in: marketingOptIn,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to save')
      } else {
        setSaved(true)
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Email — read only */}
      <div>
        <label className={labelClass}>Email</label>
        <input
          type="email"
          value={email}
          disabled
          className={`${inputClass} bg-gray-50 text-gray-400 cursor-not-allowed`}
        />
        <p className="text-xs text-gray-400 mt-1">
          Email is managed via magic link — contact support to change it.
        </p>
      </div>

      {/* Username */}
      <div>
        <label className={labelClass}>
          Username <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">@</span>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="yourname"
            maxLength={30}
            className={`${inputClass} pl-7`}
            required
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">3–30 characters. Letters, numbers, and underscores only.</p>
      </div>

      {/* Display name */}
      <div>
        <label className={labelClass}>Full name <span className="text-gray-400 font-normal">(optional)</span></label>
        <input
          type="text"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          placeholder="Your name"
          maxLength={100}
          className={inputClass}
        />
      </div>

      {/* Country + region side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Country <span className="text-gray-400 font-normal">(optional)</span></label>
          <select
            value={country}
            onChange={e => setCountry(e.target.value)}
            className={inputClass}
          >
            <option value="">Select country</option>
            {COUNTRIES.map(c => (
              <option key={`${c.code}-${c.name}`} value={c.code} disabled={!c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>City / region <span className="text-gray-400 font-normal">(optional)</span></label>
          <input
            type="text"
            value={region}
            onChange={e => setRegion(e.target.value)}
            placeholder="e.g. Brisbane"
            maxLength={100}
            className={inputClass}
          />
        </div>
      </div>

      {/* Marketing opt-in */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={marketingOptIn}
          onChange={e => setMarketingOptIn(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <div>
          <p className="text-sm text-gray-700">Keep me updated with tips and new features</p>
          <p className="text-xs text-gray-400">You&apos;ll always receive transactional emails (report ready, receipts).</p>
        </div>
      </label>

      {/* Feedback */}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">Profile saved.</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  )
}
