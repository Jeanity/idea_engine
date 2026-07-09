import { ReportPageContent } from '@/app/app/ideas/[id]/report/report-page-content'

export const metadata = { title: 'Report — Idea Engine' }

// In-place report reading — renders inside the account shell (children of
// src/app/app/account/layout.tsx), so "Read Report" no longer bounces the
// user out of the account area.
export default async function AccountReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ReportPageContent id={id} />
}
