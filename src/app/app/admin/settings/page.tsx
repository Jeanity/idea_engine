import { createDbClient } from '@/lib/db'
import { REPORT_MODEL_OPTIONS } from '@/lib/ai'
import { ReportModelPicker } from './model-picker'
import { PromoCard } from './promo-card'
import { TeaserGatingCard } from './teaser-gating-card'
import { SmexyCard } from './smexy-card'

export const metadata = { title: 'Settings — Admin — HadIdea' }

// This page lives under src/app/app/admin/, whose layout.tsx already gates on
// isAdminEmail (redirects non-admins to /app before this ever renders).

export default async function AdminSettingsPage() {
  const supabase = await createDbClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('report_model')
    .eq('id', user!.id)
    .single()

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-white light:text-gray-900 mb-1">Settings</h1>
      <p className="text-sm text-slate-400 light:text-gray-500 mb-8">
        Admin experiment controls.
      </p>

      <div className="mb-8">
        <PromoCard />
      </div>

      <div className="mb-8">
        <TeaserGatingCard />
      </div>

      <div className="mb-8">
        <SmexyCard />
      </div>

      <div className="rounded-lg border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm px-5 py-5">
        <h2 className="font-semibold text-white light:text-gray-900 mb-1">Report model</h2>
        <p className="text-xs text-slate-500 light:text-gray-400 mb-4 leading-relaxed">
          Which Claude model generates <span className="font-medium">full reports for your own ideas</span> — compare quality and
          cost across models (each report records its models and per-step cost in <span className="font-mono">_meta</span>).
          Picking a specific model overrides the hybrid routing for <span className="font-medium">every</span> step of your runs;
          &ldquo;App default&rdquo; restores per-step routing. Other users are never affected. Teasers and failure-fallbacks stay on
          Haiku regardless. Prices are per million tokens; web search adds $10 per 1,000 searches on any model.
        </p>
        <ReportModelPicker current={profile?.report_model ?? null} options={REPORT_MODEL_OPTIONS} />
      </div>
    </div>
  )
}
