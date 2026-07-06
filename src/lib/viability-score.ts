// Derives a single 0–100 "headline" score from the 4-dimension viability
// scores (each 1–5) the synthesis/teaser prompts produce. This is a simple
// interim formula — see docs/plan HANDOFF backlog item "headline-score
// derivation for real reports" for the planned proper tuning pass once real
// report data volume exists to calibrate against.
//
// market_opportunity is "higher is better" as-is; the other three are
// "difficulty" scores (1=easy/cheap/fast, 5=hard/expensive/slow), so they're
// inverted before averaging.
export interface ViabilityScores {
  market_opportunity?: { score: number }
  execution_difficulty?: { score: number }
  capital_required?: { score: number }
  time_to_revenue?: { score: number }
}

// Report data is parsed from AI JSON at runtime — callers often only have a
// loosely-typed Record<string, {score, rationale}>, not the named-key shape
// above. Accept that too, and fall back to a neutral 3 for any dimension
// that's missing rather than throwing (mirrors the ScoreBar guards, which
// just skip rendering a missing dimension).
type LooseScores = Record<string, { score: number } | undefined>

export function deriveHeadlineScore(scores: ViabilityScores | LooseScores): number {
  const invert = (n: number) => 6 - n
  const get = (key: keyof ViabilityScores) => (scores as LooseScores)[key]?.score ?? 3
  const values = [
    get('market_opportunity'),
    invert(get('execution_difficulty')),
    invert(get('capital_required')),
    invert(get('time_to_revenue')),
  ]
  const avg = values.reduce((a, b) => a + b, 0) / values.length // 1–5
  return Math.round(((avg - 1) / 4) * 100)
}
