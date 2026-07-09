import Link from 'next/link'
import { createServiceClient } from '@/lib/db'
import { Pagination } from '@/components/admin'
import { ADMIN_PAGE_SIZE, pageRange, parsePage, totalPageCount } from '@/lib/admin-pagination'
import type { ContactCategory } from '@/lib/database.types'
import { ContactQueueList, type ContactRow, type ContactReplyRow } from './contact-queue-list'

export const metadata = { title: 'Contact — Admin — Idea Engine' }

// This page lives under src/app/app/admin/, whose layout.tsx already gates on
// isAdminEmail (redirects non-admins to /app before this ever renders). Reading
// contact_submissions via createServiceClient here is safe BECAUSE that gate
// already ran — never fetch with the service client before it.
//
// migration 012 may not have been run yet in this environment — a 42P01
// (undefined_table) error is expected until Danny runs it, and the page must
// show a friendly notice instead of crashing (same pattern as /app/admin/samples).

const CATEGORIES = ['feedback', 'complaint', 'question', 'partnership'] as const

export default async function AdminContactPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; page?: string }>
}) {
  const { category: categoryParam, page: pageParam } = await searchParams
  const categoryFilter = categoryParam || null
  const page = parsePage(pageParam)
  const { from, to } = pageRange(page)

  const service = createServiceClient()

  let listQuery = service
    .from('contact_submissions')
    .select('id, category, name, email, message, user_id, status, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
  if (categoryFilter) listQuery = listQuery.eq('category', categoryFilter as ContactCategory)
  const { data: rows, count, error } = await listQuery.range(from, to)

  // Postgres 42P01 and PostgREST's PGRST205 ("table not found in schema
  // cache") both mean migration 012 hasn't been run yet — verified live
  // against a database missing the table, PostgREST actually returns
  // PGRST205 here, not 42P01.
  const migrationMissing = error?.code === '42P01' || error?.code === 'PGRST205'
  const submissions: Omit<ContactRow, 'replies'>[] = rows ?? []
  const totalCount = count ?? 0
  const pages = totalPageCount(totalCount)

  // Past replies for the submissions on this page. Migration 022
  // (contact_replies) may not have been run yet — tolerate that the same way
  // as the submissions query above rather than crashing the whole page; the
  // reply modal itself also 503s gracefully until the migration is applied.
  const repliesBySubmission = new Map<string, ContactReplyRow[]>()
  if (!migrationMissing && submissions.length > 0) {
    const { data: replyRows } = await service
      .from('contact_replies')
      .select('id, submission_id, body, created_by, emailed_at, created_at')
      .in('submission_id', submissions.map(s => s.id))
      .order('created_at', { ascending: true })

    for (const reply of replyRows ?? []) {
      const list = repliesBySubmission.get(reply.submission_id) ?? []
      list.push(reply)
      repliesBySubmission.set(reply.submission_id, list)
    }
  }
  const submissionsWithReplies: ContactRow[] = submissions.map(s => ({
    ...s,
    replies: repliesBySubmission.get(s.id) ?? [],
  }))

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white light:text-gray-900 mb-1">Contact</h1>
      <p className="text-sm text-slate-400 light:text-gray-500 mb-8 max-w-2xl">
        Messages submitted through the public contact form. Partnership enquiries are
        commercially time-sensitive and highlighted below.
      </p>

      {migrationMissing ? (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 light:bg-amber-50 light:border-amber-200 px-5 py-5">
          <p className="text-sm font-semibold text-amber-200 light:text-amber-900 mb-1">
            Contact submissions table not found
          </p>
          <p className="text-sm text-amber-100/90 light:text-amber-800">
            Run <code className="rounded bg-black/20 light:bg-amber-100 px-1.5 py-0.5">supabase/migrations/012_contact_submissions.sql</code> in
            the Supabase SQL editor, then reload this page. The public /contact form shows a
            friendly error in the meantime instead of crashing.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-xs text-slate-500 light:text-gray-400">Category:</span>
            <Link
              href="/app/admin/contact"
              className={`text-xs px-2.5 py-1 rounded-full border ${
                !categoryFilter
                  ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30 light:bg-indigo-100 light:text-indigo-700 light:border-indigo-200'
                  : 'bg-white/5 text-slate-400 border-white/10 light:bg-gray-50 light:text-gray-500 light:border-gray-200'
              }`}
            >
              All
            </Link>
            {CATEGORIES.map(cat => (
              <Link
                key={cat}
                href={`/app/admin/contact?category=${encodeURIComponent(cat)}`}
                className={`text-xs px-2.5 py-1 rounded-full border capitalize ${
                  categoryFilter === cat
                    ? cat === 'partnership'
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 light:bg-amber-100 light:text-amber-700 light:border-amber-200'
                      : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30 light:bg-indigo-100 light:text-indigo-700 light:border-indigo-200'
                    : 'bg-white/5 text-slate-400 border-white/10 light:bg-gray-50 light:text-gray-500 light:border-gray-200'
                }`}
              >
                {cat}
              </Link>
            ))}
          </div>

          <ContactQueueList rows={submissionsWithReplies} />

          {totalCount > ADMIN_PAGE_SIZE && (
            <Pagination
              page={page}
              totalPages={pages}
              totalCount={totalCount}
              basePath="/app/admin/contact"
              searchParams={{ category: categoryParam }}
              className="mt-2"
            />
          )}
        </>
      )}
    </div>
  )
}
