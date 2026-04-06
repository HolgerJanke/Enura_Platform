import { createClient } from '@supabase/supabase-js'

/**
 * SERVICE ROLE CLIENT — bypasses Row-Level Security.
 * Use ONLY in:
 *   - Server-side admin operations (holding admin provisioning)
 *   - Background workers (connector sync jobs)
 *   - Migration/seed scripts
 * NEVER use in user-facing route handlers or server components.
 * NEVER import this in files that directly handle user requests.
 *
 * Note: The Database generic is intentionally omitted here because
 * exactOptionalPropertyTypes in the compiled types package conflicts
 * with the Supabase client's internal type inference for mutations.
 * Use .returns<T>() for typed reads where needed.
 */
export function createSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.',
    )
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
