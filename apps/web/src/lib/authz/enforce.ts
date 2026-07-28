import 'server-only'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import {
  decideAccess,
  hasModulePermission,
  homeFor,
  type AccessDecision,
} from './policy'

/**
 * Server-side enforcement wrappers over the pure policy (`./policy.ts`).
 *
 * These are the REAL gate: unlike the legacy `lib/permissions.ts` boolean checks
 * (whose return value every call site discarded — finding C1), these actually
 * `redirect()` on denial, so gated content is never rendered or shipped
 * (CLAUDE.md §4.2). Additive in Phase 1; call sites adopt them in Phase 3.
 *
 * Use at the top of a Server Component (tier layout or page). Because they call
 * `redirect()`, they never return on the deny path.
 */

/** The current session's access decision for a path, without redirecting. */
export async function getAccessDecision(pathname: string): Promise<AccessDecision> {
  const session = await getSession()
  return decideAccess(session, pathname)
}

/**
 * Enforce access to `pathname` for the current session. Redirects to the
 * tier-appropriate target on denial (real redirect — no inert 200 page).
 * Returns only when access is granted.
 */
export async function enforceAccess(pathname: string): Promise<void> {
  const decision = await getAccessDecision(pathname)
  if (!decision.ok) redirect(decision.redirectTo)
}

/**
 * Enforce that the current session holds at least one of `anyOf` module
 * permission keys. Redirects to the session's home surface on denial.
 * Use for finer-grained, in-page checks that a coarse route rule doesn't cover.
 */
export async function enforceModule(anyOf: string[]): Promise<void> {
  const session = await getSession()
  if (!session) redirect('/login')
  const ok = anyOf.some((k) => hasModulePermission(session, k))
  if (!ok) redirect(homeFor(session))
}
