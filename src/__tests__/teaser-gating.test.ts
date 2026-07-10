import { describe, it, expect } from 'vitest'
import { gatePreviewSections, type GatedViabilitySnapshot, type GatedCostPreview } from '@/lib/teaser-gating'

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
  section_hooks: {
    competitors: 'The full report maps every van and kiosk within 500m of your top three stations.',
    cost: 'Your setup costs hinge on whether you buy or lease the van — the full report prices both paths.',
    pricing: 'Commuter coffee pricing runs tighter than café pricing — the full report benchmarks your corridor.',
    legal_compliance: 'Mobile vendor permits vary by station operator — the full report lists exactly which ones apply.',
    marketing: 'Commuter routines make morning visibility the highest-leverage channel — the full report plans it.',
  },
  cost_preview: {
    rows: [
      { label: 'Second-hand van', amount: 'A$8,000–12,000' },
      { label: 'Vendor permit', amount: 'A$450' },
      { label: 'First stock order', amount: 'A$600' },
    ],
  },
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

  it('passes section_hooks through untouched — they are meant to show', () => {
    const gated = gatePreviewSections(preview)
    expect(gated.section_hooks).toEqual(preview.section_hooks)
  })

  it('cost_preview: strips labels entirely, keeps only real amounts + a row count', () => {
    const gated = gatePreviewSections(preview)
    const cp = gated.cost_preview as GatedCostPreview
    expect(cp.rows).toEqual([
      { amount: 'A$8,000–12,000' },
      { amount: 'A$450' },
      { amount: 'A$600' },
    ])
    expect(cp.row_count).toBe(3)
    // The redaction is real — no label text survives anywhere in the output.
    const json = JSON.stringify(gated)
    expect(json).not.toContain('Second-hand van')
    expect(json).not.toContain('Vendor permit')
    expect(json).not.toContain('First stock order')
    expect(json).not.toContain('"label"')
    // Amounts are the whole point of the morsel — they must survive.
    expect(json).toContain('A$8,000')
    expect(json).toContain('A$450')
    expect(json).toContain('A$600')
  })

  it('normalises legacy next_steps_preview to next_steps and never echoes the raw legacy key', () => {
    const legacy = {
      summary: preview.summary,
      next_steps_preview: preview.next_steps,
    }
    const gated = gatePreviewSections(legacy)
    expect(gated.next_steps).toEqual([preview.next_steps[0]])
    expect(gated.locked_next_steps).toBe(2)
    expect(gated.next_steps_preview).toBeUndefined()
  })
})
