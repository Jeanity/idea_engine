import { describe, it, expect } from 'vitest'
import { evaluateGenerationLimit, MAX_NEW_IDEAS_PER_HOUR, REGEN_COOLDOWN_MS } from '@/lib/generation-limit'

const MIN = 60_000
const now = Date.UTC(2026, 6, 10, 12, 0, 0)

const baseFresh = {
  isBypass: false,
  isFreshGeneration: true,
  newIdeaCount: 0,
  isForcedRegeneration: false,
  isStaleRescue: false,
  generationStartedAt: null,
  now,
}

const baseRegen = {
  isBypass: false,
  isFreshGeneration: false,
  newIdeaCount: 0,
  isForcedRegeneration: true,
  isStaleRescue: false,
  generationStartedAt: null,
  now,
}

describe('evaluateGenerationLimit', () => {
  it('allows a fresh generation under the new-idea cap', () => {
    const r = evaluateGenerationLimit({ ...baseFresh, newIdeaCount: MAX_NEW_IDEAS_PER_HOUR - 1 })
    expect(r.allowed).toBe(true)
  })

  it('blocks a fresh generation once the new-idea cap is reached', () => {
    const r = evaluateGenerationLimit({ ...baseFresh, newIdeaCount: MAX_NEW_IDEAS_PER_HOUR })
    expect(r.allowed).toBe(false)
    expect(r.reason).toBe('new_idea_cap')
  })

  it('blocks past the new-idea cap too', () => {
    const r = evaluateGenerationLimit({ ...baseFresh, newIdeaCount: MAX_NEW_IDEAS_PER_HOUR + 3 })
    expect(r.allowed).toBe(false)
    expect(r.reason).toBe('new_idea_cap')
  })

  it('does NOT apply the new-idea cap to a forced regeneration', () => {
    // isFreshGeneration is false for a regen even if newIdeaCount happens to
    // be at/over the cap — the cap only ever gates fresh generations.
    const r = evaluateGenerationLimit({
      ...baseRegen,
      newIdeaCount: MAX_NEW_IDEAS_PER_HOUR + 10,
      generationStartedAt: new Date(now - REGEN_COOLDOWN_MS - MIN),
    })
    expect(r.allowed).toBe(true)
  })

  it('blocks a forced regeneration started within the cooldown', () => {
    const r = evaluateGenerationLimit({
      ...baseRegen,
      generationStartedAt: new Date(now - 5 * MIN),
    })
    expect(r.allowed).toBe(false)
    expect(r.reason).toBe('regen_cooldown')
  })

  it('allows a forced regeneration once the cooldown has elapsed', () => {
    const r = evaluateGenerationLimit({
      ...baseRegen,
      generationStartedAt: new Date(now - REGEN_COOLDOWN_MS - MIN),
    })
    expect(r.allowed).toBe(true)
  })

  it('allows a stale-rescue regeneration even if generation_started_at is recent', () => {
    const r = evaluateGenerationLimit({
      ...baseRegen,
      isStaleRescue: true,
      generationStartedAt: new Date(now - 5 * MIN),
    })
    expect(r.allowed).toBe(true)
  })

  it('allows a forced regeneration with no generation_started_at (never started)', () => {
    const r = evaluateGenerationLimit({ ...baseRegen, generationStartedAt: null })
    expect(r.allowed).toBe(true)
  })

  it('allows a plain "return existing report" request (neither fresh nor forced)', () => {
    const r = evaluateGenerationLimit({
      isBypass: false,
      isFreshGeneration: false,
      newIdeaCount: MAX_NEW_IDEAS_PER_HOUR + 10,
      isForcedRegeneration: false,
      isStaleRescue: false,
      generationStartedAt: new Date(now - MIN),
      now,
    })
    expect(r.allowed).toBe(true)
  })

  it('bypass overrides the new-idea cap', () => {
    const r = evaluateGenerationLimit({ ...baseFresh, isBypass: true, newIdeaCount: MAX_NEW_IDEAS_PER_HOUR + 10 })
    expect(r.allowed).toBe(true)
  })

  it('bypass overrides the regeneration cooldown', () => {
    const r = evaluateGenerationLimit({
      ...baseRegen,
      isBypass: true,
      generationStartedAt: new Date(now - MIN),
    })
    expect(r.allowed).toBe(true)
  })
})
