import {
  CheckRow,
  SlideShell,
  StaggeredCards,
  type AdCard,
  type Slide,
} from '../slide-kit'

// ── Campaign: "$4.95 launch pricing" (paid launch) ───────────────────────
// Goal: first 1,000 paid reports at a launch discount. Two OFFER variants
// are included back-to-back — one shows the price with the $19.95 anchor,
// one teases the discount without a number — so the price question can be
// A/B tested (or decided) without rebuilding the deck. Use slide 6 OR 7,
// never both in one cut.

const CARDS: [AdCard, AdCard, AdCard] = [
  { title: 'Kids coding classes', location: 'Manchester, UK', score: 82, success: 79, competitors: 6, cost: '$2,150', rotate: '-rotate-2' },
  { title: 'Refillable cleaning co.', location: 'Portland, USA', score: 71, success: 63, competitors: 11, cost: '$4,900', rotate: 'rotate-1' },
  { title: 'Vintage furniture flip', location: 'Leeds, UK', score: 59, success: 61, competitors: 17, cost: '$1,800', rotate: '-rotate-1' },
]

export const LAUNCH_DEAL: { name: string; purpose: string; slides: Slide[] } = {
  name: '$4.95 launch pricing',
  purpose: 'Paid launch — discounted reports for the first 1,000 users. Slides 1–3 are HOOK VARIANTS (use one per cut); the offer slide also comes in price-shown and price-teased variants (use one). Note: hooks B and C name the price — pair them with the price-shown offer.',
  slides: [
    {
      title: 'Hook A — nobody tells you how',
      node: (
        <SlideShell>
          <div className="flex flex-1 flex-col justify-center">
            <p className="text-[46px] font-medium text-slate-400">Everyone says</p>
            <h1 className="mt-8 text-[100px] font-bold leading-[1.08] tracking-tight">
              &ldquo;Validate your idea first.&rdquo;
            </h1>
            <p className="mt-16 text-[52px] font-medium leading-snug text-slate-300">
              Nobody tells you <span className="gradient-text font-bold">how.</span>
            </p>
          </div>
        </SlideShell>
      ),
    },
    {
      title: 'Hook B — the price is the hook',
      node: (
        <SlideShell>
          <div className="flex flex-1 flex-col justify-center">
            <h1 className="text-[200px] font-bold leading-none tracking-tight">
              <span className="gradient-text">$4.95</span>
            </h1>
            <p className="mt-14 text-[48px] font-medium leading-snug text-slate-200">
              That&rsquo;s what it now costs to find out if your business idea works.
            </p>
            <p className="mt-12 text-[36px] text-slate-400">Launch pricing — first 1,000 reports.</p>
          </div>
        </SlideShell>
      ),
    },
    {
      title: 'Hook C — thousands vs five bucks',
      node: (
        <SlideShell>
          <div className="flex flex-1 flex-col justify-center">
            <p className="text-[50px] font-medium leading-snug text-slate-400">
              You&rsquo;ll spend thousands starting it.
            </p>
            <h1 className="mt-14 text-[100px] font-bold leading-[1.08] tracking-tight">
              Spend <span className="gradient-text">five bucks</span> checking it first.
            </h1>
          </div>
        </SlideShell>
      ),
    },
    {
      title: 'How it works',
      node: (
        <SlideShell>
          <div className="flex flex-1 flex-col justify-center">
            <h2 className="text-[84px] font-bold leading-tight tracking-tight">
              Here&rsquo;s <span className="gradient-text">how.</span>
            </h2>
            <div className="mt-20 space-y-12">
              <CheckRow title="1. Describe your idea" detail="Plain English. No forms, no jargon, no pitch deck." />
              <CheckRow title="2. Answer a few sharp questions" detail="Your budget, your time, your edge — the things that change the answer." />
              <CheckRow title="3. We research it live" detail="Real competitors, real prices, real costs, real rules for your country." />
              <CheckRow title="4. You get a scored, structured plan" detail="With the next steps ordered, and the first one achievable this week." />
            </div>
          </div>
        </SlideShell>
      ),
    },
    {
      title: 'Scored cards',
      node: (
        <SlideShell>
          <div className="flex flex-1 flex-col justify-center">
            <h2 className="text-center text-[76px] font-bold leading-tight tracking-tight">
              Honest scores. <span className="gradient-text">Even when it stings.</span>
            </h2>
            <StaggeredCards cards={CARDS} />
          </div>
        </SlideShell>
      ),
    },
    {
      title: 'The alternative costs more',
      node: (
        <SlideShell>
          <div className="flex flex-1 flex-col justify-center">
            <h2 className="text-[80px] font-bold leading-tight tracking-tight">
              Finding out the <span className="gradient-text">hard way</span> costs more.
            </h2>
            <div className="mt-20 space-y-14">
              <div>
                <p className="text-[40px] font-semibold text-slate-200">Buying equipment for a market that&rsquo;s saturated</p>
                <p className="mt-2 text-[32px] text-slate-500">thousands, gone</p>
              </div>
              <div>
                <p className="text-[40px] font-semibold text-slate-200">Months building something nobody asked for</p>
                <p className="mt-2 text-[32px] text-slate-500">your evenings and weekends, gone</p>
              </div>
              <div>
                <p className="text-[40px] font-semibold text-slate-200">Finding the permit problem after you&rsquo;ve started</p>
                <p className="mt-2 text-[32px] text-slate-500">fines, delays, restarts</p>
              </div>
            </div>
            <p className="mt-20 text-[40px] leading-snug text-slate-300">
              A research-backed plan is the cheap way to find out.
            </p>
          </div>
        </SlideShell>
      ),
    },
    {
      title: 'Everything you get',
      node: (
        <SlideShell>
          <div className="flex flex-1 flex-col justify-center">
            <h2 className="text-[76px] font-bold leading-tight tracking-tight">
              One report. <span className="gradient-text">Everything you need.</span>
            </h2>
            <div className="mt-16 space-y-10">
              <CheckRow title="Viability scores with reasons" detail="Market, difficulty, capital, time to revenue — calibrated, not flattery." />
              <CheckRow title="Competitor breakdown" detail="Real businesses, real prices, and the gap you can own." />
              <CheckRow title="Cost and margin math" detail="Startup costs, running costs, and what each sale really earns." />
              <CheckRow title="Legal and permit checklist" detail="Specific to your country — with links to official sources." />
              <CheckRow title="Risks, next steps, and demand tests" detail="What to weigh, what to do first, and paste-ready copy to test demand." />
            </div>
          </div>
        </SlideShell>
      ),
    },
    {
      title: 'Offer — price shown (variant A)',
      node: (
        <SlideShell>
          <div className="flex flex-1 flex-col justify-center">
            <p className="text-[44px] font-medium text-slate-400">Launch pricing —</p>
            <h2 className="mt-12 text-[190px] font-bold leading-none tracking-tight">
              <span className="gradient-text">$4.95</span>
            </h2>
            <p className="mt-8 text-[52px] font-semibold text-slate-200">per report, for the first 1,000 users.</p>
            <div className="mt-16 space-y-6">
              <p className="text-[38px] leading-snug text-slate-400">Then reports move to $19.95.</p>
              <p className="text-[38px] leading-snug text-slate-300">
                Less than the coffee you&rsquo;d drink while wondering about it.
              </p>
            </div>
          </div>
        </SlideShell>
      ),
    },
    {
      title: 'Offer — price teased (variant B)',
      node: (
        <SlideShell>
          <div className="flex flex-1 flex-col justify-center">
            <p className="text-[44px] font-medium text-slate-400">We just launched, so —</p>
            <h2 className="mt-12 text-[96px] font-bold leading-[1.08] tracking-tight">
              The first 1,000 reports are at a <span className="gradient-text">launch discount.</span>
            </h2>
            <div className="mt-20 space-y-8">
              <p className="text-[40px] leading-snug text-slate-300">
                A fraction of the regular price — and it ends when they&rsquo;re gone.
              </p>
              <p className="text-[40px] leading-snug text-slate-300">
                The price is on the site. It&rsquo;ll surprise you the right way.
              </p>
            </div>
          </div>
        </SlideShell>
      ),
    },
    {
      title: 'CTA',
      node: (
        <SlideShell footer={false}>
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-[64px] font-bold tracking-tight">HadIdea</p>
            <h2 className="mt-14 text-[92px] font-bold leading-[1.1] tracking-tight">
              From raw idea to <span className="gradient-text">real-world plan.</span>
            </h2>
            <span className="mt-24 rounded-2xl bg-indigo-500 px-16 py-8 text-[40px] font-semibold text-white shadow-2xl shadow-indigo-500/40">
              Get your plan
            </span>
            <p className="mt-10 text-[34px] text-slate-400">Launch pricing for the first 1,000 users</p>
            <p className="mt-24 text-[52px] font-semibold tracking-tight text-slate-200">hadidea.com</p>
          </div>
        </SlideShell>
      ),
    },
  ],
}
