import { createServiceClient } from '@/lib/db'
import { SamplesClient, type SampleRow } from './samples-client'

export const metadata = { title: 'Samples — Admin — Idea Engine' }

// This page lives under src/app/app/admin/, whose layout.tsx already gates on
// isAdminEmail (redirects non-admins to /app before this ever renders). Reading
// sample_reports via createServiceClient here is safe BECAUSE that gate already
// ran — never fetch with the service client before it.
//
// migration 011 may not have been run yet in this environment — Postgres
// 42P01 (undefined_table) or PostgREST PGRST205 ("table not found in schema
// cache", what Supabase's REST layer actually returns in practice) is
// expected until Danny runs it, and the page must show a friendly notice
// instead of crashing.

export default async function AdminSamplesPage() {
  const service = createServiceClient()

  const { data: samples, error } = await service
    .from('sample_reports')
    .select('id, title, archetype, restatement, headline_score, source_report_id, active, sort_order, created_at, updated_at')
    .order('sort_order', { ascending: true })

  const migrationMissing = error?.code === '42P01' || error?.code === 'PGRST205'
  const rows: SampleRow[] = samples ?? []

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white light:text-gray-900 mb-1">Samples</h1>
      <p className="text-sm text-slate-400 light:text-gray-500 mb-8 max-w-2xl">
        Curated example reports shown on the public sample gallery. Create one by cloning a real
        completed report, then activate it once it looks right — visitors only ever see active
        samples.
      </p>
      <SamplesClient initialSamples={rows} migrationMissing={migrationMissing} />
    </div>
  )
}
