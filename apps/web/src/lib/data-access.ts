import { cache } from 'react'
import { createMockDataAccess } from '@enura/types'
import type { DataAccess } from '@enura/types'

/**
 * Returns a DataAccess instance scoped to the current request.
 *
 * Currently uses the mock data layer which contains real Reonic data
 * (52 team members, 30 leads, 50 offers, 5 connectors, KPI snapshots).
 *
 * Wrapped in React `cache()` so multiple calls within the same server render
 * reuse the same instance.
 */
export const getDataAccess = cache((): DataAccess => {
  return createMockDataAccess()
})
