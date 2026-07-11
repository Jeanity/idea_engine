// Pure, no-I/O helpers behind the "At a glance" report metrics strip
// (report-client.tsx web + ReportDocument.tsx PDF): parsing the founder's
// stated capital band, summing the AI's estimated startup cost range, and
// deriving a banded (never fake-precise) budget-fit verdict from the two.

import { parseNumber } from '@/lib/cost-calculator'

/** high: null means open-ended (e.g. "$10,000+"). */
export interface CapitalRange { low: number; high: number | null }

/**
 * Parses a founder's stated startup-capital answer into a range.
 *
 * Most archetypes ask this as a select BAND ("Under $500", "$500–$2,000",
 * "$2,000–$10,000", "$10,000+" — see e.g. src/lib/questions/local_service.json);
 * only physical_product asks for a free number. Rules are tried in order:
 *   1. "under X"           → { low: 0, high: X }
 *   2. "X+"                → { low: X, high: null } (open-ended)
 *   3. "X <sep> Y"         → { low, high } (swapped if reversed) — sep is an
 *      en dash, em dash, or hyphen, tried as a candidate split point; a split
 *      only "wins" when BOTH sides parse as numbers, so a lone negative
 *      number like "-5" (empty left side) safely falls through to rule 4
 *      instead of being misread as a range.
 *   4. a single number      → { low: n, high: n }
 * Any piece that fails to parse (parseNumber returns null) makes the whole
 * result null — this feeds a founder-facing budget comparison, so a
 * half-parsed range would be misleading rather than merely incomplete.
 */
export function parseCapitalRange(answer: string | null | undefined): CapitalRange | null {
  if (!answer) return null
  const t = answer.trim()
  if (t === '') return null
  const lower = t.toLowerCase()

  if (lower.startsWith('under')) {
    const n = parseNumber(t.slice('under'.length).trim())
    return n === null ? null : { low: 0, high: n }
  }

  if (t.endsWith('+')) {
    const n = parseNumber(t.slice(0, -1).trim())
    return n === null ? null : { low: n, high: null }
  }

  const RANGE_SEPARATORS = /[–—-]/g
  let match: RegExpExecArray | null
  while ((match = RANGE_SEPARATORS.exec(t)) !== null) {
    const low = parseNumber(t.slice(0, match.index).trim())
    const high = parseNumber(t.slice(match.index + 1).trim())
    if (low !== null && high !== null) {
      return low <= high ? { low, high } : { low: high, high: low }
    }
  }

  const n = parseNumber(t)
  return n === null ? null : { low: n, high: n }
}

/**
 * Sums the AI-estimated startup_costs line items off a cost_breakdown object
 * (the loose `{ startup_costs: [{ estimate_low, estimate_high }] }` shape
 * generate-report.ts's financing-bridge step already reads — see
 * src/lib/inngest/generate-report.ts around the statedCapital/startupLow
 * calculation). Rows whose low/high aren't finite numbers are skipped; null
 * when there's no array, an empty one, or nothing valid inside it.
 */
export function sumStartupCosts(costBreakdown: unknown): { low: number; high: number } | null {
  if (!costBreakdown || typeof costBreakdown !== 'object') return null
  const rows = (costBreakdown as { startup_costs?: unknown }).startup_costs
  if (!Array.isArray(rows) || rows.length === 0) return null

  let low = 0
  let high = 0
  let validRows = 0
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const l = (row as { estimate_low?: unknown }).estimate_low
    const h = (row as { estimate_high?: unknown }).estimate_high
    if (typeof l !== 'number' || !Number.isFinite(l)) continue
    if (typeof h !== 'number' || !Number.isFinite(h)) continue
    low += l
    high += h
    validRows++
  }

  return validRows > 0 ? { low, high } : null
}

/**
 * Bands, never fake-precise: the founder's stated capital is itself a band
 * for most archetypes (see parseCapitalRange doc), so a single percentage
 * would imply more precision than the input supports.
 *   - covered:      capital fully covers even the high startup estimate.
 *   - lean_covered: capital covers at least the low estimate.
 *   - short:        capital's own high end (when bounded) can't reach the
 *                    low estimate — a real gap, not just uncertainty.
 *   - partial:      everything else — the band straddles the low estimate,
 *                    or an open-ended ("X+") band that starts below it.
 */
export type BudgetFitBand = 'covered' | 'lean_covered' | 'partial' | 'short'

export function deriveBudgetFit(capital: CapitalRange, startup: { low: number; high: number }): BudgetFitBand {
  if (capital.low >= startup.high) return 'covered'
  if (capital.low >= startup.low) return 'lean_covered'
  if (capital.high !== null && capital.high < startup.low) return 'short'
  return 'partial'
}
