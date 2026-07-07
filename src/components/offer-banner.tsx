import { formatDiscount } from '@/lib/offers'

export interface BannerOffer {
  id: string
  code: string
  description: string
  percent_off: number | null
  amount_off_cents: number | null
}

/**
 * Shared slim banner used by both the homepage (signed-out) and the account
 * page (signed-in) to surface a live offer. Callers are responsible for the
 * live + audience filtering — this component only renders what it's given.
 */
export function OfferBanners({ offers }: { offers: BannerOffer[] }) {
  if (offers.length === 0) return null

  return (
    <div className="space-y-2">
      {offers.map(offer => {
        const discount = formatDiscount(offer)
        return (
          <div
            key={offer.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-indigo-400/30 bg-gradient-to-r from-indigo-500/15 to-violet-500/15 px-4 py-3 text-sm light:border-indigo-200 light:from-indigo-50 light:to-violet-50"
          >
            <code className="shrink-0 rounded bg-white/10 px-2 py-0.5 text-xs font-semibold text-indigo-200 light:bg-indigo-100 light:text-indigo-700">
              {offer.code}
            </code>
            {discount && (
              <span className="shrink-0 text-xs font-semibold text-indigo-200 light:text-indigo-700">{discount}</span>
            )}
            <span className="text-slate-200 light:text-gray-700">{offer.description}</span>
          </div>
        )
      })}
    </div>
  )
}
