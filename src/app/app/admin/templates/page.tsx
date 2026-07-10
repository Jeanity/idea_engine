import { createServiceClient } from '@/lib/db'
import { TemplatesClient, type TemplateRow } from './templates-client'
import { EmailChromeCard } from './email-chrome-card'

export const metadata = { title: 'Templates — Admin — HadIdea' }

// This page lives under src/app/app/admin/, whose layout.tsx already gates on
// isAdminEmail (redirects non-admins to /app before this ever renders). Reading
// message_templates via createServiceClient here is safe BECAUSE that gate
// already ran — never fetch with the service client before it.
//
// migration 024 may not have been run yet in this environment — a 42P01
// (undefined_table)/PGRST205 error is expected until Danny runs it, and the
// page must show a friendly notice instead of crashing (same pattern as
// /app/admin/contact and /app/admin/bugs). The compose modals that consume
// templates (invite, contact reply, feedback reply) already tolerate zero
// templates on their own — this page is only where they get created.

export default async function AdminTemplatesPage() {
  const service = createServiceClient()

  const { data, error } = await service
    .from('message_templates')
    .select('id, kind, name, body, is_default, created_at, updated_at')
    .order('kind', { ascending: true })
    .order('name', { ascending: true })

  const migrationMissing = error?.code === '42P01' || error?.code === 'PGRST205'
  const templates: TemplateRow[] = data ?? []

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white light:text-gray-900 mb-1">Templates</h1>
      <p className="text-sm text-slate-400 light:text-gray-500 mb-8 max-w-2xl">
        Reusable message bodies for the invite, contact reply, and feedback reply compose modals.
        Each kind can have one default, which pre-fills the compose box — still fully editable
        before sending.
      </p>

      {/* Header/footer editor is independent of migration 024 (app_settings) —
          shown even when the templates table is missing. */}
      <EmailChromeCard />

      {migrationMissing ? (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 light:bg-amber-50 light:border-amber-200 px-5 py-5">
          <p className="text-sm font-semibold text-amber-200 light:text-amber-900 mb-1">
            Message templates table not found
          </p>
          <p className="text-sm text-amber-100/90 light:text-amber-800">
            Run <code className="rounded bg-black/20 light:bg-amber-100 px-1.5 py-0.5">supabase/migrations/024_message_templates.sql</code> in
            the Supabase SQL editor, then reload this page. The invite, contact reply, and feedback
            reply compose modals all work fine in the meantime — they just won&rsquo;t show a picker.
          </p>
        </div>
      ) : (
        <TemplatesClient initialTemplates={templates} />
      )}
    </div>
  )
}
