import { createServiceClient } from '@/lib/db'
import { Pagination } from '@/components/admin'
import { ADMIN_PAGE_SIZE, pageRange, parsePage, totalPageCount } from '@/lib/admin-pagination'
import { OffersClient, type OfferRow } from './offers-client'

export const metadata = { title: 'Offers — Admin — Idea Engine' }

// This page lives under src/app/app/admin/, whose layout.tsx already gates on
// isAdminEmail (redirects non-admins to /app before this ever renders). Reading
// all offers via createServiceClient here is safe BECAUSE that gate already
// ran — never fetch with the service client before it.

export default async function AdminOffersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageParam } = await searchParams
  const page = parsePage(pageParam)
  const { from, to } = pageRange(page)

  const service = createServiceClient()

  const { data: offers, count } = await service
    .from('offers')
    .select(
      'id, code, description, percent_off, amount_off_cents, audience, show_on_homepage, show_in_account, starts_at, ends_at, max_redemptions, redemption_count, active, stripe_promotion_code_id, created_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to)

  const rows: OfferRow[] = offers ?? []
  const totalCount = count ?? 0
  const pages = totalPageCount(totalCount)

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white light:text-gray-900 mb-1">Offers</h1>
      <p className="text-sm text-slate-400 light:text-gray-500 mb-8 max-w-2xl">
        Discount codes shown on the homepage and account page. This is display-only scaffolding —
        redemption and Stripe promotion codes plug in later; codes aren&rsquo;t enforced at checkout yet.
      </p>
      <OffersClient initialOffers={rows} />
      {totalCount > ADMIN_PAGE_SIZE && (
        <Pagination page={page} totalPages={pages} totalCount={totalCount} basePath="/app/admin/offers" />
      )}
    </div>
  )
}
