import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CAMPAIGNS } from '../../campaigns'
import { SlideFrame } from '../../slide-frame'
import { FORMAT_DIMS, type SlideFormat } from '../../slide-formats'

// Internal ad-production pages — must never end up in search results.
export const metadata = {
  title: { absolute: 'Ad slide — HadIdea (internal)' },
  robots: { index: false, follow: false },
}

function parseFormat(searchParams: { format?: string; wide?: string }): SlideFormat {
  if (searchParams.format === 'wide' || searchParams.wide === '1') return 'wide'
  if (searchParams.format === 'square') return 'square'
  return 'tall'
}

export default async function AdSlidePage({
  params,
  searchParams,
}: {
  params: Promise<{ campaign: string; slide: string }>
  searchParams: Promise<{ format?: string; wide?: string }>
}) {
  const { campaign, slide } = await params
  const format = parseFormat(await searchParams)
  const c = CAMPAIGNS[campaign]
  const n = Number(slide)
  if (!c || !Number.isInteger(n) || n < 1 || n > c.slides.length) notFound()

  const query = format === 'tall' ? '' : `?format=${format}`
  const others = (['tall', 'wide', 'square'] as const).filter(f => f !== format)

  return (
    <>
      {/* Discreet nav, outside the frame on most window shapes — crops out of
          screenshots taken of the slide itself. */}
      <nav className="fixed left-3 top-3 z-50 flex items-center gap-3 rounded-lg bg-black/70 px-3 py-1.5 text-xs text-slate-400">
        <Link href="/ad" className="hover:text-white">index</Link>
        <span>{c.name} · {n}/{c.slides.length} · {c.slides[n - 1].title} · {FORMAT_DIMS[format].label}</span>
        {n > 1 && <Link href={`/ad/${campaign}/${n - 1}${query}`} className="hover:text-white">← prev</Link>}
        {n < c.slides.length && <Link href={`/ad/${campaign}/${n + 1}${query}`} className="hover:text-white">next →</Link>}
        {others.map(f => (
          <Link key={f} href={`/ad/${campaign}/${n}${f === 'tall' ? '' : `?format=${f}`}`} className="text-indigo-300 hover:text-white">
            {FORMAT_DIMS[f].label}
          </Link>
        ))}
      </nav>
      <SlideFrame format={format}>
        {/* data-orient drives the wide:/square:/short: Tailwind variants
            (globals.css) inside every slide — one slide source, three formats. */}
        <div className="h-full w-full" data-orient={format === 'tall' ? undefined : format}>
          {c.slides[n - 1].node}
        </div>
      </SlideFrame>
    </>
  )
}
