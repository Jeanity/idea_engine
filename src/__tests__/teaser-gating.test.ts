import { describe, it, expect } from 'vitest'
import { gatePreviewSections, type GatedViabilitySnapshot } from '@/lib/teaser-gating'

const scores = {
  market_opportunity: { score: 4, rationale: 'Strong demand signals in the niche.' },
  execution_difficulty: { score: 2, rationale: 'Straightforward to set up.' },
  capital_required: { score: 1, rationale: 'Minimal upfront spend.' },
  time_to_revenue: { score: 2, rationale: 'Could take first orders within weeks.' },
}

const preview = {
  summary: { text: 'A mobile coffee van serving commuter rail stations.' },
  viability_snapshot: { scores, overall_verdict: 'Promising with caveats.' },
  next_steps: [
    { action: 'Scout station foot traffic at 7am', timeframe: 'This week' },
    { action: 'Price a second-hand van', timeframe: 'This month' },
    { action: 'Apply for the mobile vendor permit', timeframe: 'This month' },
  ],
}

describe('gatePreviewSections', () => {
  it('keeps the summary untouched', () => {
    const gated = gatePreviewSections(preview)
    expect(gated.summary).toEqual(preview.summary)
  })

  it('replaces sub-scores and rationales with headline + verdict + dimension keys', () => {
    const gated = gatePreviewSections(preview)
    const vs = gated.viability_snapshot as GatedViabilitySnapshot
    expect(vs.overall_verdict).toBe('Promising with caveats.')
    expect(typeof vs.headline_score).toBe('number')
    expect(vs.locked_dimensions).toEqual(Object.keys(scores))
    // The redaction is real — no score values or rationale text survive.
    const json = JSON.stringify(vs)
    expect(json).not.toContain('rationale')
    expect(json).not.toContain('Strong demand')
    expect(json).not.toContain('"score"')
  })

  it('cuts next steps to one and counts the hidden ones', () => {
    const gated = gatePreviewSections(preview)
    expect(gated.next_steps).toEqual([preview.next_steps[0]])
    expect(gated.locked_next_steps).toBe(2)
  })

  it('does not mutate the input', () => {
    const before = JSON.parse(JSON.stringify(preview))
    gatePreviewSections(preview)
    expect(preview).toEqual(before)
  })

  it('passes an unavailable viability_snapshot marker through untouched', () => {
    const p = { ...preview, viability_snapshot: { status: 'unavailable', reason: 'step failed' } }
    const gated = gatePreviewSections(p)
    expect(gated.viability_snapshot).toEqual(p.viability_snapshot)
  })

  it('handles a missing snapshot and empty steps without inventing keys', () => {
    const gated = gatePreviewSections({ summary: { text: 'hi' } })
    expect(gated).toEqual({ summary: { text: 'hi' } })
  })

  it('a single next step yields zero locked count', () => {
    const gated = gatePreviewSections({ next_steps: [preview.next_steps[0]] })
    expect(gated.next_steps).toHaveLength(1)
    expect(gated.locked_next_steps).toBe(0)
  })
})
