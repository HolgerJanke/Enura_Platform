import { createSupabaseServerClient } from './server'
import { createSupabaseServiceClient } from './service'

const MOCK_AUTH = process.env.MOCK_AUTH !== 'false'

/**
 * Read client for admin-gated dashboard pages.
 *
 * Under real Supabase auth this returns the RLS-scoped session client, so
 * tenant isolation is still enforced at the database level. Under mock auth
 * there is no Supabase JWT, so RLS would hide every row — we fall back to the
 * service client to make admin pages usable in that mode.
 *
 * IMPORTANT: because the service client bypasses RLS, callers MUST scope every
 * query by the verified `session.companyId` (never a client-supplied id). This
 * keeps tenant isolation intact at the application layer while mock auth is on,
 * and becomes a pure RLS path again once MOCK_AUTH is disabled.
 */
export function createAdminReadClient() {
  return MOCK_AUTH ? createSupabaseServiceClient() : createSupabaseServerClient()
}
