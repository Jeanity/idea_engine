import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh the session — required for Server Components to read auth state
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Protect all /app/* routes
  if (pathname.startsWith('/app') && !user) {
    const signInUrl = request.nextUrl.clone()
    signInUrl.pathname = '/sign-in'
    signInUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(signInUrl)
  }

  // Redirect signed-in users away from /sign-in
  if (pathname === '/sign-in' && user) {
    const appUrl = request.nextUrl.clone()
    appUrl.pathname = '/app'
    appUrl.search = ''
    return NextResponse.redirect(appUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Skip Next.js internals, static files, and image optimization
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
