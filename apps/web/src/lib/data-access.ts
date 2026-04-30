import { cache } from 'react'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from './supabase/server'
import { createSupabaseDataAccess } from '@enura/types'
import { createMockDataAccess } from '@enura/types'
import type { DataAccess } from '@enura/types'

/**
 * Returns a DataAccess instance scoped to the current request.
 *
 * Priority:
 * 1. If SUPABASE_SERVICE_ROLE_KEY is set, use a service-role client that
 *    bypasses RLS. This is required when MOCK_AUTH is active (no real
 *    Supabase user exists) but real data has been synced into the database.
 * 2. If MOCK_DATA=true, use the in-memory mock layer (seed data).
 * 3. Otherwise, create a standard Supabase server client (anon key + RLS).
 *
 * Wrapped in React `cache()` so multiple calls within the same server render
 * reuse the same instance (and the same Supabase client / session).
 */
export const getDataAccess = cache((): DataAccess => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  // When service-role key is available, use it to bypass RLS
  // This lets mock-auth sessions read real synced data
  if (serviceRoleKey && supabaseUrl) {
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    return createSupabaseDataAccess(serviceClient)
  }

  // Fallback: in-memory mock data (no Supabase at all)
  if (process.env.MOCK_DATA === 'true') {
    return createMockDataAccess()
  }

  // Standard: anon key + RLS (requires real Supabase auth user)
  const supabase = createSupabaseServerClient()
  return createSupabaseDataAccess(supabase)
})
