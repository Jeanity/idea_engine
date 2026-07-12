import Link from 'next/link'
import { CAMPAIGNS } from './campaigns'

// Internal ad-production index — unlisted (no nav links to it) and noindexed.
export const metadata = {
  title: { absolute: 'Ad studio — HadIdea (internal)' },
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
          Slide frames for the slideshow video app. Every slide exists in three formats: 9:16
          (1080×1920 — Reels, TikTok, Shorts), 16:9 (1920×1080 — YouTube), and 1:1 (1080×1080 —
          Instagram/Facebook feed). All scale to fit your window, and each slide page has format
          switch links in its corner nav.
        </p>

        <div className="mt-6 rounded-xl border border-white/10 bg-slate-900/80 px-5 py-4 text-sm text-slate-300">
          <p className="font-semibold text-white">Capturing pixel-perfect frames</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-400">
            <li>Open a slide, press F12 → device toolbar (Ctrl+Shift+M).</li>
            <li>Set dimensions to <span className="text-slate-200">1080 × 1920</span> (9:16), <span className="text-slate-200">1920 × 1080</span> (16:9), or <span className="text-slate-200">1080 × 1080</span> (1:1) — the slide renders pixel-exact.</li>
            <li>Ctrl+Shift+P → &ldquo;Capture screenshot&rdquo; saves the frame as a PNG.</li>
            <li>Repeat per slide, then drop the PNGs into the slideshow app in order.</li>
          </ol>
          <p className="mt-2 text-slate-500">
            Quick-and-dirty alternative: screenshot the fitted view in any window — the frame is
            always fully visible.
          </p>
        </div>

        <section className="mt-10">
          <h2 className="text-lg font-semibold">Brand assets</h2>
          <p className="mt-1 text-sm text-slate-400">
            Social profile art — capture at the stated size (same devtools workflow as slides).
          </p>
          <ul className="mt-4 space-y-2">
            <li>
              <Link href="/ad/assets/facebook-profile" className="flex items-center gap-4 rounded-lg border border-white/10 bg-slate-900/60 px-4 py-3 transition-colors hover:border-indigo-400/50 hover:bg-slate-900">
                <span className="flex-1 text-sm font-medium text-slate-200">Facebook profile picture</span>
                <span className="font-mono text-xs text-slate-500">1080×1080 · shown as a circle</span>
              </Link>
            </li>
            <li>
              <Link href="/ad/assets/facebook-cover" className="flex items-center gap-4 rounded-lg border border-white/10 bg-slate-900/60 px-4 py-3 transition-colors hover:border-indigo-400/50 hover:bg-slate-900">
                <span className="flex-1 text-sm font-medium text-slate-200">Facebook page cover</span>
                <span className="font-mono text-xs text-slate-500">1640×624 · content centred for mobile crop</span>
              </Link>
            </li>
          </ul>
        </section>

        {Object.entries(CAMPAIGNS).map(([slug, c]) => (
          <section key={slug} className="mt-10">
            <h2 className="text-lg font-semibold">{c.name}</h2>
            <p className="mt-1 text-sm text-slate-400">{c.purpose}</p>
            <ul className="mt-4 space-y-2">
              {c.slides.map((s, i) => (
                <li key={s.title} className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/60 px-4 py-3">
                  <span className="w-8 text-right font-mono text-sm text-slate-500">{String(i + 1).padStart(2, '0')}</span>
                  <span className="flex-1 text-sm font-medium text-slate-200">{s.title}</span>
                  <Link href={`/ad/${slug}/${i + 1}`} className="rounded border border-white/10 px-2.5 py-1 text-xs text-slate-300 transition-colors hover:border-indigo-400/50 hover:text-white">
                    9:16
                  </Link>
                  <Link href={`/ad/${slug}/${i + 1}?format=wide`} className="rounded border border-white/10 px-2.5 py-1 text-xs text-slate-300 transition-colors hover:border-indigo-400/50 hover:text-white">
                    16:9
                  </Link>
                  <Link href={`/ad/${slug}/${i + 1}?format=square`} className="rounded border border-white/10 px-2.5 py-1 text-xs text-slate-300 transition-colors hover:border-indigo-400/50 hover:text-white">
                    1:1
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
