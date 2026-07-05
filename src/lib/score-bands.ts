// EDIT HERE to change score colors, thresholds, or labels — used by the
// landing-page score rings and (later) the report viewer.
// Rule: no red. Low scores mean "harder path", never "bad idea".
export interface ScoreBand { min: number; color: string; trackColor: string; label: string }

export const SCORE_BANDS: ScoreBand[] = [
  { min: 80, color: '#34d399', trackColor: 'rgba(52,211,153,0.15)', label: 'Strong' },            // emerald-400
  { min: 65, color: '#2dd4bf', trackColor: 'rgba(45,212,191,0.15)', label: 'Promising' },          // teal-400
  { min: 50, color: '#facc15', trackColor: 'rgba(250,204,21,0.15)', label: 'Workable' },           // yellow-400
  { min: 0, color: '#fb923c', trackColor: 'rgba(251,146,60,0.15)', label: 'Determined effort' },   // orange-400
]

export function bandFor(score: number): ScoreBand {
  return SCORE_BANDS.find((band) => score >= band.min) ?? SCORE_BANDS[SCORE_BANDS.length - 1]
}
