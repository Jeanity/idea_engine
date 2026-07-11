import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CAMPAIGNS } from '../../campaigns'
import { SlideFrame } from '../../slide-frame'

// Internal ad-production pages — must never end up in search results.
export const metadata = {
  title: 'Ad slide — HadIdea (internal)',
  robots: { index: false, follow: false },
}

export default async function AdSlidePage({
  params,
  searchParams,
}: {
  params: Promise<{ campaign: string; slide: string }>
  searchParams: Promise<{ wide?: string }>
}) {
  const { campaign, slide } = await params
  const { wide: wideParam } = await searchParams
  const wide = wideParam === '1'
  const c = CAMPAIGNS[campaign]
  const n = Number(slide)
  if (!c || !Number.isInteger(n) || n < 1 || n > c.slides.length) notFound()

  return (
    <>
      {/* Discreet nav, outside the frame on most window shapes — crops out of
          screenshots taken of the slide itself. */}
      <nav className="fixed left-3 top-3 z-50 flex items-center gap-3 rounded-lg bg-black/70 px-3 py-1.5 text-xs text-slate-400">
        <Link href="/ad" className="hover:text-white">index</Link>
        <span>{c.name} · {n}/{c.slides.length} · {c.slides[n - 1].title}</span>
        {n > 1 && <Link href={`/ad/${campaign}/${n - 1}${wide ? '?wide=1' : ''}`} className="hover:text-white">← prev</Link>}
        {n < c.slides.length && <Link href={`/ad/${campaign}/${n + 1}${wide ? '?wide=1' : ''}`} className="hover:text-white">next →</Link>}
        <Link href={`/ad/${campaign}/${n}${wide ? '' : '?wide=1'}`} className="text-indigo-300 hover:text-white">
          {wide ? 'switch to 9:16' : 'switch to 16:9'}
        </Link>
      </nav>
      <SlideFrame wide={wide}>
        {/* data-orient drives the wide: Tailwind variant (globals.css) inside
            every slide — one slide source, two formats. */}
        <div className="h-full w-full" data-orient={wide ? 'wide' : undefined}>
          {c.slides[n - 1].node}
        </div>
      </SlideFrame>
    </>
  )
}
