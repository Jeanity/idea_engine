import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

// Public marketing pages only — the signed-in app, API, and internal ad
// studio are excluded here AND disallowed in robots.ts.
export default function sitemap(): MetadataRoute.Sitemap {
  const page = (
    path: string,
    priority: number,
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']
  ) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  })

  return [
    page('/', 1, 'weekly'),
    page('/sample-report', 0.9, 'weekly'),
    page('/about', 0.7, 'monthly'),
    page('/faq', 0.7, 'monthly'),
    page('/contact', 0.4, 'yearly'),
    page('/terms', 0.2, 'yearly'),
    page('/privacy', 0.2, 'yearly'),
  ]
}
