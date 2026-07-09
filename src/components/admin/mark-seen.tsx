'use client'

import { useEffect } from 'react'
import { ADMIN_NAV_SEEN_EVENT } from '@/lib/admin-nav-events'

type Section = 'contact' | 'feedback' | 'bugs' | 'errors'

/**
 * Fires POST /api/admin/nav-status/seen once on mount to record "I just
 * visited this section" on the caller's own profile (migration 023,
 * admin_seen). Mounted once on each of the four badge-bearing admin pages:
 * /app/admin/contact, /app/admin/feedback, /app/admin/bugs, /app/admin/errors.
 * Renders nothing. Fails silently — a failed mark-seen just means the badge
 * doesn't clear until the next real visit, never a user-facing error.
 *
 * See src/lib/admin-nav-events.ts for why this dispatches a window event
 * once the POST settles (closes a race with admin-shell's route-change
 * nav-status refetch).
 */
export function MarkSeen({ section }: { section: Section }) {
  useEffect(() => {
    let cancelled = false

    fetch('/api/admin/nav-status/seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section }),
    })
      .catch(() => {
        /* silent — badge simply won't clear until the next real visit */
      })
      .finally(() => {
        if (cancelled) return
        window.dispatchEvent(new Event(ADMIN_NAV_SEEN_EVENT))
      })

    return () => {
      cancelled = true
    }
  }, [section])

  return null
}
