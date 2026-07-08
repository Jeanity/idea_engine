import { createServiceClient } from '@/lib/db'
import type { Json } from '@/lib/database.types'

export interface LogErrorInput {
  /** Where it came from, e.g. 'inngest:generate-report', 'api:admin/offers'. */
  source: string
  /** Short human-readable message. */
  message: string
  /** Optional structured context (ids, step, stack) — stored as jsonb. */
  detail?: unknown
  /** Request path or step id, when relevant. */
  path?: string | null
  /** Actor/owner id when known. */
  userId?: string | null
}

/** Turns an unknown thrown value into a short message string. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

// jsonb-safe normalisation: Errors keep their stack; everything else is passed
// through if it's already a plain object, otherwise wrapped.
function normaliseDetail(v: unknown): Json {
  if (v instanceof Error) {
    return { name: v.name, message: v.message, stack: v.stack ?? null }
  }
  if (v !== null && typeof v === 'object') {
    // Round-trip through JSON so non-serialisable values (undefined, functions,
    // circular refs) can't blow up the insert.
    try {
      return JSON.parse(JSON.stringify(v)) as Json
    } catch {
      return { value: String(v) }
    }
  }
  return { value: v as Json }
}

/**
 * Best-effort, NEVER-throwing error logger. Writes one row to error_log via the
 * service client so the admin Errors page can surface real server failures.
 *
 * This must never throw or reject: logging failures can't be allowed to break
 * the request that called it — that's why every path here is swallowed. Callers
 * can `await` it (it resolves regardless) or fire-and-forget.
 */
export async function logError(input: LogErrorInput): Promise<void> {
  try {
    const service = createServiceClient()
    await service.from('error_log').insert({
      source: input.source.slice(0, 200),
      message: (input.message || 'Unknown error').slice(0, 2000),
      detail: input.detail === undefined || input.detail === null ? null : normaliseDetail(input.detail),
      path: input.path ?? null,
      user_id: input.userId ?? null,
    })
  } catch (err) {
    // Non-fatal: note it to the server console and move on.
    console.error('logError failed (non-fatal):', errorMessage(err))
  }
}
