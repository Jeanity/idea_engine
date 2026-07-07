import { View, Text, Link, Svg, Path, Polyline, Line, Circle } from '@react-pdf/renderer'
import { COLORS, styles } from './theme'
import { bandFor } from '@/lib/score-bands'

// ── Page chrome ─────────────────────────────────────────────────

export function PageFooter({ reportTitle }: { reportTitle: string }) {
  return (
    <View style={{ position: 'absolute', bottom: 20, left: 48, right: 48 }} fixed>
      {/* FTC/ASA affiliate disclosure — shown unconditionally wherever rewritten
          links can render (report URLs may be affiliate /go/ links). */}
      <Text style={[styles.footerText, { marginBottom: 4 }]}>
        Some links in this report may be affiliate links. They never affect our recommendations.
      </Text>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          paddingTop: 8,
        }}
      >
        <Text style={styles.footerText}>{reportTitle}</Text>
        <Text
          style={styles.footerText}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        />
      </View>
    </View>
  )
}

export function SectionHeading({ eyebrow, title, id }: { eyebrow: string; title: string; id?: string }) {
  return (
    <View style={{ marginBottom: 14 }} id={id}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={[styles.h1, { fontSize: 17, marginTop: 3 }]}>{title}</Text>
    </View>
  )
}

// ── Cards & callouts ─────────────────────────────────────────────

export function Card({ children, wrap = false }: { children: React.ReactNode; wrap?: boolean }) {
  return <View style={styles.card} wrap={wrap}>{children}</View>
}

export function Callout({
  tone,
  label,
  children,
}: {
  tone: 'positive' | 'accent' | 'warning'
  label?: string
  children: React.ReactNode
}) {
  const style = tone === 'positive' ? styles.calloutPositive : tone === 'warning' ? styles.calloutWarning : styles.calloutAccent
  const labelColor = tone === 'positive' ? COLORS.positive : tone === 'warning' ? COLORS.warning : COLORS.accent
  return (
    <View style={style} wrap={false}>
      {label && (
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8, color: labelColor, letterSpacing: 0.6, marginBottom: 4 }}>
          {label.toUpperCase()}
        </Text>
      )}
      {children}
    </View>
  )
}

// ── Badges ───────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, { bg: string; fg: string }> = {
  required: { bg: '#fde68a', fg: '#78350f' },
  recommended: { bg: COLORS.accentSoft, fg: COLORS.accent },
  fyi: { bg: COLORS.panel, fg: COLORS.muted },
}

export function SeverityBadge({ severity }: { severity: string }) {
  const c = SEVERITY_COLORS[severity] ?? SEVERITY_COLORS.fyi
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: 8, paddingVertical: 2, paddingHorizontal: 6 }}>
      <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: c.fg }}>{severity.toUpperCase()}</Text>
    </View>
  )
}

export function TypeBadge({ label, tone }: { label: string; tone: 'positive' | 'accent' }) {
  const bg = tone === 'positive' ? COLORS.positiveSoft : COLORS.accentSoft
  const fg = tone === 'positive' ? COLORS.positive : COLORS.accent
  return (
    <View style={{ backgroundColor: bg, borderRadius: 8, paddingVertical: 2, paddingHorizontal: 6 }}>
      <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: fg }}>{label.toUpperCase()}</Text>
    </View>
  )
}

// ── Score donut (headline 0–100 score) ─────────────────────────────
//
// Mirrors the web ScoreRing (src/components/score-ring.tsx) visually, using
// the same color bands, but built with react-pdf's static SVG primitives —
// no CSS animation, and no strokeDashoffset (react-pdf's SVG presentation
// attributes don't expose it), so the "partial ring" trick here is a single
// dash of length `arc` followed by a gap covering the rest of the
// circumference, rotated -90° to start at 12 o'clock — same visual result,
// achievable with strokeDasharray alone.
//
// The track uses band.color + a separate `opacity` prop rather than
// band.trackColor's rgba(...) string — react-pdf's stroke parser doesn't
// handle rgba() and silently falls back to a visible orange "something's
// wrong" color, which looked like a real (very confusing) track color.
export function ScoreDonut({ score, size = 44 }: { score: number; size?: number }) {
  const band = bandFor(score)
  const strokeWidth = size * 0.14
  const radius = (size - strokeWidth) / 2
  const c = size / 2
  const circumference = 2 * Math.PI * radius
  const arc = circumference * (Math.max(0, Math.min(100, score)) / 100)

  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={c} cy={c} r={radius} fill="none" stroke={band.color} opacity={0.15} strokeWidth={strokeWidth} />
        <Circle
          cx={c}
          cy={c}
          r={radius}
          fill="none"
          stroke={band.color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${circumference}`}
          transform={`rotate(-90 ${c} ${c})`}
        />
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: size * 0.32, fontFamily: 'Helvetica-Bold', color: COLORS.ink }}>{score}</Text>
      </View>
    </View>
  )
}

// ── Score bar (viability snapshot) ────────────────────────────────

export function ScoreBar({ label, score, rationale }: { label: string; score: number; rationale: string }) {
  const pct = Math.max(0, Math.min(5, score)) / 5 * 100
  return (
    <View style={{ marginBottom: 10 }} wrap={false}>
      <View style={[styles.spaceBetween, { marginBottom: 3 }]}>
        <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: COLORS.ink }}>{label}</Text>
        <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: COLORS.accent }}>{score}/5</Text>
      </View>
      <View style={{ height: 5, backgroundColor: COLORS.border, borderRadius: 3, marginBottom: 4 }}>
        <View style={{ height: 5, width: `${pct}%`, backgroundColor: COLORS.accent, borderRadius: 3 }} />
      </View>
      <Text style={styles.caption}>{rationale}</Text>
    </View>
  )
}

// ── Numbered list item (next steps, channels) ─────────────────────

export function NumberedRow({ n, children }: { n: number | string; children: React.ReactNode }) {
  return (
    <View style={[styles.row, { marginBottom: 10 }]} wrap={false}>
      <View
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: COLORS.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 8,
          marginTop: 1,
        }}
      >
        <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: COLORS.accent }}>{n}</Text>
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  )
}

// ── Key/value table row ────────────────────────────────────────────

export function KVRow({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={[styles.spaceBetween, { paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: COLORS.border }]} wrap={false}>
      {/* flex:1 + marginRight keeps a long line-item label (real AI output
          regularly runs a full clause, unlike short fixture labels) from
          overlapping the value column when it wraps to a second line. */}
      <Text style={{ flex: 1, marginRight: 8, fontSize: 9, color: bold ? COLORS.ink : COLORS.muted, fontFamily: bold ? 'Helvetica-Bold' : 'Helvetica' }}>{label}</Text>
      {/* maxWidth guards the rare long value (e.g. a parenthetical note) so
          it wraps on its own side instead of crushing the label back down. */}
      <Text style={{ maxWidth: '45%', fontSize: 9, color: COLORS.ink, fontFamily: bold ? 'Helvetica-Bold' : 'Helvetica', textAlign: 'right' }}>{value}</Text>
    </View>
  )
}

// Feather Icons' "external-link" glyph (MIT) — a box with an arrow breaking
// out of it, the standard "this opens elsewhere" indicator. Chosen over a
// chain-link glyph: straight lines stay crisp at the ~8px size a report
// needs, where a curved chain link would blur.
export function LinkIcon({ size = 8, color = COLORS.accent }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={{ marginLeft: 3 }}>
      <Path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Polyline points="15 3 21 3 21 9" stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1={10} y1={14} x2={21} y2={3} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  )
}

export function ExternalLink({ href, children, iconSize = 8 }: { href: string; children: React.ReactNode; iconSize?: number }) {
  return (
    <Link src={href}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* Raw string children (compliance/funding URLs passed as plain text)
            need styles.link applied here — pre-styled Text children (names
            with their own color/underline) pass through unchanged, since
            react-pdf doesn't cascade text style into nested custom Text. */}
        {typeof children === 'string' ? <Text style={[styles.link, { fontSize: 9 }]}>{children}</Text> : children}
        <LinkIcon size={iconSize} />
      </View>
    </Link>
  )
}

export function QuoteBlock({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: COLORS.panel,
        borderLeftWidth: 2,
        borderLeftColor: COLORS.accent,
        borderRadius: 3,
        padding: 10,
        marginBottom: 8,
      }}
      wrap={false}
    >
      <Text style={{ fontSize: 9.5, color: COLORS.ink, fontStyle: 'italic', lineHeight: 1.5 }}>{children}</Text>
    </View>
  )
}
