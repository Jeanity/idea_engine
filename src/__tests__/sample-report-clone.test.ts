import { describe, it, expect } from 'vitest'
import { sanitizeSectionsForSample } from '@/lib/sample-report-clone'

describe('sanitizeSectionsForSample', () => {
  it('strips _meta and keeps everything else', () => {
    const sections = {
      summary: { text: 'hello' },
      competitors: [{ name: 'Acme' }],
      _meta: { partial: true, section_status: { competitors: 'fallback_inferred' }, model_version: 'x', cost_usd: 0.42 },
    }
    const result = sanitizeSectionsForSample(sections) as Record<string, unknown>
    expect(result._meta).toBeUndefined()
    expect(result.summary).toEqual({ text: 'hello' })
    expect(result.competitors).toEqual([{ name: 'Acme' }])
  })

  it('is a no-op when there is no _meta key', () => {
    const sections = { summary: { text: 'hi' } }
    const result = sanitizeSectionsForSample(sections) as Record<string, unknown>
    expect(result).toEqual({ summary: { text: 'hi' } })
  })

  it('returns a detached copy, not a reference to the input', () => {
    const sections = { summary: { text: 'hi' } }
    const result = sanitizeSectionsForSample(sections) as Record<string, unknown>
    ;(result.summary as { text: string }).text = 'changed'
    expect(sections.summary.text).toBe('hi')
  })
})
