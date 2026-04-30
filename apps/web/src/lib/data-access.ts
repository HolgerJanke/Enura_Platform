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
 * Priority:
 * 1. If SUPABASE_SERVICE_ROLE_KEY is set, use a service-role client that
 *    bypasses RLS — real synced data even without a Supabase auth user.
 * 2. If MOCK_AUTH is active (default), use the mock data layer which now
 *    contains real Reonic data (team_members, leads, offers, KPI snapshots).
 * 3. Standard: anon key + RLS (requires a real Supabase auth user).
 *
 * Wrapped in React `cache()` so multiple calls within the same server render
 * reuse the same instance.
 */
export const getDataAccess = cache((): DataAccess => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  // When service-role key is available, use it to bypass RLS
  if (serviceRoleKey && supabaseUrl) {
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    return createSupabaseDataAccess(serviceClient)
  }

  // Mock-auth fallback: use mock data layer (now with real Reonic data)
  if (MOCK_AUTH || process.env.MOCK_DATA === 'true') {
    return createMockDataAccess()
  }

  // Standard: anon key + RLS (requires real Supabase auth user)
  const supabase = createSupabaseServerClient()
  return createSupabaseDataAccess(supabase)
})
