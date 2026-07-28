import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { isCapabilityAllowed } from './policy'
import type { UserSession } from '@enura/types'

/**
 * OD-3 — Holding permission-matrix ceiling (wire-up).
 *
 * The per-holding `holdings.permission_matrix` (`Record<string, boolean>`, managed
 * by the Holding admin at /admin/settings/permissions) is a CEILING on what a
 * tenant `super_user` may do: a capability is allowed unless the holding explicitly
 * disabled it (platform-locked keys are always on). The effective authorization of
 * a company action = its RBAC/role check AND this ceiling.
 *
 * The pure ceiling decision lives in `isCapabilityAllowed` (policy.ts, unit-tested
 * both directions). This module is the thin server-side wiring that loads the
 * matrix for a session's holding and applies it. Enforce a governed capability at
 * its action site with `enforceCapability` / `checkCapability`.
 *
 * Capability keys are the dotted keys defined in
 * `(holding)/admin/settings/permissions/actions.ts` PERMISSION_DEFINITIONS
 * (e.g. `process.version`, `connector.credentials`, `user.impersonate`).
 */

/** Load the holding's permission-matrix ceiling, or null when there is no holding. */
export async function loadHoldingMatrix(
  session: UserSession | null,
): Promise<Record<string, boolean> | null> {
  if (!session?.holdingId) return null
  const supabase = createSupabaseServerClient()
  const { data } = await supabase
    .from('holdings')
    .select('permission_matrix')
    .eq('id', session.holdingId)
    .maybeSingle()
  const matrix = (data as { permission_matrix?: Record<string, boolean> | null } | null)
    ?.permission_matrix
  return matrix ?? null
}

/**
 * True iff the session's holding permits `capabilityKey`. Default-allow when there
 * is no holding or no matrix, so introducing the check is non-breaking; a holding
 * only ever NARROWS a super_user's capabilities from the RBAC baseline.
 */
export async function checkCapability(
  session: UserSession | null,
  capabilityKey: string,
): Promise<boolean> {
  const matrix = await loadHoldingMatrix(session)
  return isCapabilityAllowed(capabilityKey, matrix)
}

export interface CapabilityResult {
  ok: boolean
  error?: string
}

/**
 * Server-action form: returns `{ ok: false, error }` when the holding has disabled
 * the capability, else `{ ok: true }`. Callers short-circuit on `!ok`. (Server
 * actions return a result envelope rather than redirect, matching the codebase.)
 */
export async function enforceCapability(
  session: UserSession | null,
  capabilityKey: string,
  errorMessage = 'Diese Aktion ist für Ihre Holding deaktiviert.',
): Promise<CapabilityResult> {
  if (await checkCapability(session, capabilityKey)) return { ok: true }
  return { ok: false, error: errorMessage }
}
