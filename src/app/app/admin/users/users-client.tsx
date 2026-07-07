'use client'

import Link from 'next/link'
import { DeleteUserButton } from './delete-user-button'
import { InviteUserForm } from './invite-user-form'

export interface UserRow {
  id: string
  email: string | null
  username: string | null
  displayName: string | null
  createdAt: string
  lastSeenAt: string | null
  ideaCount: number
  reportCount: number
  isAdmin: boolean
}

function relativeLastSeen(iso: string | null): string {
  if (!iso) return 'Never'
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function UsersClient({ users }: { users: UserRow[] }) {
  return (
    <div>
      <InviteUserForm />

      {users.length === 0 ? (
        <p className="text-sm text-slate-500 light:text-gray-400 py-8 text-center">No users found.</p>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 light:bg-white light:border-gray-200 light:shadow-sm divide-y divide-white/10 light:divide-gray-100 overflow-hidden">
          {users.map(u => (
            <div key={u.id} className="px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Link
                    href={`/app/admin/users/${u.id}`}
                    className="text-sm font-semibold text-white light:text-gray-900 hover:underline truncate"
                  >
                    {u.email ?? '(no email)'}
                  </Link>
                  {u.isAdmin && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 light:bg-indigo-50 light:text-indigo-700">
                      Admin
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 light:text-gray-500">
                  {u.displayName ?? u.username ?? 'No profile name'} · Joined {new Date(u.createdAt).toLocaleDateString()} · Last seen{' '}
                  {relativeLastSeen(u.lastSeenAt)}
                </p>
              </div>

              <div className="flex items-center gap-6 flex-shrink-0">
                <div className="text-xs text-slate-400 light:text-gray-500 text-right">
                  <div><span className="text-white light:text-gray-900 font-semibold">{u.ideaCount}</span> ideas</div>
                  <div><span className="text-white light:text-gray-900 font-semibold">{u.reportCount}</span> reports</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Link
                    href={`/app/admin/users/${u.id}`}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg border border-white/10 text-slate-300 hover:border-white/20 light:border-gray-200 light:text-gray-600 light:hover:border-gray-300"
                  >
                    View
                  </Link>
                  <DeleteUserButton userId={u.id} email={u.email} isAdmin={u.isAdmin} compact />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
