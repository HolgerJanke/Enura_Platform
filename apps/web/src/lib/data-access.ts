import { cache } from 'react'
import { createSupabaseDataAccess, createMockDataAccess } from '@enura/types'
import type { ConnectorRow, DataAccess } from '@enura/types'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

/**
 * Returns a DataAccess instance scoped to the current request.
 *
 * When MOCK_DATA is set to 'true' (or service-role key is missing),
 * falls back to mock data layer with demo data.
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

/**
 * Request-deduped connectors lookup. The dashboard layout (sidebar status
 * dots) and the dashboard page both need it — without the cache the same
 * query ran twice per navigation.
 */
export const getCompanyConnectors = cache(
  async (companyId: string): Promise<ConnectorRow[]> =>
    getDataAccess().connectors.findByCompanyId(companyId),
)
