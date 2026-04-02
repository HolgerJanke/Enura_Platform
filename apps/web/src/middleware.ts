import { NextRequest, NextResponse } from 'next/server'
import {
  defaultBrandTokens,
  defaultExtendedTokens,
  buildCSSVarString,
  buildExtendedCSSVarString,
  brandTokensFromRow,
  type ExtendedBrandTokens,
} from '@enura/types'
import { createSupabaseMiddlewareClient } from '@/lib/supabase/middleware'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const MOCK_AUTH = process.env.MOCK_AUTH !== 'false'

const PUBLIC_PATHS = ['/login', '/reset-password', '/enrol-2fa', '/verify-2fa', '/invite', '/privacy', '/help', '/debug']
const STATIC_PATHS = ['/_next/', '/favicon.ico', '/api/', '/manifest.json', '/icon-']

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
  // Localhost development — use env default
  if (
    hostname.startsWith('localhost') ||
    hostname.startsWith('127.0.0.1')
  ) {
    return process.env.DEV_DEFAULT_TENANT_SLUG ?? 'alpen-energie'
  }

  // Vercel preview/production URLs (e.g. enura-platform.vercel.app)
  // These don't have a company subdomain — use the default tenant
  if (hostname.includes('.vercel.app')) {
    return process.env.DEV_DEFAULT_TENANT_SLUG ?? 'alpen-energie'
  }

  const rootDomain = process.env.PLATFORM_ROOT_DOMAIN ?? 'platform.com'

  // Root domain — no subdomain
  if (hostname === rootDomain || hostname === `www.${rootDomain}`) {
    return process.env.DEV_DEFAULT_TENANT_SLUG ?? null
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
    companyId: string
    companySlug: string
    companyName: string
    isHolding: boolean
    brandCSS: string
    userId?: string
    customCSSPath?: string
  },
): void {
  response.headers.set('x-company-id', opts.companyId)
  response.headers.set('x-company-slug', opts.companySlug)
  response.headers.set('x-company-name', opts.companyName)
  response.headers.set('x-is-holding', String(opts.isHolding))
  response.headers.set('x-brand-css', opts.brandCSS)
  response.headers.set('x-custom-css', opts.customCSSPath ?? '')
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
      companyId: '',
      companySlug: 'admin',
      companyName: 'Enura Group',
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
    companyId: tenant.id,
    companySlug: subdomain,
    companyName: tenant.name,
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

interface CompanyBrandingRow {
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
  extended_tokens: Partial<ExtendedBrandTokens> | null
  custom_css_path: string | null
}

interface CompanyRow {
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
  let supabase: ReturnType<typeof createSupabaseMiddlewareClient>['supabase']
  let getResponse: ReturnType<typeof createSupabaseMiddlewareClient>['getResponse']
  let user: { id: string } | null = null

  try {
    const client = createSupabaseMiddlewareClient(request)
    supabase = client.supabase
    getResponse = client.getResponse

    const { data } = await supabase.auth.getUser()
    user = data.user as { id: string } | null
  } catch {
    // Supabase client failed (e.g. missing env vars in Edge runtime)
    // Continue with no user — public paths will still work
    const fallbackResponse = NextResponse.next({ request })
    const subdomain = getSubdomain(hostname)

    setTenantHeaders(fallbackResponse, {
      companyId: '',
      companySlug: subdomain ?? 'default',
      companyName: subdomain ?? 'Platform',
      isHolding: isAdminHost(hostname),
      brandCSS: buildCSSVarString(defaultBrandTokens),
      customCSSPath: '',
    })

    if (!isPublicPath(pathname)) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return fallbackResponse
  }

  // -----------------------------------------------------------------------
  // Admin / Holding portal
  // -----------------------------------------------------------------------
  if (isAdminHost(hostname)) {
    const response = getResponse()
    setTenantHeaders(response, {
      companyId: '',
      companySlug: 'admin',
      companyName: 'Enura Group',
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

  // Fetch tenant from Supabase — try direct REST API as fallback
  let tenant: CompanyRow | null = null

  // First try the Supabase client
  const { data: tenantData } = await supabase
    .from('companies')
    .select('id, slug, name, status')
    .eq('slug', subdomain)
    .eq('status', 'active')
    .single<CompanyRow>()

  tenant = tenantData

  // Fallback: direct REST fetch if client fails (Edge runtime compatibility)
  if (!tenant && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/companies?slug=eq.${subdomain}&status=eq.active&select=id,slug,name,status&limit=1`,
        {
          headers: {
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          cache: 'no-store',
        },
      )
      if (res.ok) {
        const rows = await res.json() as CompanyRow[]
        tenant = rows[0] ?? null
      }
    } catch {
      // Silently fall through
    }
  }

  if (!tenant) {
    // Tenant not found — fall through with default branding
    // This handles cases where the Supabase Edge client fails
    const response = getResponse()
    setTenantHeaders(response, {
      companyId: '',
      companySlug: subdomain,
      companyName: subdomain,
      isHolding: false,
      brandCSS: buildCSSVarString(defaultBrandTokens),
      customCSSPath: '',
    })

    // For non-public paths, still require auth
    if (!isPublicPath(pathname) && !user) {
      return redirectTo(request, '/login')
    }

    return response
  }

  // Fetch branding
  const { data: branding } = await supabase
    .from('company_branding')
    .select(
      'primary_color, secondary_color, accent_color, background_color, surface_color, text_primary, text_secondary, font_family, font_url, border_radius, dark_mode_enabled, extended_tokens, custom_css_path',
    )
    .eq('company_id', tenant.id)
    .single<CompanyBrandingRow>()

  const brandTokens = branding
    ? brandTokensFromRow(branding)
    : defaultBrandTokens

  // Build core brand CSS string
  let brandCSS = buildCSSVarString(brandTokens)

  // Merge extended tokens: holding defaults + company overrides
  if (branding?.extended_tokens) {
    const mergedExtended: Partial<ExtendedBrandTokens> = {
      ...defaultExtendedTokens,
      ...branding.extended_tokens,
    }
    brandCSS += ';' + buildExtendedCSSVarString(mergedExtended)
  } else {
    brandCSS += ';' + buildExtendedCSSVarString(defaultExtendedTokens)
  }

  const customCSSPath = branding?.custom_css_path ?? undefined

  // Get the response AFTER all Supabase calls (cookies may have been updated)
  const response = getResponse()
  setTenantHeaders(response, {
    companyId: tenant.id,
    companySlug: tenant.slug,
    companyName: tenant.name,
    isHolding: false,
    brandCSS,
    userId: user?.id,
    customCSSPath: customCSSPath,
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
  const hostname = request.headers.get('host') ?? 'localhost:3000'

  // Skip static assets entirely
  if (isStaticAsset(pathname)) {
    return NextResponse.next()
  }

  // ── PUBLIC PATH SHORT-CIRCUIT ──────────────────────────────
  // For login, reset-password, 2FA, API routes, etc.:
  // Set default branding headers and pass through immediately.
  // NO Supabase client creation, NO auth checks, NO DB queries.
  if (isPublicPath(pathname)) {
    const subdomain = getSubdomain(hostname)
    const response = NextResponse.next({ request })
    setTenantHeaders(response, {
      companyId: '',
      companySlug: subdomain ?? 'default',
      companyName: subdomain ?? 'Platform',
      isHolding: isAdminHost(hostname),
      brandCSS: buildCSSVarString(defaultBrandTokens),
      customCSSPath: '',
    })
    return response
  }

  // ── PROTECTED PATHS ────────────────────────────────────────
  try {
    if (MOCK_AUTH) {
      return handleMockAuth(request)
    }
    return await handleSupabaseAuth(request)
  } catch (error) {
    console.error('[middleware] Unerwarteter Fehler:', error)
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
