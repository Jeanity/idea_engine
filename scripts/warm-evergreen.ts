/**
 * Evergreen baseline cache warmer — pre-populates and refreshes the
 * `evergreen_baselines` table (supabase/migrations/030_evergreen_baselines.sql)
 * so the report pipeline's compliance cache is warm before real users arrive.
 * See docs/plan/2026-07-14-evergreen-baselines-and-bug-flagged-reports.md
 * (Workstream A) for the design, and the `evergreen-compliance-baseline`
 * aiStep in src/lib/inngest/generate-report.ts for the exact call this script
 * mirrors — same prompt, same call params, so entries this script writes are
 * indistinguishable from ones a real report generated.
 *
 * Usage:
 *   npx tsx scripts/warm-evergreen.ts --countries AU,US,GB [options]
 *
 * Flags:
 *   --countries AU,US,GB   REQUIRED. Comma-separated ISO-ish country codes
 *                          (upper-cased). No default — the operator chooses
 *                          the spend.
 *   --archetypes a,b,c     Comma-separated archetypes. Default: all archetypes,
 *                          derived from src/lib/questions/*.json filenames.
 *   --refresh-days N       Regenerate cached entries expiring within N days.
 *                          Default: 30.
 *   --force                Regenerate every requested pair regardless of
 *                          freshness.
 *   --dry-run              Print the work plan (generate/skip per pair, with
 *                          reasons, and estimated cost at $0.18/entry) and
 *                          exit. No AI calls, no DB writes.
 *   --max-spend N          Abort BEFORE starting the run (no AI calls, no
 *                          writes) if the planned generation count x $0.18
 *                          would exceed N. Optional — no cap by default.
 *
 * Examples:
 *   npx tsx scripts/warm-evergreen.ts --countries AU --dry-run
 *   npx tsx scripts/warm-evergreen.ts --countries AU,US,GB,CA,NZ --refresh-days 45
 *
 * Requires ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY, and
 * NEXT_PUBLIC_SUPABASE_URL in .env.local (same as scripts/capture-fixtures.ts)
 * and migration 030 already applied — this script fails fast with a clear
 * message if either is missing.
 *
 * Sequential execution by design (no parallel fan-out) — ~40 calls is fine
 * sequentially and kind to Anthropic rate limits. A failed pair logs the
 * error and moves on to the next; the run only exits non-zero if EVERY
 * attempted generation failed.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient, type SupabaseClient, type PostgrestError } from '@supabase/supabase-js'
import { readdirSync } from 'fs'
import { join } from 'path'
import type { Database } from '../src/lib/database.types'
import { callAI, DEFAULT_MODEL, type AIResult } from '../src/lib/ai'
import {
  COMPLIANCE_BASELINE_SYSTEM_PROMPT,
  buildComplianceBaselineMessage,
} from '../src/lib/prompts/compliance-baseline'
import {
  storeEvergreenBaseline,
  isMissingEvergreenTable,
  isEvergreenExpired,
} from '../src/lib/evergreen'
import type { ComplianceItem } from '../src/lib/compliance-baseline'

// Flat per-entry cost estimate used ONLY for the --dry-run / --max-spend
// projection printed before any real call is made. Real stored costs always
// come from the actual callAI result (r.costUsd), never this constant.
const ESTIMATED_COST_PER_ENTRY = 0.18

// ---- Tolerant JSON-array extraction — mirrors extractJson/parseJsonArray in
// src/lib/inngest/generate-report.ts exactly. Those are module-private there
// (and that file also registers an Inngest function on import), so the small
// parsing helpers are duplicated here rather than importing the whole module.
function extractJson(text: string): unknown {
  const arrayMatch = text.match(/\[[\s\S]*\]/)
  const objectMatch = text.match(/\{[\s\S]*\}/)
  const match = arrayMatch && objectMatch
    ? (text.indexOf('[') < text.indexOf('{') ? arrayMatch : objectMatch)
    : arrayMatch ?? objectMatch
  if (!match) throw new Error(`No JSON found in response: ${text.slice(0, 120)}`)
  return JSON.parse(match[0])
}

function parseJsonArray(r: AIResult): unknown[] {
  const parsed = extractJson(r.text)
  if (!Array.isArray(parsed)) throw new Error('Response not a JSON array')
  return parsed
}

// ---- CLI args ----
function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const eq = a.indexOf('=')
    if (eq !== -1) {
      args[a.slice(2, eq)] = a.slice(eq + 1)
      continue
    }
    const key = a.slice(2)
    const next = argv[i + 1]
    if (next !== undefined && !next.startsWith('--')) {
      args[key] = next
      i++
    } else {
      args[key] = true
    }
  }
  return args
}

function usage(): void {
  console.error('Usage: npx tsx scripts/warm-evergreen.ts --countries AU,US,GB [--archetypes a,b] [--refresh-days N] [--force] [--dry-run] [--max-spend N]')
  console.error('  --countries is REQUIRED — no default, the operator chooses the spend.')
}

// Default archetype list — derived from the question bank filenames so it
// never drifts from the real archetype set (src/lib/questions/*.json:
// content_education, ecommerce_brand, invention, local_service, marketplace,
// other, physical_product, software_app).
function defaultArchetypes(): string[] {
  const dir = join(process.cwd(), 'src/lib/questions')
  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace(/\.json$/, ''))
    .sort()
}

class MissingTableError extends Error {}

interface PlanItem {
  countryCode: string
  archetype: string
  action: 'generate' | 'skip'
  reason: string
}

/**
 * Builds the generate/skip plan for every (country, archetype) pair. One
 * lookup per pair against the (country_code, region='', archetype, section)
 * unique key — same key the report pipeline reads/writes.
 */
async function buildPlan(
  supabase: SupabaseClient<Database>,
  countries: string[],
  archetypes: string[],
  refreshDays: number,
  force: boolean
): Promise<PlanItem[]> {
  const plan: PlanItem[] = []
  for (const countryCode of countries) {
    for (const archetype of archetypes) {
      if (force) {
        plan.push({ countryCode, archetype, action: 'generate', reason: 'forced regeneration (--force)' })
        continue
      }

      const { data, error } = await supabase
        .from('evergreen_baselines')
        .select('expires_at')
        .eq('country_code', countryCode)
        .eq('region', '')
        .eq('archetype', archetype)
        .eq('section', 'compliance')
        .maybeSingle()

      if (error) {
        if (isMissingEvergreenTable(error as PostgrestError)) throw new MissingTableError()
        // Any other lookup failure (bad credentials, network) will fail for
        // every pair identically — abort the whole plan rather than spam 40
        // identical warnings and silently over-generate.
        throw new Error(`evergreen_baselines lookup failed for ${countryCode}/${archetype}: ${error.message}`)
      }

      if (!data) {
        plan.push({ countryCode, archetype, action: 'generate', reason: 'no cached baseline yet' })
        continue
      }

      if (isEvergreenExpired(data.expires_at)) {
        plan.push({ countryCode, archetype, action: 'generate', reason: `expired ${new Date(data.expires_at).toLocaleDateString()}` })
        continue
      }

      const refreshThresholdMs = Date.now() + refreshDays * 24 * 60 * 60 * 1000
      if (new Date(data.expires_at).getTime() < refreshThresholdMs) {
        plan.push({ countryCode, archetype, action: 'generate', reason: `expires within ${refreshDays}d (${new Date(data.expires_at).toLocaleDateString()})` })
        continue
      }

      plan.push({ countryCode, archetype, action: 'skip', reason: `fresh until ${new Date(data.expires_at).toLocaleDateString()}` })
    }
  }
  return plan
}

/**
 * Drops malformed elements — same tolerance the report pipeline's
 * mergeComplianceItems (src/lib/evergreen.ts) applies to overlay items,
 * since parseJsonArray only guarantees array-ness, not per-item shape.
 */
function validateItems(raw: unknown[]): ComplianceItem[] {
  const valid: ComplianceItem[] = []
  for (const el of raw) {
    if (el === null || typeof el !== 'object') continue
    const candidate = el as Record<string, unknown>
    if (
      typeof candidate.item === 'string' && candidate.item.trim() !== '' &&
      typeof candidate.summary === 'string' && candidate.summary.trim() !== ''
    ) {
      valid.push(candidate as unknown as ComplianceItem)
    }
  }
  return valid
}

interface GenerateResult {
  status: 'generated' | 'failed'
  itemCount: number
  costUsd: number
  error?: string
}

/**
 * Exact same generation path as the report pipeline's
 * evergreen-compliance-baseline aiStep (src/lib/inngest/generate-report.ts):
 * same system prompt, same message builder (country only — no region, no
 * idea fields), same tools/maxTokens/model. provider is EXPLICITLY
 * 'anthropic' — never inherited from AI_PROVIDER — so an operator with
 * AI_PROVIDER=mock in their .env.local can never write fixture data into the
 * shared cache table.
 */
async function generateOne(
  supabase: SupabaseClient<Database>,
  countryCode: string,
  archetype: string
): Promise<GenerateResult> {
  try {
    const r = await callAI({
      messages: [{
        role: 'user',
        content: buildComplianceBaselineMessage({ archetype, location_country: countryCode }),
      }],
      system: COMPLIANCE_BASELINE_SYSTEM_PROMPT,
      maxTokens: 6144,
      tag: 'script:warm-evergreen',
      tools: [{ type: 'web_search_20250305' as const, name: 'web_search' as const, max_uses: 4 }],
      model: DEFAULT_MODEL,
      provider: 'anthropic',
    })

    const rawItems = parseJsonArray(r)
    const validItems = validateItems(rawItems)

    if (validItems.length < 3) {
      console.warn(`[${countryCode}/${archetype}] FAILED — only ${validItems.length} valid item(s) after parsing (need >= 3, got ${rawItems.length} raw). Skipping store.`)
      return { status: 'failed', itemCount: validItems.length, costUsd: r.costUsd, error: `only ${validItems.length} valid items` }
    }

    const stored = await storeEvergreenBaseline(supabase, {
      countryCode,
      archetype,
      section: 'compliance',
      items: validItems,
      model: r.model,
      costUsd: r.costUsd,
      sourceReportId: null,
    })
    if (!stored) {
      // The call was billed but the row never landed — report the pair as
      // failed so the operator knows it still needs a (re-)run.
      console.warn(`[${countryCode}/${archetype}] FAILED — generation succeeded ($${r.costUsd.toFixed(4)}) but the upsert did not land (see error above).`)
      return { status: 'failed', itemCount: validItems.length, costUsd: r.costUsd, error: 'store failed' }
    }

    console.log(`[${countryCode}/${archetype}] generated — ${validItems.length} items stored, $${r.costUsd.toFixed(4)}`)
    return { status: 'generated', itemCount: validItems.length, costUsd: r.costUsd }
  } catch (err) {
    // AICallError (truncation / no text block) carries the already-billed
    // cost even though the call is unusable — count it if present.
    const e = err as { costUsd?: number }
    const costUsd = typeof e.costUsd === 'number' ? e.costUsd : 0
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[${countryCode}/${archetype}] FAILED — ${message}`)
    return { status: 'failed', itemCount: 0, costUsd, error: message }
  }
}

async function main() {
  const argv = parseArgs(process.argv.slice(2))

  const requiredEnv = ['ANTHROPIC_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL']
  const missingEnv = requiredEnv.filter(k => !process.env[k])
  if (missingEnv.length > 0) {
    console.error(`Missing required env var(s): ${missingEnv.join(', ')}.`)
    console.error('Copy .env.local (with real Anthropic + Supabase keys) into this worktree before running.')
    process.exit(1)
  }

  if (typeof argv.countries !== 'string' || argv.countries.trim() === '') {
    usage()
    process.exit(1)
  }
  const countries = Array.from(new Set(
    argv.countries.split(',').map(c => c.trim().toUpperCase()).filter(Boolean)
  ))
  if (countries.length === 0) {
    usage()
    process.exit(1)
  }

  const knownArchetypes = defaultArchetypes()
  const archetypes = typeof argv.archetypes === 'string' && argv.archetypes.trim() !== ''
    ? Array.from(new Set(argv.archetypes.split(',').map(a => a.trim()).filter(Boolean)))
    : knownArchetypes
  // A typo'd archetype would happily generate + store a row no report can
  // ever read (reports look up by the idea's real archetype) — pure wasted
  // spend, so reject unknown names outright.
  const unknownArchetypes = archetypes.filter(a => !knownArchetypes.includes(a))
  if (unknownArchetypes.length > 0) {
    console.error(`Unknown archetype(s): ${unknownArchetypes.join(', ')}. Known: ${knownArchetypes.join(', ')}`)
    process.exit(1)
  }

  const refreshDaysRaw = argv['refresh-days']
  const refreshDays = typeof refreshDaysRaw === 'string' ? parseInt(refreshDaysRaw, 10) : 30
  if (Number.isNaN(refreshDays) || refreshDays < 0) {
    console.error(`Invalid --refresh-days value: ${String(refreshDaysRaw)}`)
    process.exit(1)
  }

  const force = argv.force === true
  const dryRun = argv['dry-run'] === true

  let maxSpend: number | undefined
  if (typeof argv['max-spend'] === 'string') {
    maxSpend = parseFloat(argv['max-spend'])
    if (Number.isNaN(maxSpend) || maxSpend < 0) {
      console.error(`Invalid --max-spend value: ${argv['max-spend']}`)
      process.exit(1)
    }
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  console.log(`Countries: ${countries.join(', ')}`)
  console.log(`Archetypes: ${archetypes.join(', ')}`)
  console.log(`Refresh window: ${refreshDays}d${force ? ' (ignored — --force set)' : ''}`)
  console.log('')

  let plan: PlanItem[]
  try {
    plan = await buildPlan(supabase, countries, archetypes, refreshDays, force)
  } catch (err) {
    if (err instanceof MissingTableError) {
      console.error('evergreen_baselines table not found — run migration 030 first (supabase/migrations/030_evergreen_baselines.sql).')
      process.exit(1)
    }
    console.error('Failed to build the work plan:', err instanceof Error ? err.message : err)
    process.exit(1)
  }

  const toGenerate = plan.filter(p => p.action === 'generate')
  const toSkip = plan.filter(p => p.action === 'skip')
  const estimatedCost = toGenerate.length * ESTIMATED_COST_PER_ENTRY

  console.log('Plan:')
  for (const p of plan) {
    console.log(`  [${p.action.toUpperCase().padEnd(8)}] ${p.countryCode}/${p.archetype} — ${p.reason}`)
  }
  console.log('')
  console.log(`${toGenerate.length} to generate, ${toSkip.length} to skip. Estimated cost: $${estimatedCost.toFixed(2)} (at $${ESTIMATED_COST_PER_ENTRY.toFixed(2)}/entry).`)
  if (maxSpend !== undefined && estimatedCost > maxSpend) {
    console.log(`(exceeds --max-spend $${maxSpend.toFixed(2)} — the run would abort before making any AI calls)`)
  }

  if (dryRun) {
    console.log('\n--dry-run: no AI calls made, no DB writes.')
    process.exit(0)
  }

  if (maxSpend !== undefined && estimatedCost > maxSpend) {
    console.error(`\nAborting before starting: planned ${toGenerate.length} generation(s) x $${ESTIMATED_COST_PER_ENTRY.toFixed(2)} = $${estimatedCost.toFixed(2)} exceeds --max-spend $${maxSpend.toFixed(2)}. No AI calls made, no writes.`)
    process.exit(1)
  }

  if (toGenerate.length === 0) {
    console.log('\nNothing to generate — cache is already warm for every requested pair.')
    process.exit(0)
  }

  console.log(`\nGenerating ${toGenerate.length} baseline(s) sequentially...\n`)

  let generated = 0
  let failed = 0
  let totalCost = 0

  for (const p of toGenerate) {
    const result = await generateOne(supabase, p.countryCode, p.archetype)
    totalCost += result.costUsd
    if (result.status === 'generated') generated++
    else failed++
  }

  console.log('')
  console.log('── Summary ──')
  console.log(`generated: ${generated}`)
  console.log(`skipped:   ${toSkip.length}`)
  console.log(`failed:    ${failed}`)
  console.log(`total cost: $${totalCost.toFixed(4)}`)

  if (toGenerate.length > 0 && generated === 0) {
    console.error('\nEvery attempted generation failed.')
    process.exit(1)
  }
  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
