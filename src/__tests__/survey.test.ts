import { describe, it, expect } from 'vitest'
import {
  validateSurveySubmission,
  validateQuestionFields,
  audienceMatches,
  pickEligibleSurvey,
  type SurveyQuestionForValidation,
  type AudienceSignals,
  type EligibleSurveyRow,
} from '@/lib/survey'

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

describe('audienceMatches', () => {
  const signals = (over: Partial<AudienceSignals> = {}): AudienceSignals => ({
    completedReports: 0,
    promoReports: 0,
    completedPurchases: 0,
    ...over,
  })

  it("'all' matches everyone, even with zero activity", () => {
    expect(audienceMatches('all', signals())).toBe(true)
  })

  it("'first_report' matches exactly one completed report", () => {
    expect(audienceMatches('first_report', signals({ completedReports: 1 }))).toBe(true)
    expect(audienceMatches('first_report', signals({ completedReports: 0 }))).toBe(false)
    expect(audienceMatches('first_report', signals({ completedReports: 2 }))).toBe(false)
  })

  it("'repeat_users' matches two or more completed reports", () => {
    expect(audienceMatches('repeat_users', signals({ completedReports: 2 }))).toBe(true)
    expect(audienceMatches('repeat_users', signals({ completedReports: 5 }))).toBe(true)
    expect(audienceMatches('repeat_users', signals({ completedReports: 1 }))).toBe(false)
  })

  it("'promo_users' matches any promo report", () => {
    expect(audienceMatches('promo_users', signals({ promoReports: 1 }))).toBe(true)
    expect(audienceMatches('promo_users', signals())).toBe(false)
  })

  it("'first_purchase' matches exactly one completed purchase", () => {
    expect(audienceMatches('first_purchase', signals({ completedPurchases: 1 }))).toBe(true)
    expect(audienceMatches('first_purchase', signals())).toBe(false)
    expect(audienceMatches('first_purchase', signals({ completedPurchases: 2 }))).toBe(false)
  })
})

describe('pickEligibleSurvey', () => {
  const s = (id: string, over: Partial<EligibleSurveyRow> = {}): EligibleSurveyRow => ({
    id,
    audience: 'all',
    sort_order: 0,
    created_at: '2026-07-10T00:00:00Z',
    ...over,
  })
  const none = new Set<string>()
  const noSignals: AudienceSignals = { completedReports: 0, promoReports: 0, completedPurchases: 0 }

  it('returns null when there are no surveys', () => {
    expect(pickEligibleSurvey([], none, noSignals)).toBeNull()
  })

  it('orders by sort_order, then created_at', () => {
    const later = s('later', { sort_order: 1 })
    const earlier = s('earlier', { sort_order: 0, created_at: '2026-07-09T00:00:00Z' })
    const earliest = s('earliest', { sort_order: 0, created_at: '2026-07-08T00:00:00Z' })
    expect(pickEligibleSurvey([later, earlier, earliest], none, noSignals)?.id).toBe('earliest')
  })

  it('skips surveys the user already answered', () => {
    const first = s('first', { sort_order: 0 })
    const second = s('second', { sort_order: 1 })
    expect(pickEligibleSurvey([first, second], new Set(['first']), noSignals)?.id).toBe('second')
  })

  it('skips surveys whose audience does not match', () => {
    const targeted = s('targeted', { sort_order: 0, audience: 'repeat_users' })
    const open = s('open', { sort_order: 1 })
    expect(pickEligibleSurvey([targeted, open], none, noSignals)?.id).toBe('open')
    expect(
      pickEligibleSurvey([targeted, open], none, { ...noSignals, completedReports: 2 })?.id
    ).toBe('targeted')
  })

  it('returns null when every survey is answered or mismatched', () => {
    const answered = s('answered')
    const targeted = s('targeted', { audience: 'first_purchase' })
    expect(pickEligibleSurvey([answered, targeted], new Set(['answered']), noSignals)).toBeNull()
  })
})
