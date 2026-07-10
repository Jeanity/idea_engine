import { describe, it, expect } from 'vitest'
import { filterVisibleAnswers } from '@/lib/question-bank'
import type { Question } from '@/lib/validate-question'

const deliveryQ: Question = {
  key: 'delivery',
  text: 'How will you deliver it?',
  input_type: 'select',
  options: ['live', 'published', 'mix'],
  required: true,
  maps_to: 'idea.sales_channel',
}

// Branch question only visible when `delivery` is 'live' or 'mix'.
const venueQ: Question = {
  key: 'venue',
  text: 'Where do you deliver live sessions?',
  input_type: 'text',
  required: true,
  maps_to: 'market.service_area_scope',
  show_if: { key: 'delivery', in: ['live', 'mix'] },
}

const bank: Question[] = [deliveryQ, venueQ]

describe('filterVisibleAnswers', () => {
  it('keeps rows whose question_key is not in the bank (route-injected / dynamic questions)', () => {
    const answers = [
      { question_key: 'founder_location_country', answer_text: 'AU' },
      { question_key: 'success_definition', answer_text: 'A steady part-time income' },
    ]
    expect(filterVisibleAnswers(bank, answers)).toEqual(answers)
  })

  it('drops a stale answer whose show_if no longer matches the current answer set', () => {
    // Founder originally answered 'live' (making `venue` visible and
    // answered), then changed `delivery` to 'published' — the old `venue`
    // row is now stale and must be dropped.
    const answers = [
      { question_key: 'delivery', answer_text: 'published' },
      { question_key: 'venue', answer_text: 'Downtown market stall' },
    ]
    const result = filterVisibleAnswers(bank, answers)
    expect(result).toEqual([{ question_key: 'delivery', answer_text: 'published' }])
  })

  it('keeps the branch answer when show_if still matches', () => {
    const answers = [
      { question_key: 'delivery', answer_text: 'live' },
      { question_key: 'venue', answer_text: 'Downtown market stall' },
    ]
    expect(filterVisibleAnswers(bank, answers)).toEqual(answers)
  })

  it('drops a branch answer when its controlling question was never answered', () => {
    const answers = [{ question_key: 'venue', answer_text: 'Downtown market stall' }]
    expect(filterVisibleAnswers(bank, answers)).toEqual([])
  })

  it('preserves extra fields on kept rows (e.g. question_text, position)', () => {
    const answers = [
      { question_key: 'delivery', answer_text: 'live', question_text: 'How will you deliver it?', position: 1 },
    ]
    expect(filterVisibleAnswers(bank, answers)).toEqual(answers)
  })

  it('documents single-pass (non-chained) semantics: visibility is evaluated against the answers as stored, not re-resolved iteratively', () => {
    // A chain: `delivery` controls `venue`, and (hypothetically) `venue`
    // controls a third question `venue_detail`. filterVisibleAnswers makes
    // one pass evaluating each row against the full, unfiltered answer set —
    // it does not remove `venue` first and then re-check `venue_detail`
    // against the now-smaller set. Here `venue_detail` is visible because
    // `venue`'s row is still present in the answers array passed in, even
    // though that same row is independently dropped by the `delivery` check.
    const venueDetailQ: Question = {
      key: 'venue_detail',
      text: 'Any more detail on the venue?',
      input_type: 'text',
      required: false,
      maps_to: 'market.differentiator',
      show_if: { key: 'venue', in: ['Downtown market stall'] },
    }
    const chainedBank: Question[] = [deliveryQ, venueQ, venueDetailQ]
    const answers = [
      // `delivery` no longer matches venue's show_if — venue is stale.
      { question_key: 'delivery', answer_text: 'published' },
      { question_key: 'venue', answer_text: 'Downtown market stall' },
      { question_key: 'venue_detail', answer_text: 'Near the fountain' },
    ]
    const result = filterVisibleAnswers(chainedBank, answers)
    // venue is dropped (delivery no longer allows it), but venue_detail is
    // NOT transitively dropped — its own show_if (on `venue`) still matches
    // because `venue`'s row is present in the answer set being evaluated.
    expect(result).toEqual([
      { question_key: 'delivery', answer_text: 'published' },
      { question_key: 'venue_detail', answer_text: 'Near the fountain' },
    ])
  })
})
