// Slide format table — deliberately NOT a 'use client' module: the slide
// route (a server component) reads FORMAT_DIMS at render time, and non-
// component exports of a client module arrive there as client-reference
// proxies in production builds (undefined lookups → 500s), even though dev
// resolves them. Both the server route and the client SlideFrame import
// from here.

export type SlideFormat = 'tall' | 'wide' | 'square'

export const FORMAT_DIMS: Record<SlideFormat, { w: number; h: number; label: string }> = {
  tall: { w: 1080, h: 1920, label: '9:16' },
  wide: { w: 1920, h: 1080, label: '16:9' },
  square: { w: 1080, h: 1080, label: '1:1' },
}
