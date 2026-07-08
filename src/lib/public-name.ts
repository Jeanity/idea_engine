// Formats a profile's free-text display_name for PUBLIC surfaces (homepage
// testimonials). Consent copy promises "first name and last initial only" —
// this is the one place that promise is enforced, so no caller should ever
// render profile.display_name directly on a public page.

/**
 * "Jane Doe" -> "Jane D.", "Jane" -> "Jane", "Jane van Doe" -> "Jane v.",
 * null/blank -> the given fallback.
 */
export function toPublicDisplayName(name: string | null | undefined, fallback = 'Verified founder'): string {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return fallback
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return parts[0]
  const first = parts[0]
  const lastInitial = parts[parts.length - 1][0]
  return `${first} ${lastInitial}.`
}
