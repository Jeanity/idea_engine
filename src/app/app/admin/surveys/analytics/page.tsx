import { AnalyticsClient } from './analytics-client'

export const metadata = { title: 'Survey analytics — Admin — HadIdea' }

// This page lives under src/app/app/admin/, whose layout.tsx already gates on
// isAdminEmail (redirects non-admins to /app before this ever renders). All
// data is fetched client-side — see analytics-client.tsx.

export default function AdminSurveyAnalyticsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-white light:text-gray-900 mb-1">Survey analytics</h1>
      <p className="text-sm text-slate-400 light:text-gray-500 mb-8 max-w-2xl">
        Responses per survey — pick a survey (or a whole group rolled up), and generate an AI
        overview of what respondents are saying.
      </p>
      <AnalyticsClient />
    </div>
  )
}
