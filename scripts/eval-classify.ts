/**
 * Classifier eval script — task 2.6
 * Usage: npx tsx scripts/eval-classify.ts
 * Target: >= 18/20 exact-match passes
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import Anthropic from '@anthropic-ai/sdk'
import { CLASSIFY_SYSTEM_PROMPT, buildClassifyUserMessage } from '../src/lib/prompts/classify'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const EVAL_CASES = [
  { id: 'eval-01-pet-treats', idea: 'home made pet treats', location: 'Brisbane, Australia', expected: 'physical_product' },
  { id: 'eval-02-lawn-mowing', idea: 'I want to start a lawn mowing business for residential customers', location: 'Manchester, UK', expected: 'local_service' },
  { id: 'eval-03-freelancer-saas', idea: 'a web app for freelancers to track billable hours and generate invoices', location: 'Berlin, Germany', expected: 'software_app' },
  { id: 'eval-04-print-on-demand-cases', idea: 'selling custom phone cases online through Shopify with print on demand', location: 'Austin, Texas, USA', expected: 'ecommerce_brand' },
  { id: 'eval-05-youtube-cooking', idea: 'a YouTube cooking channel focused on 15-minute weeknight dinners', location: 'Toronto, Canada', expected: 'content_education' },
  { id: 'eval-06-dog-walker-marketplace', idea: 'a platform connecting dog owners with local dog walkers in their neighborhood', location: 'Chicago, Illinois, USA', expected: 'marketplace' },
  { id: 'eval-07-patent-litter-box', idea: 'a self-cleaning litter box with a patented rotating drum mechanism I designed', location: 'Osaka, Japan', expected: 'invention' },
  { id: 'eval-08-nonsense', idea: 'asdf', location: 'Sydney, Australia', expected: 'other', requireLowConfidence: true },
  { id: 'eval-09-hot-sauce-subscription', idea: 'a subscription box of small-batch hot sauces from independent makers, mailed monthly', location: 'Portland, Oregon, USA', expected: 'ecommerce_brand' },
  { id: 'eval-10-craft-brewery', idea: 'a craft brewery selling my own beer at the local taproom and to nearby bottle shops', location: 'Portland, Maine, USA', expected: 'physical_product' },
  { id: 'eval-11-mobile-detailing', idea: 'a mobile car detailing service that visits customers at their homes on weekends', location: 'Denver, Colorado, USA', expected: 'local_service' },
  { id: 'eval-12-newsletter', idea: 'a paid weekly newsletter analyzing indie SaaS launches and revenue milestones', location: 'Lisbon, Portugal', expected: 'content_education' },
  { id: 'eval-13-fitness-coaching', idea: 'fitness coaching', location: 'Denver, Colorado, USA', expected: 'content_education', softMatch: ['local_service'] },
  { id: 'eval-14-composer-marketplace', idea: 'a marketplace matching indie film composers with small game studios that need original scores', location: 'Los Angeles, California, USA', expected: 'marketplace' },
  { id: 'eval-15-handmade-jewellery', idea: 'handmade sterling silver jewellery I forge in my home studio and sell on Etsy and Instagram', location: 'Auckland, New Zealand', expected: 'physical_product' },
  { id: 'eval-16-in-person-tutoring', idea: 'after-school maths tutoring for year 10 and 11 students, at their homes', location: 'North Sydney, Australia', expected: 'local_service' },
  { id: 'eval-17-desktop-writer', idea: 'a desktop app for indie novelists to manage manuscripts, revisions, and beta reader feedback', location: 'Edinburgh, UK', expected: 'software_app' },
  { id: 'eval-18-textile-process', idea: 'a new textile treatment process that makes cotton naturally water-repellent without PFAS chemicals', location: 'Milan, Italy', expected: 'invention' },
  { id: 'eval-19-off-topic', idea: 'my cat is really cute today and I love her', location: 'Melbourne, Australia', expected: 'other', requireLowConfidence: true },
  { id: 'eval-20-ambiguous-app-service', idea: 'an app that lets people book house cleaners in their city — I want to run the cleaning crews too', location: 'Vancouver, Canada', expected: 'local_service' },
] as const

type EvalCase = (typeof EVAL_CASES)[number]

async function runCase(c: EvalCase): Promise<{ pass: boolean; soft: boolean; result: Record<string, unknown>; error?: string }> {
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      system: CLASSIFY_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildClassifyUserMessage(c.idea, c.location) }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const result = JSON.parse(text) as { archetype: string; confidence: number }

    const exactMatch = result.archetype === c.expected
    const softMatch = 'softMatch' in c && Array.isArray(c.softMatch) && c.softMatch.includes(result.archetype)
    const confidenceOk = !('requireLowConfidence' in c) || result.confidence <= 0.30

    return {
      pass: exactMatch && confidenceOk,
      soft: !exactMatch && softMatch && confidenceOk,
      result: result as Record<string, unknown>,
    }
  } catch (e) {
    return { pass: false, soft: false, result: {}, error: String(e) }
  }
}

async function main() {
  console.log('\nClassifier eval — 20 cases\n')
  console.log(`${'ID'.padEnd(35)} ${'EXPECTED'.padEnd(20)} ${'GOT'.padEnd(20)} CONF   STATUS`)
  console.log('─'.repeat(100))

  let passes = 0
  let softs = 0

  for (const c of EVAL_CASES) {
    const { pass, soft, result, error } = await runCase(c)
    if (pass) passes++
    else if (soft) softs++

    const got = error ? 'ERROR' : String(result.archetype ?? '?')
    const conf = error ? '  ---' : String((result.confidence as number)?.toFixed(2) ?? '?').padStart(5)
    const status = error ? '❌ ERROR' : pass ? '✅ PASS' : soft ? '🟡 SOFT' : '❌ FAIL'
    console.log(`${c.id.padEnd(35)} ${c.expected.padEnd(20)} ${got.padEnd(20)} ${conf}   ${status}`)

    if (error) console.log(`  └─ ${error}`)

    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 300))
  }

  const total = EVAL_CASES.length
  const hardPasses = passes
  const score = `${hardPasses}/${total} hard passes  (${hardPasses + softs}/${total} including soft)`

  console.log('\n' + '─'.repeat(100))
  console.log(`\nResult: ${score}`)
  console.log(hardPasses >= 18 ? '✅ Target met (≥18/20)' : '❌ Below target (<18/20)')
  process.exit(hardPasses >= 18 ? 0 : 1)
}

main()
