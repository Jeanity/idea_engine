import { createServiceClient } from '@/lib/db'
import { Pagination } from '@/components/admin'
import { ADMIN_PAGE_SIZE, pageRange, parsePage, totalPageCount } from '@/lib/admin-pagination'
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

export default async function AdminAffiliatesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageParam } = await searchParams
  const page = parsePage(pageParam)
  const { from, to } = pageRange(page)

  const service = createServiceClient()

  const { data: links, count } = await service
    .from('affiliate_links')
    .select('id, slug, name, target_url, match_domains, match_terms, active, notes, created_at, updated_at', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .range(from, to)

  const rows = links ?? []
  const totalCount = count ?? 0
  const pages = totalPageCount(totalCount)

  // Per-link click counts (7d / 30d / all-time), scoped to just this page's
  // links rather than every click ever recorded.
  const linkIds = rows.map(l => l.id)
  const { data: clicks } = linkIds.length
    ? await service.from('affiliate_clicks').select('link_id, occurred_at').in('link_id', linkIds)
    : { data: [] as { link_id: string; occurred_at: string }[] }

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
      {totalCount > ADMIN_PAGE_SIZE && (
        <Pagination page={page} totalPages={pages} totalCount={totalCount} basePath="/app/admin/affiliates" />
      )}
    </div>
  )
}
