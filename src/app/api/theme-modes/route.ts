import { createServiceClient } from '@/lib/db'
import { readSmexyConfig } from '@/lib/smexy'
import { NextResponse } from 'next/server'

// Public, unauthenticated: ThemeToggle asks this on mount to learn whether
// the smexy theme is offered. Only ever exposes the boolean — the service
// client reads a single app-global flag (app_settings has no RLS policies,
// same pattern as the promo badge in app-header).
export async function GET() {
  const { enabled } = await readSmexyConfig(createServiceClient())
  return NextResponse.json(
    { smexy: enabled },
    { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' } }
  )
}
