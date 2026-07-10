import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/db'

// First-touch attribution: copy this visitor's earliest analytics event
// (referrer/utm/landing_path) into profiles.acquisition, once, at signup. The
// visitor id lives in the ie_vid cookie set by the tracking beacon; the event
// log (page_events) is the durable source of truth. Best-effort — never blocks
// the redirect.
async function captureAcquisition(userId: string, visitorId: string | undefined) {
  if (!visitorId) return
  try {
    const service = createServiceClient()

    // Only set it once.
    const { data: profile } = await service
      .from('profiles')
      .select('acquisition')
      .eq('id', userId)
      .single()
    if (profile?.acquisition) return

    // Earliest event for this visitor = first touch.
    const { data: first } = await service
      .from('page_events')
      .select('referrer, utm, path')
      .eq('visitor_id', visitorId)
      .order('occurred_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (!first) return

    await service
      .from('profiles')
      .update({
        acquisition: {
          referrer: first.referrer ?? null,
          utm: first.utm ?? null,
          landing_path: first.path ?? null,
        },
      })
      .eq('id', userId)
  } catch {
    // Attribution is best-effort; never block signup.
  }
}

// First-login redirect: a user with no profiles.username set hasn't finished
// onboarding, so send them to Settings to add it instead of wherever `next`
// points. Best-effort — any query failure falls back to `next` rather than
// blocking sign-in.
async function needsUsername(userId: string): Promise<boolean> {
  try {
    const service = createServiceClient()
    const { data: profile, error } = await service
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single()
    if (error) return false
    return !profile?.username
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // Fallback mirrors sign-in-form.tsx's default: land on the account page.
  const next = searchParams.get('next') ?? '/app/account'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      if (data.user) {
        await captureAcquisition(data.user.id, cookieStore.get('ie_vid')?.value)
        if (await needsUsername(data.user.id)) {
          return NextResponse.redirect(`${origin}/app/account/settings?welcome=1`)
        }
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth_callback_failed`)
}
