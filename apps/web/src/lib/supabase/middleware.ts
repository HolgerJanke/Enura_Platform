import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

/**
 * Creates a Supabase client for use in Next.js middleware.
 *
 * IMPORTANT: Always call supabase.auth.getUser() before accessing
 * `getResponse()`. The response object may be replaced when cookies
 * are updated during auth operations.
 *
 * @returns `supabase` — the Supabase client bound to request cookies
 * @returns `getResponse` — getter that returns the latest NextResponse
 *          (with all cookies properly forwarded). Must be called AFTER
 *          any auth operations to get the final response.
 */
export function createSupabaseMiddlewareClient(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  return {
    supabase,
    getResponse: () => supabaseResponse,
  }
}
