import { ScoreRing } from '@/components/score-ring'
import {
  AdRing,
  CheckRow,
  CtaSlide,
  DimensionBar,
  GlanceTile,
  SlideShell,
  StaggeredCards,
  type AdCard,
  type Slide,
} from '../slide-kit'

// ── Campaign: "first 1,000 plans free" (launch feedback drive) ───────────
// Goal: seed the first 1,000 reports at zero cost and harvest feedback on
// report quality. Offer copy must stay in sync with the actual promo gate.

const CARDS: [AdCard, AdCard, AdCard] = [
  { title: 'Homemade pet treats', location: 'Brisbane, Australia', score: 78, success: 72, competitors: 14, cost: '$3,200', rotate: '-rotate-2' },
  { title: 'Meal-prep delivery', location: 'Denver, USA', score: 87, success: 83, competitors: 8, cost: '$8,400', rotate: 'rotate-1' },
  { title: 'Mobile car detailing', location: 'Austin, USA', score: 64, success: 58, competitors: 9, cost: '$6,800', rotate: '-rotate-1' },
]

export const FREE_LAUNCH: { name: string; purpose: string; slides: Slide[] } = {
  name: 'First 1,000 plans free',
  purpose: 'Launch feedback drive — free generations for the first 1,000 users. Slides 1–3 are HOOK VARIANTS for split testing: use exactly one per cut.',
  slides: [
    {
      title: 'Hook A — the idea you keep thinking about',
      node: (
        <SlideShell>
          <div className="flex flex-1 flex-col justify-center">
            <p className="text-[46px] font-medium text-slate-400">You know that business idea</p>
            <p className="mt-2 text-[46px] font-medium text-slate-400">you keep thinking about?</p>
            <h1 className="mt-16 text-[110px] font-bold leading-[1.05] tracking-tight">
              Find out if it <span className="gradient-text">actually works.</span>
            </h1>
            <p className="mt-16 text-[40px] leading-snug text-slate-300">
              Before you spend a dollar on it.
            </p>
          </div>
        </SlideShell>
      ),
    },
    {
      title: 'Hook B — nobody checked',
      node: (
        <SlideShell>
          <div className="flex flex-1 flex-col justify-center">
            <p className="text-[46px] font-medium text-slate-400">Most business ideas die as a thought.</p>
            <h1 className="mt-14 text-[96px] font-bold leading-[1.1] tracking-tight">
              Not because they were bad — <span className="gradient-text">because nobody checked.</span>
            </h1>
            <p className="mt-16 text-[40px] leading-snug text-slate-300">
              Checking takes minutes now. Not months.
            </p>
          </div>
        </SlideShell>
      ),
    },
    {
      title: 'Hook C — costs $0 to find out',
      node: (
        <SlideShell>
          <div className="flex flex-1 flex-col justify-center">
            <p className="text-[46px] font-medium text-slate-400">For the first 1,000 people —</p>
            <h1 className="mt-14 text-[102px] font-bold leading-[1.08] tracking-tight">
              it costs <span className="gradient-text">$0</span> to find out if your idea works.
            </h1>
            <p className="mt-16 text-[40px] leading-snug text-slate-300">
              Real research. Real numbers. Free.
            </p>
          </div>
        </SlideShell>
      ),
    },
    {
      title: 'Describe it',
      node: (
        <SlideShell>
          <div className="flex flex-1 flex-col justify-center">
            <h2 className="text-[84px] font-bold leading-tight tracking-tight">
              Describe your idea in <span className="gradient-text">plain English.</span>
            </h2>
            <div className="mt-20 rounded-3xl border border-white/15 bg-slate-900/90 p-12 shadow-2xl shadow-black/40">
              <p className="text-[36px] leading-relaxed text-slate-200">
                &ldquo;I want to sell homemade pet treats at weekend markets in my hometown&rdquo;
              </p>
              <div className="mt-10 flex justify-end">
                <span className="rounded-xl bg-indigo-500 px-10 py-5 text-[30px] font-semibold text-white shadow-lg shadow-indigo-500/40">
                  Analyse my idea
                </span>
              </div>
            </div>
            <p className="mt-14 text-[36px] text-slate-400">No forms. No jargon. No pitch deck.</p>
          </div>
        </SlideShell>
      ),
    },
    {
      title: 'Real research',
      node: (
        <SlideShell>
          <div className="flex flex-1 flex-col justify-center">
            <h2 className="text-[84px] font-bold leading-tight tracking-tight">
              Then we research it. <span className="gradient-text">For real.</span>
            </h2>
            <div className="mt-20 space-y-12 short:mt-12 wide:grid wide:grid-cols-2 wide:gap-x-20 wide:gap-y-9 wide:space-y-0">
              <CheckRow title="Live web search" detail="Not a canned template — research runs when you ask." />
              <CheckRow title="Real competitors and their prices" detail="Who already does this near you, and what they charge." />
              <CheckRow title="Startup and running costs" detail="What it takes to open the doors, and to keep them open." />
              <CheckRow title="Legal for your country" detail="Permits, registrations, and rules that apply where you live." />
              <CheckRow title="Funding options" detail="If your budget falls short, we find the programs that bridge it." />
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
              Every idea gets <span className="gradient-text">scored.</span>
            </h2>
            <StaggeredCards cards={CARDS} />
          </div>
        </SlideShell>
      ),
    },
    {
      title: 'Inside the report',
      node: (
        <SlideShell>
          <div className="flex flex-1 flex-col justify-center">
            <h2 className="text-[76px] font-bold leading-tight tracking-tight">
              Inside your <span className="gradient-text">report.</span>
            </h2>
            <div className="short:mt-8 wide:flex wide:items-stretch wide:gap-8">
              <div className="mt-16 rounded-3xl border border-white/10 bg-slate-900/90 p-12 wide:mt-0 wide:flex-1 short:p-10 square:mt-8">
                <div className="flex items-center gap-8">
                  <div className="flex items-start gap-8">
                    <AdRing score={78} label="Viability" size={140} />
                    <AdRing score={72} label="Success outlook" size={140} />
                  </div>
                  <p className="text-[38px] font-semibold">Viability Snapshot</p>
                </div>
                <div className="mt-12 space-y-10 short:mt-8 short:space-y-6">
                  <DimensionBar label="Market opportunity" score={4} note="14 competitors selling out at local weekend markets proves people already pay for this." />
                  {/* Square only has room for one dimension bar. */}
                  <div className="square:hidden">
                    <DimensionBar label="Time to revenue" score={2} note="With council registration done, first sales are weeks away — not months." />
                  </div>
                </div>
              </div>
              <div className="mt-10 grid grid-cols-4 gap-6 wide:mt-0 wide:w-[540px] wide:shrink-0 wide:grid-cols-2 square:mt-7">
                <GlanceTile label="Demand evidence"><ScoreRing score={84} label="" size={110} /></GlanceTile>
                <GlanceTile label="Edge strength"><ScoreRing score={68} label="" size={110} /></GlanceTile>
                <GlanceTile label="Gross margin"><ScoreRing score={73} label="" size={110} /></GlanceTile>
                <GlanceTile label="Budget fit">
                  <div className="flex h-[110px] flex-col items-center justify-center gap-4">
                    <span className="text-[30px] font-semibold text-amber-300">Partway there</span>
                    <div className="flex w-[120px] gap-1.5">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className={`h-3 flex-1 rounded-full ${i <= 2 ? 'bg-amber-400' : 'bg-white/10'}`} />
                      ))}
                    </div>
                  </div>
                </GlanceTile>
              </div>
            </div>
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
            <div className="mt-16 space-y-10 short:mt-10 wide:grid wide:grid-cols-2 wide:gap-x-20 wide:gap-y-8 wide:space-y-0">
              <CheckRow title="Competitor breakdown" detail="Real businesses, real prices, and the gap you can own." />
              <CheckRow title="Cost and margin math" detail="Startup costs, running costs, and what each sale really earns." />
              <CheckRow title="Legal and permit checklist" detail="Specific to your country — with links to official sources." />
              <CheckRow title="Pricing recommendation" detail="Anchored to what your competitors actually charge." />
              <CheckRow title="Risks with mitigations" detail="Facts to weigh and how to handle them — not vague warnings." />
              <CheckRow title="A week-one action plan" detail="Ordered next steps with honest timeframes." />
              <CheckRow title="Paste-ready demand tests" detail="Poll, ad line, and forum post written in your voice." />
            </div>
          </div>
        </SlideShell>
      ),
    },
    {
      title: 'The offer',
      node: (
        <SlideShell>
          <div className="flex flex-1 flex-col justify-center">
            <p className="text-[44px] font-medium text-slate-400">We just launched, so —</p>
            <h2 className="mt-12 text-[104px] font-bold leading-[1.08] tracking-tight">
              The first <span className="gradient-text">1,000 plans</span> are free.
            </h2>
            <div className="mt-20 space-y-8">
              <p className="text-[40px] leading-snug text-slate-300">No card. No catch.</p>
              <p className="text-[40px] leading-snug text-slate-300">
                Generate your plan, then tell us what we got wrong — your feedback shapes the product.
              </p>
            </div>
          </div>
        </SlideShell>
      ),
    },
    {
      title: 'CTA',
      node: (
        <CtaSlide
          headline={<>From raw idea to <span className="gradient-text">real-world plan.</span></>}
          button="Get your free plan"
          sub="Free for the first 1,000 founders"
        />
      ),
    },
  ],
}
