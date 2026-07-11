import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SLIDES } from '../slides'
import { SlideFrame } from '../slide-frame'

// Internal ad-production pages — must never end up in search results.
export const metadata = {
  title: 'Ad slide — HadIdea (internal)',
  robots: { index: false, follow: false },
}

export function generateStaticParams() {
  return SLIDES.map((_, i) => ({ slide: String(i + 1) }))
}

export default async function AdSlidePage({ params }: { params: Promise<{ slide: string }> }) {
  const { slide } = await params
  const n = Number(slide)
  if (!Number.isInteger(n) || n < 1 || n > SLIDES.length) notFound()

  return (
    <>
      {/* Discreet nav, outside the 9:16 frame on anything wider than a phone —
          crops out of screenshots taken of the slide itself. */}
      <nav className="fixed left-3 top-3 z-50 flex items-center gap-3 rounded-lg bg-black/70 px-3 py-1.5 text-xs text-slate-400">
        <Link href="/ad" className="hover:text-white">index</Link>
        <span>{n}/{SLIDES.length} · {SLIDES[n - 1].title}</span>
        {n > 1 && <Link href={`/ad/free-launch/${n - 1}`} className="hover:text-white">← prev</Link>}
        {n < SLIDES.length && <Link href={`/ad/free-launch/${n + 1}`} className="hover:text-white">next →</Link>}
      </nav>
      <SlideFrame>{SLIDES[n - 1].node}</SlideFrame>
    </>
  )
}
