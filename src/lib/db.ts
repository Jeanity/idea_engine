import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/** Server client — reads the auth cookie, respects RLS. Use in Server Components and Route Handlers. */
export async function createDbClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Called from a Server Component — cookie writes are ignored, session reads still work.
        }
      },
    },
  })
}

/** Service-role client — bypasses RLS. Server-only (Inngest workers, Stripe webhooks). Never expose to the browser. */
export function createServiceClient() {
  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Stateless anon client — respects RLS as the anon role, no user session.
 * Use for server-rendered public pages that read data with no signed-in user
 * (e.g. homepage testimonials via the "public select featured" policy on
 * report_feedback). Never use this for owner-scoped or admin data — it can
 * only ever see what RLS explicitly grants to anon.
 */
export function createPublicClient() {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
