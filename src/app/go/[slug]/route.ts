import { createServiceClient, createDbClient } from '@/lib/db'
import { NextResponse, type NextRequest } from 'next/server'

// The redirect + click-logging path. Runs on Node.js (service-role client).
// No auth required — anyone (signed-in or not) may follow an affiliate link.
export const runtime = 'nodejs'

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const home = new URL('/', request.nextUrl.origin)

  // Service role: affiliate_clicks is service-role-only, and we look links up
  // by slug regardless of the caller's session.
  const service = createServiceClient()

  const { data: link } = await service
    .from('affiliate_links')
    .select('id, target_url, active')
    .eq('slug', slug)
    .maybeSingle()

  // Unknown or deactivated slug → send them home rather than erroring.
  if (!link || !link.active) {
    return NextResponse.redirect(home, { status: 302 })
  }

  // Best-effort click logging — a logging failure must NEVER block the redirect.
  try {
    const ctx = request.nextUrl.searchParams.get('ctx')
    const referrerPath = request.nextUrl.searchParams.get('rp')

    // Optional signed-in user id (never required). Read via the cookie client;
    // swallow any failure so an auth hiccup can't stop the redirect.
    let userId: string | null = null
    try {
      const supabase = await createDbClient()
      const { data: { user } } = await supabase.auth.getUser()
      userId = user?.id ?? null
    } catch {
      userId = null
    }

    await service.from('affiliate_clicks').insert({
      link_id: link.id,
      context: ctx ? ctx.slice(0, 200) : null,
      user_id: userId,
      referrer_path: referrerPath ? referrerPath.slice(0, 500) : null,
    })
  } catch (err) {
    console.error('affiliate click logging failed (redirect proceeds):', err)
  }

  return NextResponse.redirect(link.target_url, { status: 302 })
}
