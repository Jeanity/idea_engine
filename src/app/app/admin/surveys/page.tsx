import { SurveysClient } from './surveys-client'

export const metadata = { title: 'Surveys — Admin — Idea Engine' }

// This page lives under src/app/app/admin/, whose layout.tsx already gates on
// isAdminEmail (redirects non-admins to /app before this ever renders). All
// data here is fetched client-side (question CRUD, reorder, and the AI
// summary are all mutating actions anyway) — see surveys-client.tsx.

export default function AdminSurveysPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-white light:text-gray-900 mb-1">Surveys</h1>
      <p className="text-sm text-slate-400 light:text-gray-500 mb-8 max-w-2xl">
        The report-end feedback card — question bank, master on/off switch, and responses.
      </p>
      <SurveysClient />
    </div>
  )
}
