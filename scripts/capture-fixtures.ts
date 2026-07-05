/**
 * Local dev mode — fixture capture script (see docs/plan/LOCAL_DEV_MODE.md).
 * Usage: npx tsx scripts/capture-fixtures.ts
 *
 * Pulls the latest complete report from Supabase and writes one JSON fixture
 * per report-generating tag into src/lib/fixtures/. Each fixture file's
 * content is the raw JSON *string* callAI would have returned for that call
 * (i.e. the parsed object, re-serialized) — so AI_PROVIDER=mock can hand it
 * back as `text` and the app's existing extractJson/JSON.parse path is
 * unchanged.
 *
 * Non-report tags (classifier, dynamic-questions, report:teaser) have no
 * single "latest row" source, so they're hand-written realistic samples
 * instead of captured — see buildHandWrittenFixtures() below.
 *
 * Fixture filenames are derived from the exact `tag` string each call site
 * passes to callAI (see src/lib/ai.ts's mock lookup, which maps tag -> file
 * by replacing ':' with '-') — NOT from the prompt module's filename. E.g.
 * the classify prompt lives in src/lib/prompts/classify.ts but the call site
 * (src/app/api/ideas/route.ts) passes tag: 'classifier', so the fixture is
 * classifier.json. Likewise the teaser call site passes tag: 'report:teaser',
 * so the fixture is report-teaser.json.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const FIXTURES_DIR = join(process.cwd(), 'src/lib/fixtures')

function isUnavailable(v: unknown): boolean {
  return typeof v === 'object' && v !== null && (v as Record<string, unknown>).status === 'unavailable'
}

function writeFixture(filename: string, value: unknown) {
  mkdirSync(FIXTURES_DIR, { recursive: true })
  const json = JSON.stringify(value, null, 2)
  writeFileSync(join(FIXTURES_DIR, filename), json + '\n', 'utf-8')
  console.log(`wrote ${filename}`)
}

// Realistic hand-written 3-item array matching src/lib/prompts/financing.ts's
// documented shape — used when no captured funding_options section exists
// (financing only runs when the founder's stated capital falls short of the
// estimated startup cost, so plenty of complete reports never populate it).
const HANDWRITTEN_FINANCING = [
  {
    name: 'Boss Grants for Small Business',
    type: 'grant',
    jurisdiction: 'Queensland, Australia',
    summary: 'Co-funded grant covering up to 50% of eligible project costs (typically AUD 10,000-50,000) for small businesses investing in specialised equipment, business expansion, or building business capability.',
    eligibility: 'Must be a registered small business in Queensland with fewer than 20 employees, an ABN, and a co-contribution of at least 50% of the project cost.',
    url: 'https://www.business.qld.gov.au/running-business/grants-assistance/grants/business-boost',
    fit_note: 'Directly offsets the equipment and tooling line items in the startup cost estimate, halving the founder\'s out-of-pocket exposure on the largest capital line.',
  },
  {
    name: 'R&D Tax Incentive',
    type: 'tax_incentive',
    jurisdiction: 'Federal, Australia',
    summary: 'Refundable tax offset (up to 43.5%) on eligible R&D expenditure for companies with aggregated turnover under AUD 20 million, claimed annually via the ATO after registering activities with AusIndustry.',
    eligibility: 'Must be an incorporated entity conducting registered core or supporting R&D activities involving genuine technical uncertainty; annual registration deadline is 10 months after the end of the income year.',
    url: 'https://business.gov.au/grants-and-programs/research-and-development-tax-incentive',
    fit_note: 'Useful once the founder incorporates and formalises the prototyping work already underway — offsets a meaningful share of iteration costs even though it lags the initial cash outlay.',
  },
  {
    name: 'Prospa Small Business Loan',
    type: 'loan',
    jurisdiction: 'Federal, Australia',
    summary: 'Unsecured small business term loan from AUD 5,000-500,000 with terms of 3-24 months, funded within 24 hours of approval; typical simple interest rates start around 9.9% p.a. for qualifying businesses.',
    eligibility: 'Minimum 6 months trading history, AUD 5,000+ monthly revenue, and an Australian business number; sole traders and early-stage businesses with limited revenue history may not qualify.',
    url: 'https://www.prospa.com/business-loans',
    fit_note: 'A fallback bridge for the remaining shortfall after grant and bootstrap options are applied, best used only once the business has enough trading history to qualify.',
  },
]

async function fetchLatestCompleteReport() {
  const { data, error } = await supabase
    .from('reports')
    .select('id, idea_id, status, sections, created_at')
    .eq('status', 'complete')
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw error
  return data?.[0] ?? null
}

function buildReportFixtures(sections: Record<string, unknown>) {
  // competitors
  if (isUnavailable(sections.competitors)) {
    console.log('skip report-competitors.json: latest report has competitors marked unavailable')
  } else if (sections.competitors !== undefined) {
    writeFixture('report-competitors.json', sections.competitors)
  } else {
    console.log('skip report-competitors.json: no competitors section on latest report')
  }

  // compliance
  if (isUnavailable(sections.legal_compliance)) {
    console.log('skip report-compliance.json: latest report has legal_compliance marked unavailable')
  } else if (sections.legal_compliance !== undefined) {
    writeFixture('report-compliance.json', sections.legal_compliance)
  } else {
    console.log('skip report-compliance.json: no legal_compliance section on latest report')
  }

  // costs
  if (isUnavailable(sections.cost_breakdown)) {
    console.log('skip report-costs.json: latest report has cost_breakdown marked unavailable')
  } else if (sections.cost_breakdown !== undefined) {
    writeFixture('report-costs.json', sections.cost_breakdown)
  } else {
    console.log('skip report-costs.json: no cost_breakdown section on latest report')
  }

  // synthesis — combined object of the five synthesis output keys
  const synthesisKeys = ['summary', 'viability_snapshot', 'pricing_recommendation', 'risks', 'next_steps'] as const
  const unavailableSynthesisKeys = synthesisKeys.filter(k => isUnavailable(sections[k]))
  const missingSynthesisKeys = synthesisKeys.filter(k => sections[k] === undefined)
  if (unavailableSynthesisKeys.length > 0) {
    console.log(`skip report-synthesis.json: synthesis keys marked unavailable on latest report: ${unavailableSynthesisKeys.join(', ')}`)
  } else if (missingSynthesisKeys.length > 0) {
    console.log(`skip report-synthesis.json: synthesis keys missing on latest report: ${missingSynthesisKeys.join(', ')}`)
  } else {
    const synthesis: Record<string, unknown> = {}
    for (const k of synthesisKeys) synthesis[k] = sections[k]
    writeFixture('report-synthesis.json', synthesis)
  }

  // financing — captured funding_options if present, else hand-written sample
  if (isUnavailable(sections.funding_options)) {
    console.log('skip captured report-financing.json: latest report has funding_options marked unavailable; writing hand-written sample instead')
    writeFixture('report-financing.json', HANDWRITTEN_FINANCING)
  } else if (sections.funding_options !== undefined) {
    writeFixture('report-financing.json', sections.funding_options)
  } else {
    console.log('no funding_options section on latest report (financing only runs on a capital shortfall); writing hand-written sample instead')
    writeFixture('report-financing.json', HANDWRITTEN_FINANCING)
  }
}

// Hand-written fixtures for non-report tags — shapes taken from
// src/lib/prompts/classify.ts, dynamic-questions.ts, and teaser.ts.
// Filenames match the actual `tag` strings passed to callAI at each call
// site (tag: 'classifier' in src/app/api/ideas/route.ts, tag: 'report:teaser'
// in src/lib/inngest/generate-teaser.ts), sanitized ':' -> '-'.
function buildHandWrittenFixtures() {
  writeFixture('classifier.json', {
    archetype: 'physical_product',
    confidence: 0.91,
    one_line_restatement: 'Sell small-batch artisan sourdough bread at weekend farmers markets and to local cafes.',
    detected_signals: ['homemade tangible good', 'bread produced by operator', 'farmers market distribution channel'],
  })

  writeFixture('dynamic-questions.json', [
    {
      key: 'baking_capacity_per_week',
      text: 'How many loaves can you realistically bake per week with your current oven setup?',
      subtext: 'This drives the batch-cost and revenue-ceiling estimates in your report.',
      input_type: 'number',
      options: null,
      required: false,
      maps_to: 'operations.production_capacity',
    },
    {
      key: 'wholesale_interest',
      text: 'Have any local cafes or shops already expressed interest in stocking your bread?',
      subtext: null,
      input_type: 'select',
      options: ['Yes, verbal interest', 'Yes, in discussion', 'Not yet', 'Not planning to pursue wholesale'],
      required: false,
      maps_to: 'market.channel_validation',
    },
  ])

  writeFixture('report-teaser.json', {
    summary: {
      text: 'This is a small-batch sourdough bakery selling through weekend farmers markets in Portland, Oregon, with early interest from local cafes for wholesale. The archetype fits physical_product cleanly given the operator bakes everything themselves. Demand for artisan bread at markets is well established, but margins depend heavily on ingredient and labour costs per loaf.',
    },
    viability_snapshot: {
      scores: {
        market_opportunity: { score: 3, rationale: 'Farmers-market artisan bread is a proven but crowded niche with modest per-unit revenue ceilings.' },
        execution_difficulty: { score: 2, rationale: 'Sourdough baking at this scale is a well-understood, repeatable process once a routine is established.' },
        capital_required: { score: 1, rationale: 'Home-kitchen and market-stall setup needs minimal upfront equipment spend.' },
        time_to_revenue: { score: 1, rationale: 'A market stall can generate its first sale within days of setup.' },
      },
      overall_verdict: 'Low-risk, low-capital way to test demand quickly, but revenue growth will depend on securing wholesale accounts beyond weekend markets.',
    },
    next_steps_preview: [
      { action: 'Confirm local cottage-food or food-safety registration requirements', timeframe: 'Week 1' },
      { action: 'Bake a trial batch and price-test at one farmers market', timeframe: 'Week 2' },
    ],
  })
}

async function main() {
  const report = await fetchLatestCompleteReport()
  if (!report) {
    console.log('No complete report found in Supabase — skipping captured fixtures, writing hand-written fixtures only.')
  } else {
    console.log(`Using report ${report.id} (created ${report.created_at}) as fixture source.`)
    const sections = (report.sections ?? {}) as Record<string, unknown>
    buildReportFixtures(sections)
  }
  buildHandWrittenFixtures()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
