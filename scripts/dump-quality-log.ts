/**
 * Phase 4B.3 — dump report cost/quality rows for docs/QUALITY_LOG.md
 * Usage: npx tsx scripts/dump-quality-log.ts
 * Prints a markdown table: one row per report (newest first) with archetype,
 * generation cost, and which sections failed — paste into docs/QUALITY_LOG.md
 * and grade usefulness by hand.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SECTION_KEYS = [
  'summary', 'viability_snapshot', 'competitors', 'cost_breakdown',
  'pricing_recommendation', 'funding_options', 'legal_compliance', 'risks', 'next_steps',
]

function isUnavailable(v: unknown): boolean {
  return typeof v === 'object' && v !== null && (v as Record<string, unknown>).status === 'unavailable'
}

async function main() {
  const { data: reports, error } = await supabase
    .from('reports')
    .select('id, idea_id, status, sections, created_at, generation_completed_at, ideas(raw_text, archetype)')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error

  console.log('| Date | Archetype | Idea | Cost USD | Failed sections | Grade |')
  console.log('|---|---|---|---|---|---|')
  for (const r of reports ?? []) {
    if (r.status !== 'complete') continue
    const sections = (r.sections ?? {}) as Record<string, unknown>
    const idea = (Array.isArray(r.ideas) ? r.ideas[0] : r.ideas) as { raw_text: string; archetype: string } | null
    const failed = SECTION_KEYS.filter(k => isUnavailable(sections[k]))
    const empty = SECTION_KEYS.filter(k => Array.isArray(sections[k]) && (sections[k] as unknown[]).length === 0)
    const meta = sections._meta as { cost_usd?: number } | undefined
    const cost = meta?.cost_usd !== undefined ? `$${meta.cost_usd.toFixed(2)}` : '—'
    const ideaText = (idea?.raw_text ?? '').slice(0, 40).replace(/\|/g, '/')
    const problems = [...failed.map(f => `${f} FAILED`), ...empty.map(e => `${e} empty`)].join(', ') || 'none'
    console.log(`| ${r.created_at.slice(0, 10)} | ${idea?.archetype ?? '?'} | ${ideaText} | ${cost} | ${problems} | |`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
