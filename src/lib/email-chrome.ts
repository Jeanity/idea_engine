import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { getSetting, setSetting } from '@/lib/app-settings'

// Admin-editable email header/footer text (Danny, 2026-07-10). Only the
// TEXT is editable — the shell layout, links row (site/contact/privacy) and
// © year stay fixed in buildEmail (src/lib/mailer.ts) so the HTML remains
// email-client-safe (inline styles, no images). Values are plain text and
// are HTML-escaped at render time; an EMPTY signature or footer note means
// "omit that line". Stored in app_settings (service-role only, no
// migration needed) — read failures of any kind fall back to the defaults,
// so email sending can never break on a bad/missing setting.

export const EMAIL_CHROME_KEY = 'email_chrome'

export interface EmailChrome {
  /** Header wordmark text — also used in the © line. Required. */
  header_title: string
  /** Sign-off line above the footer links. Empty = omitted. */
  signature: string
  /** Muted last line ("you're receiving this because…"). Empty = omitted. */
  footer_note: string
}

export const DEFAULT_EMAIL_CHROME: EmailChrome = {
  header_title: 'Idea Engine',
  signature: '— The Idea Engine team',
  footer_note: "You're receiving this because of activity on your Idea Engine account.",
}

export const CHROME_LIMITS = { header_title: 60, signature: 120, footer_note: 300 } as const

/**
 * Escapes admin-entered plain text for interpolation into email HTML.
 * Element-content escaping only (&, <, >, ") — chrome values are never
 * placed inside attributes, and leaving apostrophes alone keeps the default
 * output byte-identical to the pre-editable shell.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function readEmailChrome(service: SupabaseClient<Database>): Promise<EmailChrome> {
  const raw = await getSetting<Partial<EmailChrome>>(service, EMAIL_CHROME_KEY)
  if (!raw) return DEFAULT_EMAIL_CHROME
  // Stored strings win even when empty (empty = "omit this line") — but a
  // missing/blank header_title falls back, the wordmark can't be nothing.
  const headerTitle = typeof raw.header_title === 'string' ? raw.header_title.trim() : ''
  return {
    header_title: headerTitle || DEFAULT_EMAIL_CHROME.header_title,
    signature: typeof raw.signature === 'string' ? raw.signature.trim() : DEFAULT_EMAIL_CHROME.signature,
    footer_note: typeof raw.footer_note === 'string' ? raw.footer_note.trim() : DEFAULT_EMAIL_CHROME.footer_note,
  }
}

export async function writeEmailChrome(
  service: SupabaseClient<Database>,
  chrome: EmailChrome
): Promise<{ error: string | null }> {
  return setSetting(service, EMAIL_CHROME_KEY, chrome)
}

export type ChromeValidation = { chrome: EmailChrome } | { error: string }

/** Validates an admin PATCH body into a complete EmailChrome. */
export function validateEmailChrome(body: {
  header_title?: unknown
  signature?: unknown
  footer_note?: unknown
}): ChromeValidation {
  const header = typeof body.header_title === 'string' ? body.header_title.trim() : ''
  if (!header) return { error: 'Header title is required — it is the email wordmark and the © line.' }
  if (header.length > CHROME_LIMITS.header_title) {
    return { error: `Header title must be ${CHROME_LIMITS.header_title} characters or fewer.` }
  }

  const signature = typeof body.signature === 'string' ? body.signature.trim() : ''
  if (signature.length > CHROME_LIMITS.signature) {
    return { error: `Signature must be ${CHROME_LIMITS.signature} characters or fewer.` }
  }

  const footerNote = typeof body.footer_note === 'string' ? body.footer_note.trim() : ''
  if (footerNote.length > CHROME_LIMITS.footer_note) {
    return { error: `Footer note must be ${CHROME_LIMITS.footer_note} characters or fewer.` }
  }

  return { chrome: { header_title: header, signature, footer_note: footerNote } }
}
