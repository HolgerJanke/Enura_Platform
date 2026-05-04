import { cache } from 'react'
import { createSupabaseDataAccess, createMockDataAccess } from '@enura/types'
import type { DataAccess } from '@enura/types'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

/**
 * Returns a DataAccess instance scoped to the current request.
 *
 * When MOCK_DATA is set to 'true' (or service-role key is missing),
 * falls back to mock data layer with real Reonic demo data.
 *
 * Otherwise uses the Supabase service-role client which bypasses RLS
 * to query the real database.
 *
 * Wrapped in React `cache()` so multiple calls within the same server render
 * reuse the same instance.
 */
export const getDataAccess = cache((): DataAccess => {
  // Explicit mock mode
  if (process.env.MOCK_DATA === 'true') {
    return createMockDataAccess()
  }

  // Try real Supabase — fall back to mock if service key is missing
  try {
    const client = createSupabaseServiceClient()
    return createSupabaseDataAccess(client)
  } catch {
    // No SUPABASE_SERVICE_ROLE_KEY configured → use mock data
    return createMockDataAccess()
  }
})
