import { cache } from 'react'
import { createSupabaseServerClient } from './supabase/server'
import { createSupabaseDataAccess } from '@enura/types'
import { createMockDataAccess } from '@enura/types'
import type { DataAccess } from '@enura/types'

/**
 * Returns a DataAccess instance scoped to the current request.
 *
 * - When MOCK_DATA=true, uses the in-memory mock layer (no Supabase needed).
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
  const supabase = createSupabaseServerClient()
  return createSupabaseDataAccess(supabase)
})
