import { NextRequest, NextResponse } from 'next/server'
import { defaultBrandTokens, buildCSSVarString, brandTokensFromRow } from '@enura/types'
import { createSupabaseMiddlewareClient } from '@/lib/supabase/middleware'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const MOCK_AUTH = process.env.MOCK_AUTH !== 'false'

const PUBLIC_PATHS = ['/login', '/reset-password', '/enrol-2fa', '/verify-2fa']
const STATIC_PATHS = ['/_next/', '/favicon.ico', '/api/health']

/** Mock tenant data — only used when MOCK_AUTH=true */
const MOCK_TENANTS: Record<
  string,
  { id: string; name: string; branding: typeof defaultBrandTokens }
> = {
  'alpen-energie': {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Alpen Energie GmbH',
    branding: { ...defaultBrandTokens },
  },
  'test-company': {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Test Company AG',
    branding: {
      ...defaultBrandTokens,
      primary: '#059669',
      accent: '#D97706',
    },
  },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    STATIC_PATHS.some((p) => pathname.startsWith(p))
  )
}

function isStaticAsset(pathname: string): boolean {
  return STATIC_PATHS.some((p) => pathname.startsWith(p))
}

function isAdminHost(hostname: string): boolean {
  if (hostname.startsWith('admin.')) return true
  const isLocalhost =
    hostname.startsWith('localhost') || hostname.startsWith('127.0.0.1')
  if (isLocalhost && process.env.DEV_HOLDING_ADMIN === 'true') return true
  return false
}

function getSubdomain(hostname: string): string | null {
  const defaultSlug = process.env.DEV_DEFAULT_TENANT_SLUG ?? 'alpen-energie'

  // Localhost development — use env default
  if (
    hostname.startsWith('localhost') ||
    hostname.startsWith('127.0.0.1')
  ) {
    return defaultSlug
  }

  const rootDomain = process.env.PLATFORM_ROOT_DOMAIN ?? 'platform.com'

  // Vercel preview/production domains — use env default
  if (hostname.endsWith('.vercel.app')) {
    return defaultSlug
  }

  // Root domain — use env default (single-tenant mode)
  if (hostname === rootDomain || hostname === `www.${rootDomain}`) {
    return defaultSlug
  }

  // Extract subdomain (first part before root domain)
  const parts = hostname.split('.')
  if (parts.length >= 3) {
    return parts[0] ?? null
  }

  return null
}

function setTenantHeaders(
  response: NextResponse,
  opts: {
    tenantId: string
    tenantSlug: string
    tenantName: string
    isHolding: boolean
    brandCSS: string
    userId?: string
  },
): void {
  response.headers.set('x-tenant-id', opts.tenantId)
  response.headers.set('x-tenant-slug', opts.tenantSlug)
  response.headers.set('x-tenant-name', opts.tenantName)
  response.headers.set('x-is-holding', String(opts.isHolding))
  response.headers.set('x-brand-css', opts.brandCSS)
  if (opts.userId) {
    response.headers.set('x-user-id', opts.userId)
  }
}

function redirectTo(request: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, request.url))
}

// ---------------------------------------------------------------------------
// Mock Auth Middleware (development without Supabase)
// ---------------------------------------------------------------------------

function handleMockAuth(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl
  const hostname = request.headers.get('host') ?? 'localhost:3000'

  // Admin / holding portal
  if (isAdminHost(hostname)) {
    const response = NextResponse.next({ request })
    setTenantHeaders(response, {
      tenantId: '',
      tenantSlug: 'admin',
      tenantName: 'Enura Group',
      isHolding: true,
      brandCSS: buildCSSVarString(defaultBrandTokens),
    })

    if (!isPublicPath(pathname)) {
      const session = request.cookies.get('mock-session')?.value
      if (!session) {
        return redirectTo(request, '/login')
      }
      try {
        const parsed = JSON.parse(session) as {
          mustResetPassword?: boolean
          totpEnabled?: boolean
        }
        if (parsed.mustResetPassword && pathname !== '/reset-password') {
          return redirectTo(request, '/reset-password')
        }
        if (
          !parsed.totpEnabled &&
          pathname !== '/enrol-2fa' &&
          !parsed.mustResetPassword
        ) {
          return redirectTo(request, '/enrol-2fa')
        }
      } catch {
        return redirectTo(request, '/login')
      }
    }

    return response
  }

  const subdomain = getSubdomain(hostname)

  // No subdomain — redirect to login
  if (!subdomain) {
    return redirectTo(request, '/login')
  }

  // Resolve mock tenant
  const tenant = MOCK_TENANTS[subdomain]
  if (!tenant) {
    return NextResponse.rewrite(new URL('/not-found', request.url))
  }

  const response = NextResponse.next({ request })
  setTenantHeaders(response, {
    tenantId: tenant.id,
    tenantSlug: subdomain,
    tenantName: tenant.name,
    isHolding: false,
    brandCSS: buildCSSVarString(tenant.branding),
  })

  // Auth check (except public paths)
  if (!isPublicPath(pathname)) {
    const session = request.cookies.get('mock-session')?.value
    if (!session) {
      return redirectTo(request, '/login')
    }
    try {
      const parsed = JSON.parse(session) as {
        mustResetPassword?: boolean
        totpEnabled?: boolean
      }
      if (parsed.mustResetPassword && pathname !== '/reset-password') {
        return redirectTo(request, '/reset-password')
      }
      if (
        !parsed.totpEnabled &&
        pathname !== '/enrol-2fa' &&
        !parsed.mustResetPassword
      ) {
        return redirectTo(request, '/enrol-2fa')
      }
    } catch {
      return redirectTo(request, '/login')
    }
  }

  return response
}

// ---------------------------------------------------------------------------
// Real Supabase Auth Middleware
// ---------------------------------------------------------------------------

interface TenantBrandingRow {
  primary_color: string
  secondary_color: string
  accent_color: string
  background_color: string
  surface_color: string
  text_primary: string
  text_secondary: string
  font_family: string
  font_url: string | null
  border_radius: string
  dark_mode_enabled: boolean
}

interface TenantRow {
  id: string
  slug: string
  name: string
  status: string
}

interface ProfileRow {
  must_reset_password: boolean
  totp_enabled: boolean
}

async function handleSupabaseAuth(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl
  const hostname = request.headers.get('host') ?? 'localhost:3000'

  // Create Supabase middleware client — this handles cookie forwarding
  const { supabase, getResponse } = createSupabaseMiddlewareClient(request)

  // Try to get the current user — may fail if no session exists (that's OK)
  let user: { id: string } | null = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    // No session or auth error — continue without user
  }

  // -----------------------------------------------------------------------
  // Admin / Holding portal
  // -----------------------------------------------------------------------
  if (isAdminHost(hostname)) {
    const response = getResponse()
    setTenantHeaders(response, {
      tenantId: '',
      tenantSlug: 'admin',
      tenantName: 'Enura Group',
      isHolding: true,
      brandCSS: buildCSSVarString(defaultBrandTokens),
      userId: user?.id,
    })

    if (!isPublicPath(pathname)) {
      if (!user) {
        return redirectTo(request, '/login')
      }

      // Fetch profile for auth gates
      const { data: profile } = await supabase
        .from('profiles')
        .select('must_reset_password, totp_enabled')
        .eq('id', user.id)
        .single<ProfileRow>()

      if (profile) {
        if (profile.must_reset_password && pathname !== '/reset-password') {
          return redirectTo(request, '/reset-password')
        }
        if (
          !profile.totp_enabled &&
          pathname !== '/enrol-2fa' &&
          !profile.must_reset_password
        ) {
          return redirectTo(request, '/enrol-2fa')
        }
      }

      // Check MFA assurance level
      const mfaRedirect = await checkMfaLevel(supabase, pathname)
      if (mfaRedirect) {
        return redirectTo(request, mfaRedirect)
      }
    }

    return response
  }

  // -----------------------------------------------------------------------
  // Tenant resolution
  // -----------------------------------------------------------------------
  const subdomain = getSubdomain(hostname)

  if (!subdomain) {
    return redirectTo(request, '/login')
  }

  // Fetch tenant from Supabase
  const { data: tenantData, error: tenantError } = await supabase
    .from('tenants')
    .select('id, slug, name, status')
    .eq('slug', subdomain)
    .eq('status', 'active')
    .single()

  if (tenantError || !tenantData) {
    console.error('[middleware] Tenant lookup failed:', subdomain, tenantError?.message)
    // Fall back to default branding on login page instead of 404
    if (isPublicPath(pathname)) {
      const response = NextResponse.next({ request })
      setTenantHeaders(response, {
        tenantId: '',
        tenantSlug: subdomain,
        tenantName: subdomain,
        isHolding: false,
        brandCSS: buildCSSVarString(defaultBrandTokens),
      })
      return response
    }
    return NextResponse.rewrite(new URL('/not-found', request.url))
  }

  const tenant = tenantData as unknown as TenantRow

  // Fetch branding
  const { data: brandingData } = await supabase
    .from('tenant_brandings')
    .select(
      'primary_color, secondary_color, accent_color, background_color, surface_color, text_primary, text_secondary, font_family, font_url, border_radius, dark_mode_enabled',
    )
    .eq('tenant_id', tenant.id)
    .single()

  const brandTokens = brandingData
    ? brandTokensFromRow(brandingData as unknown as Parameters<typeof brandTokensFromRow>[0])
    : defaultBrandTokens

  // Get the response AFTER all Supabase calls (cookies may have been updated)
  const response = getResponse()
  setTenantHeaders(response, {
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    tenantName: tenant.name,
    isHolding: false,
    brandCSS: buildCSSVarString(brandTokens),
    userId: user?.id,
  })

  // -----------------------------------------------------------------------
  // Auth gates (except public paths)
  // -----------------------------------------------------------------------
  if (!isPublicPath(pathname)) {
    if (!user) {
      return redirectTo(request, '/login')
    }

    // Fetch profile for password-reset and TOTP gates
    const { data: profile } = await supabase
      .from('profiles')
      .select('must_reset_password, totp_enabled')
      .eq('id', user.id)
      .single<ProfileRow>()

    if (profile) {
      // Gate 1: Password must be reset
      if (profile.must_reset_password && pathname !== '/reset-password') {
        return redirectTo(request, '/reset-password')
      }

      // Gate 2: TOTP must be enrolled (only check after password is set)
      if (
        !profile.totp_enabled &&
        pathname !== '/enrol-2fa' &&
        !profile.must_reset_password
      ) {
        return redirectTo(request, '/enrol-2fa')
      }
    }

    // Gate 3: MFA assurance level
    const mfaRedirect = await checkMfaLevel(supabase, pathname)
    if (mfaRedirect) {
      return redirectTo(request, mfaRedirect)
    }
  }

  return response
}

/**
 * Checks if the user has verified TOTP factors but the current session
 * is only at AAL1 (i.e., they haven't completed the MFA challenge yet).
 * Returns the redirect path if MFA verification is needed, or null.
 */
async function checkMfaLevel(
  supabase: ReturnType<typeof createSupabaseMiddlewareClient>['supabase'],
  pathname: string,
): Promise<string | null> {
  if (pathname === '/verify-2fa') return null

  try {
    const { data: mfaData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (!mfaData) return null

    // User has enrolled TOTP factors but session is not AAL2
    if (
      mfaData.nextLevel === 'aal2' &&
      mfaData.currentLevel !== 'aal2'
    ) {
      return '/verify-2fa'
    }
  } catch {
    // MFA check failed — don't block, let other gates handle it
  }

  return null
}

// ---------------------------------------------------------------------------
// Main middleware export
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // Skip static assets entirely
  if (isStaticAsset(pathname)) {
    return NextResponse.next()
  }

  try {
    if (MOCK_AUTH) {
      return handleMockAuth(request)
    }
    return await handleSupabaseAuth(request)
  } catch (error) {
    // Never throw from middleware — redirect to login on unexpected errors
    console.error('[middleware] Unerwarteter Fehler:', error)
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
