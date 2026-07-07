// ADMIN_EMAIL accepts a single address or a comma-separated list
// ("a@x.com,b@y.com") so more than one account can be an admin.
// Matching is case-insensitive; whitespace around entries is ignored.
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const admins = (process.env.ADMIN_EMAIL ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
  return admins.includes(email.toLowerCase())
}
