import { ScoreRing } from '@/components/score-ring'
import {
  GlanceTile,
  SlideShell,
  type Slide,
} from '../slide-kit'

// ── Evergreen campaign: test it on paper first ───────────────────────────
// Angle: the cheapest time to find out is before you spend. Leans on the
// cost/budget tiles and the paste-ready validation copy. No offer, no
// pricing: runs forever.

export const EVERGREEN_VALIDATION: { name: string; purpose: string; slides: Slide[] } = {
  name: 'Evergreen — test it on paper',
  purpose: 'Validation angle — know the numbers before you spend. No offer — runs forever. Slides 1–3 are HOOK VARIANTS: use exactly one per cut.',
  slides: [
    {
      title: 'Hook A — don’t quit your job',
      node: (
        <SlideShell>
          <div className="flex flex-1 flex-col justify-center">
            <h1 className="text-[96px] font-bold leading-[1.08] tracking-tight">
              Don&rsquo;t quit your job for an idea you haven&rsquo;t <span className="gradient-text">tested.</span>
            </h1>
            <p className="mt-16 text-[42px] leading-snug text-slate-300">
              The cheapest time to find out is <span className="font-semibold text-white">before</span> you start.
            </p>
          </div>
        </SlideShell>
      ),
    },
    {
      title: 'Hook B — the most expensive words',
      node: (
        <SlideShell>
          <div className="flex flex-1 flex-col justify-center">
            <p className="text-[46px] font-medium text-slate-400">The most expensive words in business:</p>
            <h1 className="mt-14 text-[104px] font-bold leading-[1.08] tracking-tight">
              &ldquo;I&rsquo;ll figure it out <span className="gradient-text">as I go.&rdquo;</span>
            </h1>
            <p className="mt-16 text-[42px] leading-snug text-slate-300">
              The numbers are knowable before you start.
            </p>
          </div>
        </SlideShell>
      ),
    },
    {
      title: 'Hook C — confidence vs numbers',
      node: (
        <SlideShell>
          <div className="flex flex-1 flex-col justify-center">
            <h1 className="text-[96px] font-bold leading-[1.1] tracking-tight">
              You don&rsquo;t need more confidence. You need <span className="gradient-text">the numbers.</span>
            </h1>
            <p className="mt-16 text-[42px] leading-snug text-slate-300">
              Costs, competitors, demand — researched before you commit.
            </p>
          </div>
        </SlideShell>
      ),
    },
    {
      title: 'Know the numbers',
      node: (
        <SlideShell>
          <div className="flex flex-1 flex-col justify-center">
            <h2 className="text-[80px] font-bold leading-tight tracking-tight">
              Know your numbers <span className="gradient-text">before you spend.</span>
            </h2>
            <div className="mt-16 space-y-8">
              <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-10">
                <p className="text-[28px] text-slate-400">Startup costs, researched for your market</p>
                <p className="mt-3 text-[54px] font-bold tracking-tight">$3,100–$10,800</p>
              </div>
              <div className="grid grid-cols-2 gap-8">
                <GlanceTile label="Gross margin per unit"><ScoreRing score={73} label="" size={130} /></GlanceTile>
                <GlanceTile label="Budget fit">
                  <div className="flex h-[130px] flex-col items-center justify-center gap-4">
                    <span className="text-[32px] font-semibold text-emerald-300">Covers a lean start</span>
                    <div className="flex w-[140px] gap-1.5">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className={`h-3 flex-1 rounded-full ${i <= 3 ? 'bg-emerald-400' : 'bg-white/10'}`} />
                      ))}
                    </div>
                  </div>
                </GlanceTile>
              </div>
            </div>
            <p className="mt-12 text-[32px] leading-snug text-slate-400">
              Your budget, against researched costs — so the plan fits the money you actually have.
            </p>
          </div>
        </SlideShell>
      ),
    },
    {
      title: 'Demand tests written for you',
      node: (
        <SlideShell>
          <div className="flex flex-1 flex-col justify-center">
            <h2 className="text-[76px] font-bold leading-tight tracking-tight">
              Test demand <span className="gradient-text">before you build.</span>
            </h2>
            <p className="mt-10 text-[36px] leading-snug text-slate-300">
              Every report ends with paste-ready copy — written in your voice, for your customer.
            </p>
            <div className="mt-14 space-y-8">
              <div className="rounded-3xl border border-white/15 bg-slate-900/90 p-10">
                <p className="text-[24px] font-semibold uppercase tracking-wide text-indigo-300">Poll for your local group</p>
                <p className="mt-4 text-[30px] leading-normal text-slate-200">
                  &ldquo;Dog owners — would you pay around $15 for a box of preservative-free treats
                  made locally, or is supermarket fine for you?&rdquo;
                </p>
              </div>
              <div className="rounded-3xl border border-white/15 bg-slate-900/90 p-10">
                <p className="text-[24px] font-semibold uppercase tracking-wide text-indigo-300">Ad line, under 120 characters</p>
                <p className="mt-4 text-[30px] leading-normal text-slate-200">
                  &ldquo;Preservative-free dog treats, baked this week in your suburb. First box half price.&rdquo;
                </p>
              </div>
            </div>
            <p className="mt-12 text-[32px] text-slate-400">Post them. Count the replies. Now you know.</p>
          </div>
        </SlideShell>
      ),
    },
    {
      title: 'Either answer wins',
      node: (
        <SlideShell>
          <div className="flex flex-1 flex-col justify-center">
            <h2 className="text-[84px] font-bold leading-tight tracking-tight">
              Either answer <span className="gradient-text">wins.</span>
            </h2>
            <div className="mt-20 space-y-16">
              <div>
                <p className="text-[44px] font-semibold text-white">If the numbers work —</p>
                <p className="mt-3 text-[36px] leading-snug text-slate-400">
                  you start with a plan, a price, and a first step you can do this week.
                </p>
              </div>
              <div>
                <p className="text-[44px] font-semibold text-white">If they don&rsquo;t —</p>
                <p className="mt-3 text-[36px] leading-snug text-slate-400">
                  you just saved yourself months and thousands of dollars. That&rsquo;s a win too.
                </p>
              </div>
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
              Test it on paper <span className="gradient-text">first.</span>
            </h2>
            <span className="mt-24 rounded-2xl bg-indigo-500 px-16 py-8 text-[40px] font-semibold text-white shadow-2xl shadow-indigo-500/40">
              Analyse my idea
            </span>
            <p className="mt-24 text-[52px] font-semibold tracking-tight text-slate-200">hadidea.com</p>
          </div>
        </SlideShell>
      ),
    },
  ],
}
