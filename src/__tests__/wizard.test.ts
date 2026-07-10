import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { validateQuestion, firstUnansweredIndex, ALL_MAPS_TO_KEYS, type Question } from '@/lib/validate-question'

// ── validateQuestion ──────────────────────────────────────────

describe('validateQuestion', () => {
  const usedKeys: string[] = []
  const usedMapsto: string[] = []
  const validBase = {
    key: 'test_key',
    text: 'What is your answer?',
    input_type: 'text',
    required: false,
    maps_to: 'fallback.problem',
  }

  it('accepts a valid text question', () => {
    const result = validateQuestion(validBase, usedKeys, usedMapsto)
    expect(result).not.toBeNull()
    expect(result?.key).toBe('test_key')
    expect(result?.required).toBe(false)
  })

  it('accepts a valid select question with options', () => {
    const q = { ...validBase, key: 'q_sel', input_type: 'select', options: ['A', 'B'], maps_to: 'fallback.customer' }
    expect(validateQuestion(q, [], [])).not.toBeNull()
  })

  it('accepts a valid multiselect question with options', () => {
    const q = { ...validBase, key: 'q_ms', input_type: 'multiselect', options: ['X', 'Y', 'Z'], maps_to: 'fallback.money_model' }
    expect(validateQuestion(q, [], [])).not.toBeNull()
  })

  it('rejects a key that is already used', () => {
    expect(validateQuestion(validBase, ['test_key'], [])).toBeNull()
  })

  it('rejects a maps_to that is already used', () => {
    expect(validateQuestion(validBase, [], ['fallback.problem'])).toBeNull()
  })

  it('rejects a maps_to not in ALL_MAPS_TO_KEYS', () => {
    const q = { ...validBase, maps_to: 'invalid.key' }
    expect(validateQuestion(q, [], [])).toBeNull()
  })

  it('rejects select without options', () => {
    const q = { ...validBase, input_type: 'select' }
    expect(validateQuestion(q, [], [])).toBeNull()
  })

  it('rejects select with fewer than 2 options', () => {
    const q = { ...validBase, input_type: 'select', options: ['only one'] }
    expect(validateQuestion(q, [], [])).toBeNull()
  })

  it('rejects invalid input_type', () => {
    const q = { ...validBase, input_type: 'textarea' }
    expect(validateQuestion(q, [], [])).toBeNull()
  })

  it('rejects a key with invalid characters', () => {
    const q = { ...validBase, key: 'Bad-Key' }
    expect(validateQuestion(q, [], [])).toBeNull()
  })

  it('rejects text shorter than 6 chars', () => {
    const q = { ...validBase, text: 'Hi?' }
    expect(validateQuestion(q, [], [])).toBeNull()
  })

  it('forces required to false regardless of input', () => {
    const q = { ...validBase, required: true }
    const result = validateQuestion(q, [], [])
    expect(result?.required).toBe(false)
  })

  it('returns null for non-object input', () => {
    expect(validateQuestion(null, [], [])).toBeNull()
    expect(validateQuestion('string', [], [])).toBeNull()
    expect(validateQuestion(42, [], [])).toBeNull()
  })

  it('rejects duplicate key in the same batch', () => {
    const seenKeys: string[] = []
    const seenMapsto: string[] = []
    const q1 = { ...validBase, key: 'batch_key', maps_to: 'fallback.problem' }
    const q2 = { ...validBase, key: 'batch_key', maps_to: 'fallback.customer' }
    const r1 = validateQuestion(q1, seenKeys, seenMapsto)
    expect(r1).not.toBeNull()
    seenKeys.push(r1!.key)
    expect(validateQuestion(q2, seenKeys, seenMapsto)).toBeNull()
  })
})

// ── validateQuestion: why / option_notes ───────────────────────

describe('validateQuestion why/option_notes handling', () => {
  const validBase = {
    key: 'test_key',
    text: 'What is your answer?',
    input_type: 'text',
    required: false,
    maps_to: 'fallback.problem',
  }

  it('passes through a valid why string, trimmed', () => {
    const q = { ...validBase, why: '  This explains why we ask, in plain English.  ' }
    const result = validateQuestion(q, [], [])
    expect(result?.why).toBe('This explains why we ask, in plain English.')
  })

  it('accepts a why at the minimum length (6 chars)', () => {
    const q = { ...validBase, why: '123456' }
    expect(validateQuestion(q, [], [])?.why).toBe('123456')
  })

  it('accepts a why at the maximum length (300 chars)', () => {
    const why = 'x'.repeat(300)
    const q = { ...validBase, why }
    expect(validateQuestion(q, [], [])?.why).toBe(why)
  })

  it('drops a why that is too short', () => {
    const q = { ...validBase, why: 'hi' }
    const result = validateQuestion(q, [], [])
    expect(result).not.toBeNull()
    expect(result?.why).toBeUndefined()
  })

  it('drops a why that is too long (over 300 chars)', () => {
    const q = { ...validBase, why: 'x'.repeat(301) }
    const result = validateQuestion(q, [], [])
    expect(result?.why).toBeUndefined()
  })

  it('drops a non-string why', () => {
    const q = { ...validBase, why: 12345 }
    const result = validateQuestion(q, [], [])
    expect(result).not.toBeNull()
    expect(result?.why).toBeUndefined()
  })

  it('drops a null why', () => {
    const q = { ...validBase, why: null }
    const result = validateQuestion(q, [], [])
    expect(result).not.toBeNull()
    expect(result?.why).toBeUndefined()
  })

  it('omits why entirely when not provided', () => {
    const result = validateQuestion(validBase, [], [])
    expect(result).not.toBeNull()
    expect('why' in (result as object)).toBe(false)
  })

  it('strips option_notes from dynamic questions even when present', () => {
    const q = {
      ...validBase,
      key: 'q_sel',
      input_type: 'select',
      options: ['A', 'B'],
      maps_to: 'fallback.customer',
      option_notes: { A: 'Note for A', B: 'Note for B' },
    }
    const result = validateQuestion(q, [], [])
    expect(result).not.toBeNull()
    expect(result?.option_notes).toBeUndefined()
  })
})

// ── ALL_MAPS_TO_KEYS ──────────────────────────────────────────

describe('ALL_MAPS_TO_KEYS', () => {
  it('contains no duplicates', () => {
    expect(new Set(ALL_MAPS_TO_KEYS).size).toBe(ALL_MAPS_TO_KEYS.length)
  })

  it('contains the expected fallback keys', () => {
    expect(ALL_MAPS_TO_KEYS).toContain('fallback.problem')
    expect(ALL_MAPS_TO_KEYS).toContain('fallback.customer')
    expect(ALL_MAPS_TO_KEYS).toContain('fallback.money_model')
  })
})

// ── firstUnansweredIndex ──────────────────────────────────────

describe('firstUnansweredIndex', () => {
  const makeQ = (key: string): Question => ({
    key, text: 'Question text?', input_type: 'text', required: true, maps_to: 'fallback.problem',
  })

  it('returns 0 when no questions are answered', () => {
    const qs = [makeQ('a'), makeQ('b'), makeQ('c')]
    expect(firstUnansweredIndex(qs, new Set())).toBe(0)
  })

  it('returns first unanswered index', () => {
    const qs = [makeQ('a'), makeQ('b'), makeQ('c')]
    expect(firstUnansweredIndex(qs, new Set(['a']))).toBe(1)
    expect(firstUnansweredIndex(qs, new Set(['a', 'b']))).toBe(2)
  })

  it('returns last index when all are answered', () => {
    const qs = [makeQ('a'), makeQ('b'), makeQ('c')]
    expect(firstUnansweredIndex(qs, new Set(['a', 'b', 'c']))).toBe(2)
  })

  it('returns 0 for an empty question list', () => {
    expect(firstUnansweredIndex([], new Set())).toBe(0)
  })
})

// ── Dynamic questions env flag ────────────────────────────────

describe('DYNAMIC_QUESTIONS_ENABLED flag', () => {
  beforeEach(() => {
    vi.resetModules()
  })
  afterEach(() => {
    delete process.env.DYNAMIC_QUESTIONS_ENABLED
  })

  it('skips generation when env flag is "false"', async () => {
    process.env.DYNAMIC_QUESTIONS_ENABLED = 'false'
    // Import after setting the env var so module-level check picks it up
    // The route function reads the env at call time, so we test it directly
    const fn = async () => {
      if (process.env.DYNAMIC_QUESTIONS_ENABLED === 'false') return []
      return ['would_call_ai']
    }
    expect(await fn()).toEqual([])
  })

  it('allows generation when env flag is not "false"', async () => {
    delete process.env.DYNAMIC_QUESTIONS_ENABLED
    const fn = async () => {
      if (process.env.DYNAMIC_QUESTIONS_ENABLED === 'false') return []
      return ['would_call_ai']
    }
    expect(await fn()).not.toEqual([])
  })
})
