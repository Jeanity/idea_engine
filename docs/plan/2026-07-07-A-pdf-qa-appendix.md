# Plan A — Q&A appendix at the end of report PDFs

## Goal
Every downloaded PDF (teaser-only and full report) ends with an appendix listing the
questions the user was asked and the answers they gave, followed by a short spiel
telling them they can edit their answers and regenerate — with a link to the edit
page and a note that a new generation is a new charge.

## Files
- `src/app/api/ideas/[id]/report/pdf/route.tsx` — fetch answers, pass into the document
- `src/lib/pdf/ReportDocument.tsx` — new appendix page(s)
- `src/lib/format-answer.ts` — NEW: shared answer formatter
- `src/app/app/ideas/[id]/summary/page.tsx` — switch to the shared formatter

## Steps

### 1. Extract the answer formatter
`src/app/app/ideas/[id]/summary/page.tsx` has a local `formatAnswer(text, questionKey)`:
country code → country name (via `COUNTRIES` from `@/lib/countries`), JSON arrays →
comma-joined list, else raw text. Move it to `src/lib/format-answer.ts` (export
`formatAnswer`), import it in the summary page (delete the local copy), and use it in
the PDF route.

### 2. PDF route: fetch and pass answers
In `src/app/api/ideas/[id]/report/pdf/route.tsx`, after the report fetch:

```ts
const { data: answers } = await supabase
  .from('answers')
  .select('question_key, question_text, answer_text, position')
  .eq('idea_id', id)
  .order('position')
```

Add to the `ReportPdfInput` payload:
- `answers: (answers ?? []).map(a => ({ question: a.question_text, answer: formatAnswer(a.answer_text, a.question_key) }))`
- `editAnswersUrl: `${request.nextUrl.origin}/app/ideas/${id}/summary``
  (the route currently ignores its `_request` param — rename to `request`).

### 3. ReportDocument: appendix pages
In `src/lib/pdf/ReportDocument.tsx`:
- Extend `ReportPdfInput` with `answers: { question: string; answer: string }[]` and
  `editAnswersUrl: string`.
- After the last existing `<Page>`, add a new `<Page size="A4" style={styles.page}>`
  rendered only when `data.answers.length > 0`:
  - Section heading: **"Appendix — Your Questions & Answers"**.
  - Intro line: "This report was generated from the answers below. Review them to
    decide whether the result reflects your idea the way you intended."
  - One block per answer: question in the small/muted label style, answer beneath in
    body text. Follow the existing visual language in `components.tsx` / `theme.ts`
    (reuse existing shared components where they fit). Let content wrap across pages
    (react-pdf `wrap`), and include the existing `<PageFooter>` like the other pages.
  - Closing call-out box (match an existing callout/card style if one exists):
    - Title: "Want a different result?"
    - Body: "Your report is only as good as the answers behind it. If something is
      missing, has changed, or you want to explore a different angle for your idea,
      you can edit your answers and generate a fresh report. Editing answers is free —
      generating a new report is a new report purchase, charged at the normal price."
    - `<Link src={data.editAnswersUrl}>Edit your answers</Link>` (react-pdf `Link`
      from `@react-pdf/renderer`), styled as a link in the theme's accent colour,
      with the raw URL printed beneath it in small muted text (PDF readers that
      don't support links still show the address).

## Verify
- `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm run test` all pass.
- Manual sanity is covered in HANDOFF (download a PDF for an idea with answers).
