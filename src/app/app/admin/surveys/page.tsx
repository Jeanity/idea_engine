import { SurveysClient } from './surveys-client'

export const metadata = { title: 'Surveys — Admin — HadIdea' }

// This page lives under src/app/app/admin/, whose layout.tsx already gates on
// isAdminEmail (redirects non-admins to /app before this ever renders). All
// data here is fetched client-side (survey/group/question CRUD are all
// mutating actions anyway) — see surveys-client.tsx. Responses live on the
// sibling Analytics page (/app/admin/surveys/analytics).

export default function AdminSurveysPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-white light:text-gray-900 mb-1">Surveys</h1>
      <p className="text-sm text-slate-400 light:text-gray-500 mb-8 max-w-2xl">
        Create surveys, organise them into groups, and target who sees them and where.
        Responses are on the Analytics page.
      </p>
      <SurveysClient />
    </div>
  )
}
