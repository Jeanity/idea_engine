import { describe, it, expect } from 'vitest'
import { validateSurveySubmission, validateQuestionFields, type SurveyQuestionForValidation } from '@/lib/survey'

const textQ: SurveyQuestionForValidation = { id: 'q1', qtype: 'text', options: null }
const ratingQ: SurveyQuestionForValidation = { id: 'q2', qtype: 'rating', options: null }
const choiceQ: SurveyQuestionForValidation = { id: 'q3', qtype: 'multiple_choice', options: ['Great', 'Good', 'Bad'] }

describe('validateSurveySubmission', () => {
  it('rejects an empty answers array', () => {
    const r = validateSurveySubmission([textQ], [])
    expect(r.valid).toBe(false)
  })

  it('rejects when there are no active questions to answer', () => {
    const r = validateSurveySubmission([], [{ question_id: 'q1', answer: 'hi' }])
    expect(r.valid).toBe(false)
  })

  it('accepts a fully-answered text-only submission and trims whitespace', () => {
    const r = validateSurveySubmission([textQ], [{ question_id: 'q1', answer: '  Loved it  ' }])
    expect(r).toEqual({ valid: true, answers: [{ question_id: 'q1', answer: 'Loved it' }] })
  })

  it('rejects a missing answer for an active question', () => {
    const r = validateSurveySubmission([textQ, ratingQ], [{ question_id: 'q1', answer: 'hi' }])
    expect(r.valid).toBe(false)
  })

  it('rejects a duplicate answer for the same question', () => {
    const r = validateSurveySubmission([textQ], [
      { question_id: 'q1', answer: 'a' },
      { question_id: 'q1', answer: 'b' },
    ])
    expect(r.valid).toBe(false)
  })

  it('rejects an answer for an unknown/inactive question id', () => {
    const r = validateSurveySubmission([textQ], [{ question_id: 'not-a-question', answer: 'hi' }])
    expect(r.valid).toBe(false)
  })

  it('rejects a blank answer', () => {
    const r = validateSurveySubmission([textQ], [{ question_id: 'q1', answer: '   ' }])
    expect(r.valid).toBe(false)
  })

  it('rejects an answer over the max length', () => {
    const r = validateSurveySubmission([textQ], [{ question_id: 'q1', answer: 'x'.repeat(2001) }])
    expect(r.valid).toBe(false)
  })

  it('accepts a max-length answer exactly', () => {
    const r = validateSurveySubmission([textQ], [{ question_id: 'q1', answer: 'x'.repeat(2000) }])
    expect(r.valid).toBe(true)
  })

  describe('rating questions', () => {
    it('accepts an integer 1-5', () => {
      const r = validateSurveySubmission([ratingQ], [{ question_id: 'q2', answer: '4' }])
      expect(r).toEqual({ valid: true, answers: [{ question_id: 'q2', answer: '4' }] })
    })

    it('rejects 0', () => {
      const r = validateSurveySubmission([ratingQ], [{ question_id: 'q2', answer: '0' }])
      expect(r.valid).toBe(false)
    })

    it('rejects 6', () => {
      const r = validateSurveySubmission([ratingQ], [{ question_id: 'q2', answer: '6' }])
      expect(r.valid).toBe(false)
    })

    it('rejects a non-numeric value', () => {
      const r = validateSurveySubmission([ratingQ], [{ question_id: 'q2', answer: 'five' }])
      expect(r.valid).toBe(false)
    })

    it('rejects a decimal', () => {
      const r = validateSurveySubmission([ratingQ], [{ question_id: 'q2', answer: '3.5' }])
      expect(r.valid).toBe(false)
    })
  })

  describe('multiple_choice questions', () => {
    it('accepts an answer that matches an offered option', () => {
      const r = validateSurveySubmission([choiceQ], [{ question_id: 'q3', answer: 'Good' }])
      expect(r).toEqual({ valid: true, answers: [{ question_id: 'q3', answer: 'Good' }] })
    })

    it('rejects an answer not in the options list', () => {
      const r = validateSurveySubmission([choiceQ], [{ question_id: 'q3', answer: 'Excellent' }])
      expect(r.valid).toBe(false)
    })
  })

  it('validates a mixed multi-question submission end to end', () => {
    const r = validateSurveySubmission([textQ, ratingQ, choiceQ], [
      { question_id: 'q1', answer: 'Nice' },
      { question_id: 'q2', answer: '5' },
      { question_id: 'q3', answer: 'Great' },
    ])
    expect(r.valid).toBe(true)
  })
})

describe('validateQuestionFields', () => {
  it('accepts a valid text question', () => {
    const r = validateQuestionFields({ prompt: 'How was it?', qtype: 'text' })
    expect(r).toEqual({ prompt: 'How was it?', qtype: 'text', options: null })
  })

  it('rejects an empty prompt', () => {
    const r = validateQuestionFields({ prompt: '  ', qtype: 'text' })
    expect('error' in r).toBe(true)
  })

  it('rejects an invalid qtype', () => {
    const r = validateQuestionFields({ prompt: 'Hi', qtype: 'essay' })
    expect('error' in r).toBe(true)
  })

  it('requires at least 2 options for multiple_choice', () => {
    const r = validateQuestionFields({ prompt: 'Pick one', qtype: 'multiple_choice', options: ['Only one'] })
    expect('error' in r).toBe(true)
  })

  it('accepts multiple_choice with 2+ trimmed, non-empty options', () => {
    const r = validateQuestionFields({ prompt: 'Pick one', qtype: 'multiple_choice', options: [' A ', 'B', '', '  '] })
    expect(r).toEqual({ prompt: 'Pick one', qtype: 'multiple_choice', options: ['A', 'B'] })
  })
})
