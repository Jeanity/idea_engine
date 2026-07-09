// Formats a profile's identity for PUBLIC surfaces (homepage testimonials,
// feedback displays). Precedence: username (a handle the user chose to be
// public) beats display_name (free text — consent copy promises "first name
// and last initial only" for THIS field, so it's the one place that promise
// is enforced) beats the given fallback. No caller should ever render
// profile.display_name directly on a public page.

/**
 * `username` "jdoe" -> "jdoe" (shown as-is — it's already a public handle).
 * Else `displayName` "Jane Doe" -> "Jane D.", "Jane" -> "Jane",
 * "Jane van Doe" -> "Jane D.". Else the given fallback.
 */
export function toPublicDisplayName(
  username: string | null | undefined,
  displayName: string | null | undefined,
  fallback = 'Verified founder'
): string {
  const uname = (username ?? '').trim()
  if (uname) return uname

  const trimmed = (displayName ?? '').trim()
  if (!trimmed) return fallback
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return parts[0]
  const first = parts[0]
  const lastInitial = parts[parts.length - 1][0]
  return `${first} ${lastInitial}.`
}
