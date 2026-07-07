import { createDbClient, createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { NextResponse, type NextRequest } from 'next/server'

// Powers the admin Sales tab (src/app/app/admin/sales/sales-client.tsx).
// The /app/admin layout gates the PAGE, not this API route — every admin
// route re-checks isAdminEmail itself, per project ground rules.
//
// Stripe isn't wired yet (Phase 5), so `purchases` will typically be empty —
// revenue/refunds render as $0 and that's expected, not an error state.

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Validates a yyyy-mm-dd param; falls back to today (UTC) if missing/invalid. */
function parseDateParam(value: string | null): string {
  if (value && ISO_DATE_RE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) {
    return value
  }
  return todayUTC()
}

/** Sums amount_cents grouped by currency (lowercased ISO code, e.g. "usd"). */
function sumByCurrency(rows: { amount_cents: number; currency: string }[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const row of rows) {
    const currency = row.currency.toLowerCase()
    out[currency] = (out[currency] ?? 0) + row.amount_cents
  }
  return out
}

export async function GET(request: NextRequest) {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  let from = parseDateParam(searchParams.get('from'))
  let to = parseDateParam(searchParams.get('to'))
  // Guard against an inverted range (e.g. a stale custom picker state).
  if (from > to) [from, to] = [to, from]

  const rangeStart = `${from}T00:00:00.000Z`
  const rangeEndExclusive = new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000).toISOString()

  // Only used AFTER the isAdminEmail check above, per project ground rules.
  const service = createServiceClient()

  const [revenueRes, refundsRes, reportsRes] = await Promise.all([
    service
      .from('purchases')
      .select('amount_cents, currency')
      .eq('status', 'complete')
      .gte('completed_at', rangeStart)
      .lt('completed_at', rangeEndExclusive),
    service
      .from('purchases')
      .select('amount_cents, currency')
      .eq('status', 'refunded')
      .gte('refunded_at', rangeStart)
      .lt('refunded_at', rangeEndExclusive),
    service
      .from('reports')
      .select('cost_usd')
      .gte('generation_completed_at', rangeStart)
      .lt('generation_completed_at', rangeEndExclusive),
  ])

  for (const [label, res] of [
    ['revenue', revenueRes],
    ['refunds', refundsRes],
    ['reports', reportsRes],
  ] as const) {
    if (res.error) console.error(`Admin sales: ${label} query failed:`, res.error)
  }

  // Empty/zero states render gracefully — every total below defaults to 0
  // rather than throwing if a query errors. This is expected pre-Stripe:
  // purchases will be empty and revenue/refunds are legitimately $0.
  const revenueByCurrency = sumByCurrency(revenueRes.data ?? [])
  const refundsByCurrency = sumByCurrency(refundsRes.data ?? [])

  // Currencies must not be summed across each other (a USD cent and a GBP
  // cent are not the same unit) — report per-currency, and separately call
  // out whichever currency dominates revenue for the single-number margin.
  const currencies = [...new Set([...Object.keys(revenueByCurrency), ...Object.keys(refundsByCurrency)])]
  const netByCurrency: Record<string, number> = {}
  for (const currency of currencies) {
    netByCurrency[currency] = (revenueByCurrency[currency] ?? 0) - (refundsByCurrency[currency] ?? 0)
  }

  // Dominant currency = whichever has the most revenue in the period; falls
  // back to 'usd' when there's no revenue at all yet (pre-Stripe default —
  // there's nothing to convert, so no caveat applies at $0).
  const primaryCurrency = currencies.length > 0
    ? currencies.reduce((a, b) => (revenueByCurrency[b] ?? 0) > (revenueByCurrency[a] ?? 0) ? b : a)
    : 'usd'
  const primaryNetCents = netByCurrency[primaryCurrency] ?? 0

  const reportRows = reportsRes.data ?? []
  const aiCostUsd = reportRows.reduce((sum, r) => sum + (r.cost_usd ?? 0), 0)
  const reportsWithCostCount = reportRows.length

  // Margin treats the dominant currency's net as USD-equivalent — a
  // simplification the UI must caveat whenever more than one currency (or a
  // non-USD dominant currency) is in play. Rounded to cents.
  const marginUsd = Math.round((primaryNetCents / 100 - aiCostUsd) * 100) / 100

  return NextResponse.json({
    range: { from, to },
    revenueByCurrency,
    refundsByCurrency,
    netByCurrency,
    primaryCurrency,
    multiCurrency: currencies.length > 1,
    aiCostUsd: Math.round(aiCostUsd * 10000) / 10000,
    reportsWithCostCount,
    marginUsd,
  })
}
