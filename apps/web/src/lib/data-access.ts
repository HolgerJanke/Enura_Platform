import { cache } from 'react'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from './supabase/server'
import { createSupabaseDataAccess } from '@enura/types'
import { createMockDataAccess } from '@enura/types'
import type { DataAccess } from '@enura/types'

const MOCK_AUTH = process.env.MOCK_AUTH !== 'false'

/**
 * Returns a DataAccess instance scoped to the current request.
 *
 * - When MOCK_DATA=true, uses the in-memory mock layer (no Supabase needed).
 * - When MOCK_AUTH=true (no real Supabase session), uses the service-role key
 *   to bypass RLS and read real data from Supabase.
 * - Otherwise, creates a Supabase server client using the user's session cookie.
 *   RLS automatically scopes all queries to the current user's tenant.
 *
 * Wrapped in React `cache()` so multiple calls within the same server render
 * reuse the same instance (and the same Supabase client / session).
 */
export const getDataAccess = cache((): DataAccess => {
  if (process.env.MOCK_DATA === 'true') {
    return createMockDataAccess()
  }

  // When using mock auth there is no real Supabase session, so the anon-key
  // client would be blocked by RLS. Use the service-role key instead.
  if (MOCK_AUTH && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    return createSupabaseDataAccess(serviceClient)
  }

  const supabase = createSupabaseServerClient()
  return createSupabaseDataAccess(supabase)
})
