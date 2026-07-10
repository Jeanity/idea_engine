import { isQuestionVisible, type AnswerLike } from '@/lib/question-visibility'
import type { Question } from '@/lib/validate-question'

// Loads the static question bank for an archetype — the raw
// `@/lib/questions/${archetype}.json` only. This does NOT include the
// route-injected questions (success_definition / founder_location_country /
// founder_location_region — see src/app/api/ideas/[id]/questions/route.ts),
// which are added at request time and never part of the static JSON banks.
// Mirrors the internal loadBank previously duplicated in generate-report.ts
// and generate-teaser.ts.
export function loadQuestionBank(archetype: string): Question[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(`@/lib/questions/${archetype}.json`) as Question[]
  } catch {
    return []
  }
}

// Drops stale hidden-branch answers before they reach report generation, the
// teaser, the PDF answers appendix, or the summary page. If a founder answers
// a branch question and LATER changes the controlling answer, the old row
// stays in the `answers` table — this filters it back out.
//
// A row is dropped only when its question_key exists in `bank` AND
// isQuestionVisible(...) says it's no longer visible under the CURRENT full
// answer set. Visibility is evaluated in a single pass against the
// (unfiltered) `answers` array passed in — same semantics as the
// required-key check in src/app/api/ideas/[id]/complete/route.ts. This means
// a chain (A hides/shows B, B's answer hides/shows C) is resolved against the
// answers as currently stored, not iteratively re-evaluated — if that ever
// needs multi-pass resolution, revisit this comment.
//
// Rows whose key is NOT in the bank — route-injected country/region/success
// questions, or AI-generated dynamic questions — are always kept, since
// visibility isn't defined for them here.
export function filterVisibleAnswers<T extends AnswerLike>(bank: Question[], answers: T[]): T[] {
  return answers.filter(a => {
    const bankQ = bank.find(q => q.key === a.question_key)
    if (!bankQ) return true
    return isQuestionVisible(bankQ, answers)
  })
}
