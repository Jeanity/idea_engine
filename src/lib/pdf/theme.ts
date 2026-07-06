import { StyleSheet } from '@react-pdf/renderer'

// Professional report palette — light background only (this is a downloadable
// deliverable, never the dark app theme). No red anywhere, matching the
// product's "no bad ideas" stance carried over from the on-screen score rings.
export const COLORS = {
  ink: '#0f172a',        // headings
  body: '#334155',       // paragraph text
  muted: '#64748b',      // captions, labels, footers
  faint: '#94a3b8',       // page numbers, watermark-level text
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',
  panel: '#f8fafc',       // subtle card background
  accent: '#4f46e5',      // indigo-600 — brand, links, priority badges
  accentSoft: '#eef2ff',
  positive: '#059669',    // emerald-600 — "why this works" / budget / wins
  positiveSoft: '#ecfdf5',
  warning: '#b45309',     // amber-700 — compliance / estimate flags
  warningSoft: '#fffbeb',
  white: '#ffffff',
}

export const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 48,
    paddingHorizontal: 48,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: COLORS.body,
    backgroundColor: COLORS.white,
  },
  h1: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 22,
    color: COLORS.ink,
  },
  h2: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 14,
    color: COLORS.ink,
    marginBottom: 10,
  },
  h3: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    color: COLORS.ink,
  },
  eyebrow: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: COLORS.accent,
    letterSpacing: 1.2,
  },
  body: {
    fontSize: 10,
    color: COLORS.body,
    lineHeight: 1.5,
  },
  caption: {
    fontSize: 8.5,
    color: COLORS.muted,
    lineHeight: 1.4,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginVertical: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    padding: 14,
    marginBottom: 10,
    backgroundColor: COLORS.white,
  },
  cardMuted: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    padding: 12,
    backgroundColor: COLORS.panel,
    marginBottom: 8,
  },
  calloutPositive: {
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 6,
    padding: 12,
    backgroundColor: COLORS.positiveSoft,
  },
  calloutAccent: {
    borderWidth: 1,
    borderColor: '#c7d2fe',
    borderRadius: 6,
    padding: 12,
    backgroundColor: COLORS.accentSoft,
  },
  calloutWarning: {
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 6,
    padding: 12,
    backgroundColor: COLORS.warningSoft,
  },
  link: {
    color: COLORS.accent,
    // Underlined always, not just accent-colored — the same accent color is
    // used for headings/eyebrows elsewhere, so color alone doesn't read as
    // "clickable" in a static document with no hover state.
    textDecoration: 'underline',
  },
  row: {
    flexDirection: 'row',
  },
  spaceBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7.5,
    color: COLORS.faint,
  },
})
