import { BulbMark, PixelFrame } from '../asset-kit'

// Facebook page cover — upload 1640×624 (2× of the 820×312 desktop crop).
// Mobile crops to the central ~1280px and desktop overlays the circular
// avatar bottom-left, so all content is centred and clear of that corner.
export const metadata = {
  title: { absolute: 'Facebook cover image — HadIdea (internal)' },
  robots: { index: false, follow: false },
}

export default function FacebookCoverAsset() {
  return (
    <PixelFrame w={1640} h={624} label="Facebook cover">
      <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-slate-950 text-center text-white">
        <div className="absolute inset-0 dot-grid opacity-40" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-indigo-600/30 blur-3xl" />
          <div className="absolute -bottom-48 -right-40 h-[520px] w-[520px] rounded-full bg-cyan-500/25 blur-3xl" />
          <div className="absolute left-1/3 top-[-160px] h-[380px] w-[380px] rounded-full bg-violet-600/25 blur-3xl" />
        </div>
        <div className="relative z-10 flex items-center gap-4">
          <span
            className="flex h-[56px] w-[56px] items-center justify-center rounded-xl"
            style={{ background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)' }}
          >
            <BulbMark size={44} />
          </span>
          <span className="text-[44px] font-bold tracking-tight">HadIdea</span>
        </div>
        <h1 className="relative z-10 mt-8 text-[78px] font-bold leading-tight tracking-tight">
          Have an idea? <span className="gradient-text">Let&rsquo;s make it real.</span>
        </h1>
        <p className="relative z-10 mt-6 text-[32px] text-slate-300">
          Real competitors. Real costs. Real plans — researched in minutes.
        </p>
        <p className="relative z-10 mt-6 text-[30px] font-semibold text-slate-400">hadidea.com</p>
      </div>
    </PixelFrame>
  )
}
