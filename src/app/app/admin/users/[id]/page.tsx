import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { ARCHETYPE_LABELS } from '@/lib/archetype-labels'
import { DeleteUserButton } from '../delete-user-button'

export const metadata = { title: 'User — Admin — Idea Engine' }

// Read-only detail view except for the delete action (DeleteUserButton).
// This page lives under src/app/app/admin/, whose layout.tsx already gates
// on isAdminEmail — reading other users' data via createServiceClient and
// the auth admin API is safe BECAUSE that gate already ran.

const cardCls =
  'rounded-lg border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm px-5 py-5'

const statusColor: Record<string, string> = {
  complete: 'bg-emerald-500/10 text-emerald-300 light:bg-emerald-50 light:text-emerald-700',
  running: 'bg-amber-500/10 text-amber-300 light:bg-amber-50 light:text-amber-700',
  queued: 'bg-white/10 text-slate-300 light:bg-gray-100 light:text-gray-600',
  failed: 'bg-red-500/10 text-red-300 light:bg-red-50 light:text-red-700',
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const service = createServiceClient()

  const { data: authData, error: authError } = await service.auth.admin.getUserById(id)
  if (authError || !authData?.user) notFound()
  const authUser = authData.user

  const [{ data: profile }, { data: ideas }, { data: reports }, { data: purchases }, { data: feedback }] =
    await Promise.all([
      service.from('profiles').select('*').eq('id', id).maybeSingle(),
      service
        .from('ideas')
        .select('id, raw_text, archetype, status, created_at')
        .eq('owner_id', id)
        .order('created_at', { ascending: false }),
      service
        .from('reports')
        .select('id, idea_id, status, generation_completed_at, created_at')
        .eq('owner_id', id)
        .order('created_at', { ascending: false }),
      service
        .from('purchases')
        .select('id, report_id, amount_cents, currency, status, completed_at, refunded_at, created_at')
        .eq('user_id', id)
        .order('created_at', { ascending: false }),
      service
        .from('report_feedback')
        .select('id, report_id, rating, comment, allow_public, featured, created_at')
        .eq('user_id', id)
        .order('created_at', { ascending: false }),
    ])

  const reportByIdea = new Map((reports ?? []).map(r => [r.idea_id, r]))
  const isAdmin = isAdminEmail(authUser.email)

  const acquisition = profile?.acquisition as
    | { referrer?: string | null; utm?: Record<string, string | null>; landing_path?: string | null }
    | null
    | undefined

  return (
    <div>
      <Link href="/app/admin/users" className="text-sm text-slate-400 hover:text-white light:text-gray-500 light:hover:text-gray-900 mb-4 inline-block">
        &larr; All users
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white light:text-gray-900 mb-1 flex items-center gap-2 flex-wrap">
            {authUser.email ?? '(no email)'}
            {isAdmin && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 light:bg-indigo-50 light:text-indigo-700">
                Admin
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-400 light:text-gray-500">
            {profile?.username ?? profile?.display_name ?? 'No profile name'} · id {authUser.id}
          </p>
        </div>
        <DeleteUserButton userId={id} email={authUser.email ?? null} isAdmin={isAdmin} redirectTo="/app/admin/users" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
        <div className={cardCls}>
          <h2 className="text-sm font-semibold text-white light:text-gray-900 mb-3">Profile</h2>
          <dl className="text-sm space-y-1.5">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400 light:text-gray-500">Username</dt>
              <dd className="text-slate-200 light:text-gray-800">{profile?.username ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400 light:text-gray-500">Display name</dt>
              <dd className="text-slate-200 light:text-gray-800">{profile?.display_name ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400 light:text-gray-500">Location</dt>
              <dd className="text-slate-200 light:text-gray-800">
                {[profile?.default_region, profile?.default_country].filter(Boolean).join(', ') || '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400 light:text-gray-500">Marketing opt-in</dt>
              <dd className="text-slate-200 light:text-gray-800">{profile?.marketing_opt_in ? 'Yes' : 'No'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400 light:text-gray-500">Demo mode</dt>
              <dd className="text-slate-200 light:text-gray-800">{profile?.demo_mode ? 'Yes' : 'No'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400 light:text-gray-500">Joined</dt>
              <dd className="text-slate-200 light:text-gray-800">
                {profile?.created_at ? new Date(profile.created_at).toLocaleString() : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400 light:text-gray-500">Last seen</dt>
              <dd className="text-slate-200 light:text-gray-800">
                {profile?.last_seen_at ? new Date(profile.last_seen_at).toLocaleString() : 'Never'}
              </dd>
            </div>
          </dl>
        </div>

        <div className={cardCls}>
          <h2 className="text-sm font-semibold text-white light:text-gray-900 mb-3">Acquisition (first touch)</h2>
          {acquisition ? (
            <dl className="text-sm space-y-1.5">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400 light:text-gray-500">Referrer</dt>
                <dd className="text-slate-200 light:text-gray-800 truncate max-w-[60%]">{acquisition.referrer ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400 light:text-gray-500">Landing page</dt>
                <dd className="text-slate-200 light:text-gray-800 truncate max-w-[60%]">{acquisition.landing_path ?? '—'}</dd>
              </div>
              {acquisition.utm && Object.keys(acquisition.utm).length > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400 light:text-gray-500">UTM</dt>
                  <dd className="text-slate-200 light:text-gray-800 text-right">
                    {Object.entries(acquisition.utm)
                      .filter(([, v]) => v)
                      .map(([k, v]) => `${k}=${v}`)
                      .join(', ') || '—'}
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-slate-500 light:text-gray-400">No acquisition data recorded.</p>
          )}
        </div>
      </div>

      <div className={`${cardCls} mb-8`}>
        <h2 className="text-sm font-semibold text-white light:text-gray-900 mb-3">
          Ideas &amp; reports ({(ideas ?? []).length})
        </h2>
        {(ideas ?? []).length === 0 ? (
          <p className="text-sm text-slate-500 light:text-gray-400">No ideas yet.</p>
        ) : (
          <div className="divide-y divide-white/10 light:divide-gray-100">
            {(ideas ?? []).map(idea => {
              const report = reportByIdea.get(idea.id)
              return (
                <div key={idea.id} className="py-3 flex items-center justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-200 light:text-gray-800 truncate max-w-md">{idea.raw_text}</p>
                    <p className="text-xs text-slate-500 light:text-gray-400 mt-0.5">
                      {ARCHETYPE_LABELS[idea.archetype] ?? idea.archetype} · idea status: {idea.status} ·{' '}
                      {new Date(idea.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {report && (
                    <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${statusColor[report.status] ?? statusColor.queued}`}>
                      report: {report.status}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className={cardCls}>
          <h2 className="text-sm font-semibold text-white light:text-gray-900 mb-3">
            Purchases ({(purchases ?? []).length})
          </h2>
          {(purchases ?? []).length === 0 ? (
            <p className="text-sm text-slate-500 light:text-gray-400">No purchases.</p>
          ) : (
            <div className="divide-y divide-white/10 light:divide-gray-100">
              {(purchases ?? []).map(p => (
                <div key={p.id} className="py-2.5 text-sm flex items-center justify-between gap-4">
                  <span className="text-slate-200 light:text-gray-800">
                    {(p.amount_cents / 100).toFixed(2)} {p.currency.toUpperCase()}
                  </span>
                  <span className="text-xs text-slate-400 light:text-gray-500">
                    {p.status} · {new Date(p.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={cardCls}>
          <h2 className="text-sm font-semibold text-white light:text-gray-900 mb-3">
            Feedback left ({(feedback ?? []).length})
          </h2>
          {(feedback ?? []).length === 0 ? (
            <p className="text-sm text-slate-500 light:text-gray-400">No feedback left.</p>
          ) : (
            <div className="divide-y divide-white/10 light:divide-gray-100">
              {(feedback ?? []).map(f => (
                <div key={f.id} className="py-2.5">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-200 light:text-gray-800">{f.rating}★</span>
                    {f.featured && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 light:bg-indigo-50 light:text-indigo-700">
                        Featured
                      </span>
                    )}
                  </div>
                  {f.comment && <p className="text-xs text-slate-400 light:text-gray-500 mt-0.5">{f.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
