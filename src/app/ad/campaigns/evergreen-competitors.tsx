import {
  AdRing,
  CtaSlide,
  RedactedCompetitorRow,
  SlideShell,
  type Slide,
} from '../slide-kit'

// ── Evergreen campaign: the competitor reframe ───────────────────────────
// Angle: "I googled my idea and someone's already doing it" is the moment
// most ideas die — and it's exactly the moment the report's market_proof /
// your_edge sections were built for. No offer, no pricing: runs forever.

export const EVERGREEN_COMPETITORS: { name: string; purpose: string; slides: Slide[] } = {
  name: 'Evergreen — “it already exists”',
  purpose: 'Competitor reframe for founders who found their idea "already taken". No offer — runs forever. Slides 1–3 are HOOK VARIANTS: use exactly one per cut.',
  slides: [
    {
      title: 'Hook A — good.',
      node: (
        <SlideShell>
          <div className="flex flex-1 flex-col justify-center">
            <p className="text-[46px] font-medium text-slate-400">Googled your idea and found</p>
            <p className="mt-2 text-[46px] font-medium text-slate-400">someone already doing it?</p>
            <h1 className="mt-16 text-[130px] font-bold leading-none tracking-tight">
              <span className="gradient-text">Good.</span>
            </h1>
          </div>
        </SlideShell>
      ),
    },
    {
      title: 'Hook B — the idea killer',
      node: (
        <SlideShell>
          <div className="flex flex-1 flex-col justify-center">
            <h1 className="text-[92px] font-bold leading-[1.12] tracking-tight">
              &ldquo;It&rsquo;s already been done&rdquo; has killed more good ideas than <span className="gradient-text">competition ever has.</span>
            </h1>
            <p className="mt-16 text-[40px] leading-snug text-slate-300">
              Competitors are proof of demand — not a closed door.
            </p>
          </div>
        </SlideShell>
      ),
    },
    {
      title: 'Hook C — every market has a gap',
      node: (
        <SlideShell>
          <div className="flex flex-1 flex-col justify-center">
            <p className="text-[50px] font-medium text-slate-400">Every crowded market has a gap.</p>
            <h1 className="mt-14 text-[96px] font-bold leading-[1.1] tracking-tight">
              The winners are the ones who <span className="gradient-text">know where it is.</span>
            </h1>
          </div>
        </SlideShell>
      ),
    },
    {
      title: 'Reframe',
      node: (
        <SlideShell>
          <div className="flex flex-1 flex-col justify-center">
            <h2 className="text-[80px] font-bold leading-[1.15] tracking-tight">
              Competitors mean people <span className="gradient-text">already pay</span> for it.
            </h2>
            <p className="mt-16 text-[42px] leading-snug text-slate-300">
              Demand is proven. That&rsquo;s the hard part.
            </p>
            <p className="mt-8 text-[42px] leading-snug text-slate-300">
              The real question is the <span className="font-semibold text-white">gap they&rsquo;re leaving open</span> — and whether you can own it.
            </p>
          </div>
        </SlideShell>
      ),
    },
    {
      title: 'The gap map',
      node: (
        <SlideShell>
          <div className="flex flex-1 flex-col justify-center">
            <h2 className="text-[76px] font-bold leading-tight tracking-tight">
              We map every competitor&rsquo;s <span className="gradient-text">weak spot.</span>
            </h2>
            <div className="mt-16 space-y-6 wide:mt-9 wide:space-y-5">
              <RedactedCompetitorRow price="$34/box" gap="no delivery" />
              <RedactedCompetitorRow price="$79/mo" gap="daytime hours only" />
              <RedactedCompetitorRow price="$50/job" gap="books out 3 weeks" />
              <RedactedCompetitorRow price="$120/session" gap="no beginner tier" />
            </div>
            <p className="mt-12 text-[32px] leading-snug text-slate-400 wide:mt-7">
              Names, prices, and positioning — from live research on your actual market, not a template.
            </p>
          </div>
        </SlideShell>
      ),
    },
    {
      title: 'Edge strength',
      node: (
        <SlideShell>
          <div className="flex flex-1 flex-col justify-center">
            <h2 className="text-[76px] font-bold leading-tight tracking-tight">
              Then we score <span className="gradient-text">your edge.</span>
            </h2>
            <div className="mt-16 flex items-center gap-12 rounded-3xl border border-white/10 bg-slate-900/90 p-12 wide:mt-9 wide:p-10">
              <AdRing score={68} label="Edge strength" size={170} />
              <p className="flex-1 text-[30px] leading-normal text-slate-300">
                &ldquo;Dawn junior-sport and parkrun venues are structurally ignored by every
                fitted-van operator found — a clear underserved niche, though it is not yet
                defended against a copycat cart.&rdquo;
              </p>
            </div>
            <p className="mt-12 text-[34px] leading-snug text-slate-400 wide:mt-7">
              And if your idea has no real edge yet, the report says so — and names the smallest
              change that would create one.
            </p>
          </div>
        </SlideShell>
      ),
    },
    {
      title: 'CTA',
      node: (
        <CtaSlide
          headline={<>Find the gap <span className="gradient-text">you can own.</span></>}
          button="Analyse my idea"
        />
      ),
    },
  ],
}
