// Handling for the model's web-search citation markers.
//
// Search-enabled pipeline steps return text with <cite index="5-30,5-31">…</cite>
// wrapped around spans that are verbatim quotes from a search result. The index
// refers to that API call's transient result list (useless once stored), but the
// tagged span itself is a strong trust signal — so the pipeline stores the tags
// and the UI renders them as highlighted "quoted from a source" text
// (CitedText in report-client). The PDF and any plain-text surface strip them.

export interface CiteSegment {
  text: string
  cited: boolean
}

// Tag-name variants seen in the wild: Sonnet emits <cite …>…</cite>; Haiku
// garbles the internal antml:cite form into <ancite …>…</anite> (and can mix
// them, or leave a close tag unbalanced). Normalise every variant to plain
// <cite>/</cite> first, then split — stray/unbalanced tags are stripped.
const OPEN_VARIANTS = /<(?:antml:cite|ancite|anite|cite)\b[^>]*>/g
const CLOSE_VARIANTS = /<\/(?:antml:cite|ancite|anite|cite)\s*>/g
const CITE_SPAN = /(<cite>[\s\S]*?<\/cite>)/g
const CITE_TAG = /<\/?cite>/g

function normalizeCiteTags(s: string): string {
  return s.replace(OPEN_VARIANTS, '<cite>').replace(CLOSE_VARIANTS, '</cite>')
}

/** Splits a string into plain/cited segments. Unbalanced/stray tags are dropped. */
export function splitCiteSegments(s: string): CiteSegment[] {
  return normalizeCiteTags(s)
    .split(CITE_SPAN)
    .filter(part => part !== '')
    .map(part => {
      const m = part.match(/^<cite>([\s\S]*?)<\/cite>$/)
      return m
        ? { text: m[1], cited: true }
        : { text: part.replace(CITE_TAG, ''), cited: false }
    })
    .filter(seg => seg.text !== '')
}

/** True when the string contains at least one citation marker (any variant). */
export function hasCiteMarkers(s: string): boolean {
  OPEN_VARIANTS.lastIndex = 0
  CLOSE_VARIANTS.lastIndex = 0
  return OPEN_VARIANTS.test(s) || CLOSE_VARIANTS.test(s)
}

/** Removes all cite markers, keeping the quoted text (PDF, copy-to-clipboard, plain text). */
export function stripCiteMarkers(s: string): string {
  return normalizeCiteTags(s).replace(CITE_TAG, '')
}

/** Deep-cleans every string in a JSON-ish structure — used before PDF rendering. */
export function deepStripCites<T>(value: T): T {
  if (typeof value === 'string') return stripCiteMarkers(value) as unknown as T
  if (Array.isArray(value)) return value.map(deepStripCites) as unknown as T
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, deepStripCites(v)])
    ) as T
  }
  return value
}
