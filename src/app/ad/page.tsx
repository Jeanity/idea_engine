import Link from 'next/link'
import { CAMPAIGNS } from './campaigns'

// Internal ad-production index — unlisted (no nav links to it) and noindexed.
export const metadata = {
  title: 'Ad studio — HadIdea (internal)',
  robots: { index: false, follow: false },
}

export default function AdStudioPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-8 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <span className="inline-flex items-center rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold tracking-wide text-amber-200">
          INTERNAL — AD PRODUCTION
        </span>
        <h1 className="mt-4 text-3xl font-bold">Ad studio</h1>
        <p className="mt-2 text-sm text-slate-400">
          Slide frames for the slideshow video app. Each slide is a fixed 1080×1920 (9:16 — Reels,
          TikTok, Shorts) frame that scales to fit your window.
        </p>

        <div className="mt-6 rounded-xl border border-white/10 bg-slate-900/80 px-5 py-4 text-sm text-slate-300">
          <p className="font-semibold text-white">Capturing pixel-perfect frames</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-400">
            <li>Open a slide, press F12 → device toolbar (Ctrl+Shift+M).</li>
            <li>Set dimensions to <span className="text-slate-200">1080 × 1920</span> — the slide renders at exactly 1:1.</li>
            <li>Ctrl+Shift+P → &ldquo;Capture screenshot&rdquo; saves the frame as a PNG.</li>
            <li>Repeat per slide, then drop the PNGs into the slideshow app in order.</li>
          </ol>
          <p className="mt-2 text-slate-500">
            Quick-and-dirty alternative: screenshot the fitted view in any window — the frame is
            always fully visible.
          </p>
        </div>

        {Object.entries(CAMPAIGNS).map(([slug, c]) => (
          <section key={slug} className="mt-10">
            <h2 className="text-lg font-semibold">{c.name}</h2>
            <p className="mt-1 text-sm text-slate-400">{c.purpose}</p>
            <ul className="mt-4 space-y-2">
              {c.slides.map((s, i) => (
                <li key={s.title}>
                  <Link
                    href={`/ad/${slug}/${i + 1}`}
                    className="flex items-center gap-4 rounded-lg border border-white/10 bg-slate-900/60 px-4 py-3 transition-colors hover:border-indigo-400/50 hover:bg-slate-900"
                  >
                    <span className="w-8 text-right font-mono text-sm text-slate-500">{String(i + 1).padStart(2, '0')}</span>
                    <span className="text-sm font-medium text-slate-200">{s.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  )
}
