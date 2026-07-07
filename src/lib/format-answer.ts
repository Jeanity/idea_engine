import { COUNTRIES } from '@/lib/countries'

// Shared with the review page and the report PDF appendix: turns a stored
// answer_text into display text — country code → country name, JSON array →
// comma-joined list, else the raw text.
export function formatAnswer(text: string, questionKey?: string): string {
  if (questionKey === 'founder_location_country') {
    const country = COUNTRIES.find(c => c.code === text.toUpperCase())
    if (country) return country.name
  }
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) return parsed.join(', ')
  } catch {
    // not JSON, return as-is
  }
  return text
}
