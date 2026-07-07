import { createServiceClient } from '@/lib/db'
import { AffiliatesClient, type AffiliateLinkRow } from './affiliates-client'

export const metadata = { title: 'Affiliates — Admin — Idea Engine' }

// Bucket clicks into 7d / 30d / all-time per link. Kept out of the component
// render body so the time read (Date.now) isn't flagged as impure-in-render.
function bucketClicks(clicks: { link_id: string; occurred_at: string }[]) {
  const now = Date.now()
  const DAY = 24 * 60 * 60 * 1000
  const counts = new Map<string, { d7: number; d30: number; all: number }>()
  for (const c of clicks) {
    const bucket = counts.get(c.link_id) ?? { d7: 0, d30: 0, all: 0 }
    bucket.all += 1
    const age = now - new Date(c.occurred_at).getTime()
    if (age <= 30 * DAY) bucket.d30 += 1
    if (age <= 7 * DAY) bucket.d7 += 1
    counts.set(c.link_id, bucket)
  }
  return counts
}

// This page lives under src/app/app/admin/, whose layout.tsx already gates on
// isAdminEmail (redirects non-admins to /app before this ever renders). Reading
// all links + clicks via createServiceClient here is safe BECAUSE that gate
// already ran — never fetch with the service client before it.

export default async function AdminAffiliatesPage() {
  const service = createServiceClient()

  const { data: links } = await service
    .from('affiliate_links')
    .select('id, slug, name, target_url, match_domains, match_terms, active, notes, created_at, updated_at')
    .order('created_at', { ascending: false })

  const rows = links ?? []

  // Per-link click counts (7d / 30d / all-time). Volume is low; fetch the
  // (link_id, occurred_at) pairs once and bucket in JS rather than firing
  // three count queries per link.
  const { data: clicks } = await service
    .from('affiliate_clicks')
    .select('link_id, occurred_at')

  const counts = bucketClicks(clicks ?? [])

  const enriched: AffiliateLinkRow[] = rows.map(link => ({
    ...link,
    clicks: counts.get(link.id) ?? { d7: 0, d30: 0, all: 0 },
  }))

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white light:text-gray-900 mb-1">Affiliate links</h1>
      <p className="text-sm text-slate-400 light:text-gray-500 mb-8 max-w-2xl">
        Report URLs on a partner&rsquo;s domain are swapped for a <code className="text-slate-300 light:text-gray-700">/go/&lt;slug&gt;</code>{' '}
        tracking link at delivery time. Deactivate a link to stop rewriting it (old reports update on next view).
      </p>
      <AffiliatesClient initialLinks={enriched} />
    </div>
  )
}
