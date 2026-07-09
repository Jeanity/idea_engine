// Minimal shape needed to evaluate visibility — callers may pass richer
// question objects (e.g. the full validate-question `Question` type, or a
// component-local variant) as long as they satisfy this.
export interface VisibilityCheckable {
  show_if?: { key: string; in: string[] }
}

// Minimal shape needed to evaluate visibility — callers may pass richer
// answer records (e.g. from Supabase rows) as long as they satisfy this.
export interface AnswerLike {
  question_key: string
  answer_text: string
}

// Accepts either the wizard's live Map<key, answerText> or an array of
// stored answer rows (as returned by the DB / questions API).
export type AnswersLookup = Map<string, string> | AnswerLike[]

function lookupAnswer(answers: AnswersLookup, key: string): string | undefined {
  if (answers instanceof Map) return answers.get(key)
  return answers.find(a => a.question_key === key)?.answer_text
}

// A question with no show_if is always visible. A question with show_if is
// only visible once the referenced question has been answered AND that
// answer is one of the allowed values — an unanswered (or mismatched)
// dependency hides the question rather than showing it.
export function isQuestionVisible(question: VisibilityCheckable, answers: AnswersLookup): boolean {
  if (!question.show_if) return true
  const answer = lookupAnswer(answers, question.show_if.key)
  if (answer === undefined) return false
  return question.show_if.in.includes(answer)
}
