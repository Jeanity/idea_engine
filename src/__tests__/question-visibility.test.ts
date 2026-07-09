import { describe, it, expect } from 'vitest'
import { isQuestionVisible } from '@/lib/question-visibility'
import type { Question } from '@/lib/validate-question'

const baseQ: Question = {
  key: 'dependent_q',
  text: 'A dependent question?',
  input_type: 'select',
  options: ['A', 'B'],
  required: true,
  maps_to: 'fallback.problem',
}

describe('isQuestionVisible', () => {
  it('is visible when the question has no show_if', () => {
    expect(isQuestionVisible(baseQ, new Map())).toBe(true)
    expect(isQuestionVisible(baseQ, [])).toBe(true)
  })

  it('is visible when the referenced answer matches one of the allowed values', () => {
    const q: Question = { ...baseQ, show_if: { key: 'delivery', in: ['live', 'mix'] } }
    expect(isQuestionVisible(q, new Map([['delivery', 'live']]))).toBe(true)
    expect(isQuestionVisible(q, [{ question_key: 'delivery', answer_text: 'mix' }])).toBe(true)
  })

  it('is hidden when the referenced question has not been answered yet', () => {
    const q: Question = { ...baseQ, show_if: { key: 'delivery', in: ['live', 'mix'] } }
    expect(isQuestionVisible(q, new Map())).toBe(false)
    expect(isQuestionVisible(q, [])).toBe(false)
  })

  it('is hidden when the referenced answer does not match any allowed value', () => {
    const q: Question = { ...baseQ, show_if: { key: 'delivery', in: ['live', 'mix'] } }
    expect(isQuestionVisible(q, new Map([['delivery', 'published']]))).toBe(false)
    expect(isQuestionVisible(q, [{ question_key: 'delivery', answer_text: 'published' }])).toBe(false)
  })
})
