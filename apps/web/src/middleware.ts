import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import {
  defaultBrandTokens,
  buildCSSVarString,
  defaultExtendedTokens,
  buildExtendedCSSVarString,
  type BrandTokens,
  type ExtendedBrandTokens,
} from '@enura/types'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Default tenant slug for local development and preview deployments */
const DEFAULT_TENANT_SLUG = process.env.DEV_DEFAULT_TENANT_SLUG ?? 'demo'

const STATIC_PATHS = ['/_next/', '/favicon.ico', '/api/', '/manifest.json', '/icon-']

/** Routes reachable while the §4.2 auth gates are still pending */
const AUTH_GATE_EXEMPT = ['/login', '/reset-password', '/enrol-2fa', '/not-found']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/**
 * The actual tenant subdomain of the hostname, or null when the host has no
 * real tenant subdomain (localhost, Vercel previews, root domain, www/admin).
 */
function getRealTenantSlug(hostname: string): string | null {
  if (
    hostname.startsWith('localhost') ||
    hostname.startsWith('127.0.0.1') ||
    hostname.includes('.vercel.app')
  ) {
    return null
  }

  const rootDomain = process.env.PLATFORM_ROOT_DOMAIN ?? 'enura-group.com'
  if (hostname === rootDomain || hostname === `www.${rootDomain}`) {
    return null
  }

  // Extract subdomain: e.g. acme-solar.enura-group.com → acme-solar
  const parts = hostname.split('.')
  if (parts.length >= 3) {
    const sub = parts[0]
    if (!sub || sub === 'www' || sub === 'admin') return null
    return sub
  }

  return null
}

function getSubdomain(hostname: string): string | null {
  const real = getRealTenantSlug(hostname)
  if (real) return real

  // Localhost, Vercel previews, root domain, www/admin hosts — use env default
  if (
    hostname.startsWith('localhost') ||
    hostname.startsWith('127.0.0.1') ||
    hostname.includes('.vercel.app')
  ) {
    return DEFAULT_TENANT_SLUG
  }
  const rootDomain = process.env.PLATFORM_ROOT_DOMAIN ?? 'enura-group.com'
  if (hostname === rootDomain || hostname === `www.${rootDomain}`) {
    return DEFAULT_TENANT_SLUG
  }
  const parts = hostname.split('.')
  if (parts.length >= 3) {
    return DEFAULT_TENANT_SLUG
  }

  return null
}

function isAuthGateExempt(pathname: string): boolean {
  return AUTH_GATE_EXEMPT.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )
}

// ---------------------------------------------------------------------------
// Tenant/branding cache (CLAUDE.md §5.1 — tenant config cached, TTL 5 min)
// ---------------------------------------------------------------------------

/**
 * Per-isolate TTL cache for company + branding lookups. Without it every
 * navigation paid 2–4 Supabase round trips for data that changes rarely.
 * Redis is the documented target; this in-memory map is per runtime instance,
 * which already collapses repeat navigations onto one fetch per 5 minutes.
 * Branding/slug changes therefore take up to 5 minutes to propagate.
 */
const TENANT_CACHE_TTL_MS = 5 * 60 * 1000
const tenantCache = new Map<string, { value: unknown; expiresAt: number }>()

function cacheGet<T>(key: string): { hit: boolean; value: T | undefined } {
  const entry = tenantCache.get(key)
  if (!entry) return { hit: false, value: undefined }
  if (Date.now() > entry.expiresAt) {
    tenantCache.delete(key)
    return { hit: false, value: undefined }
  }
  return { hit: true, value: entry.value as T }
}

function cacheSet(key: string, value: unknown): void {
  tenantCache.set(key, { value, expiresAt: Date.now() + TENANT_CACHE_TTL_MS })
}

type SessionContext = {
  /** §4.2 gate path the user must be redirected to, or null when clear */
  gate: '/reset-password' | '/enrol-2fa' | null
  /** The signed-in user's own company, or null (unauthenticated / no company) */
  companyId: string | null
  /** Verified auth user id, forwarded to the render on a sanitized header */
  userId: string | null
}

/**
 * Auth gates (CLAUDE.md §4.2): a signed-in user with a pending temp-password
 * reset or missing 2FA enrolment may not reach any route except the gate pages
 * themselves. Layout-level gates alone are not enough — Next.js renders page
 * and layout in parallel, so page content still ends up in the RSC payload
 * even when the layout returns a redirect screen. Only a middleware redirect
 * prevents protected content from being served at all.
 *
 * Also resolves the session's own company_id (from the same profile lookup) so
 * branding can be aligned to the signed-in user (§4.4).
 * Fails open on lookup errors — the layout gates remain as visual backstop.
 */
async function resolveSessionContext(request: NextRequest): Promise<SessionContext> {
  // Mock auth: gate flags and company live in the mock-session cookie
  if (process.env.MOCK_AUTH !== 'false') {
    const raw = request.cookies.get('mock-session')?.value
    if (raw) {
      try {
        const mock = JSON.parse(raw) as {
          userId?: string
          mustResetPassword?: boolean
          totpEnabled?: boolean
          companyId?: string | null
        }
        const companyId = mock.companyId ?? null
        const userId = mock.userId ?? null
        if (mock.mustResetPassword) return { gate: '/reset-password', companyId, userId }
        if (mock.totpEnabled === false) return { gate: '/enrol-2fa', companyId, userId }
        return { gate: null, companyId, userId }
      } catch {
        // Unreadable mock cookie — fall through to real auth below
      }
    }
  }

  // Real Supabase auth — skip entirely for unauthenticated visitors
  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'))
  if (!hasAuthCookie) return { gate: null, companyId: null, userId: null }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return { gate: null, companyId: null, userId: null }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        // Read-only check — session refresh is handled by the server client
        setAll: () => {},
      },
    })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { gate: null, companyId: null, userId: null }

    const { data: profile } = await supabase
      .from('profiles')
      .select('must_reset_password, totp_enabled, company_id')
      .eq('id', user.id)
      .maybeSingle()
    if (!profile) return { gate: null, companyId: null, userId: user.id }

    const companyId = profile.company_id ?? null
    if (profile.must_reset_password) return { gate: '/reset-password', companyId, userId: user.id }
    if (!profile.totp_enabled) return { gate: '/enrol-2fa', companyId, userId: user.id }
    return { gate: null, companyId, userId: user.id }
  } catch (err) {
    console.error('[middleware] Auth-gate check error:', err)
  }
  return { gate: null, companyId: null, userId: null }
}

type CompanyRow = { id: string; name: string; slug: string }

function supabaseRestHeaders(supabaseKey: string): Record<string, string> {
  return {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    Accept: 'application/json',
  }
}

/**
 * Fetch a single company row via REST (Edge-compatible). Null when absent.
 * Cached for 5 min — misses are cached too (unknown subdomains would
 * otherwise pay the round trip on every request).
 */
async function fetchCompany(
  supabaseUrl: string,
  supabaseKey: string,
  filter: string,
): Promise<CompanyRow | null> {
  const cacheKey = `company:${filter}`
  const cached = cacheGet<CompanyRow | null>(cacheKey)
  if (cached.hit) return cached.value ?? null

  const res = await fetch(
    `${supabaseUrl}/rest/v1/companies?${filter}&select=id,name,slug&limit=1`,
    { headers: supabaseRestHeaders(supabaseKey) },
  )
  if (!res.ok) return null
  const rows = (await res.json()) as CompanyRow[]
  const company = rows[0] ?? null
  cacheSet(cacheKey, company)
  return company
}

type ResolvedBranding = {
  brandCSS: string
  extendedCSS: string
  customCSSPath: string
}

const BRANDING_CORE_COLUMNS =
  'primary_color,secondary_color,accent_color,background_color,surface_color,text_primary,text_secondary,font_family,font_url,border_radius,dark_mode_enabled,custom_css_path'

/**
 * Resolve a company's brand + extended CSS in a single REST request, cached
 * for 5 min. The extended_tokens column (migration 022) may be missing in
 * some environments — a 400 there must never cost the core branding, so the
 * combined select falls back to core columns only.
 */
async function fetchBranding(
  supabaseUrl: string,
  supabaseKey: string,
  companyId: string,
): Promise<ResolvedBranding> {
  const cacheKey = `branding:${companyId}`
  const cached = cacheGet<ResolvedBranding>(cacheKey)
  if (cached.hit && cached.value) return cached.value

  const resolved: ResolvedBranding = {
    brandCSS: buildCSSVarString(defaultBrandTokens),
    extendedCSS: buildExtendedCSSVarString(defaultExtendedTokens),
    customCSSPath: '',
  }

  const restHeaders = supabaseRestHeaders(supabaseKey)
  let res = await fetch(
    `${supabaseUrl}/rest/v1/company_branding?company_id=eq.${companyId}&select=${BRANDING_CORE_COLUMNS},extended_tokens&limit=1`,
    { headers: restHeaders },
  )
  if (!res.ok) {
    res = await fetch(
      `${supabaseUrl}/rest/v1/company_branding?company_id=eq.${companyId}&select=${BRANDING_CORE_COLUMNS}&limit=1`,
      { headers: restHeaders },
    )
  }
  if (!res.ok) return resolved // transient failure — serve defaults, do not cache

  const rows = (await res.json()) as Array<Record<string, unknown>>
  const branding = rows[0]
  if (branding) {
    const tokens: BrandTokens = {
      ...defaultBrandTokens,
      primary:       (branding['primary_color'] as string) ?? defaultBrandTokens.primary,
      secondary:     (branding['secondary_color'] as string) ?? defaultBrandTokens.secondary,
      accent:        (branding['accent_color'] as string) ?? defaultBrandTokens.accent,
      background:    (branding['background_color'] as string) ?? defaultBrandTokens.background,
      surface:       (branding['surface_color'] as string) ?? defaultBrandTokens.surface,
      textPrimary:   (branding['text_primary'] as string) ?? defaultBrandTokens.textPrimary,
      textSecondary: (branding['text_secondary'] as string) ?? defaultBrandTokens.textSecondary,
      font:          (branding['font_family'] as string) ?? defaultBrandTokens.font,
      fontUrl:       (branding['font_url'] as string | null) ?? defaultBrandTokens.fontUrl,
      radius:        (branding['border_radius'] as string) ?? defaultBrandTokens.radius,
    }
    resolved.brandCSS = buildCSSVarString(tokens)
    resolved.customCSSPath = (branding['custom_css_path'] as string) ?? ''

    const overrides = branding['extended_tokens'] as
      | Partial<ExtendedBrandTokens>
      | null
      | undefined
    if (overrides) {
      resolved.extendedCSS = buildExtendedCSSVarString({
        ...defaultExtendedTokens,
        ...overrides,
      })
    }
  }
  cacheSet(cacheKey, resolved)
  return resolved
}

function setTenantHeaders(
  response: NextResponse,
  opts: {
    companyId: string
    companySlug: string
    companyName: string
    isHolding: boolean
    brandCSS: string
    customCSSPath?: string
  },
): void {
  response.headers.set('x-company-id', opts.companyId)
  response.headers.set('x-company-slug', opts.companySlug)
  response.headers.set('x-company-name', opts.companyName)
  response.headers.set('x-is-holding', String(opts.isHolding))
  response.headers.set('x-brand-css', opts.brandCSS)
  response.headers.set('x-custom-css', opts.customCSSPath ?? '')
}

// ---------------------------------------------------------------------------
// Main middleware — §4.2 auth-gate enforcement + tenant branding resolution
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl
  const hostname = request.headers.get('host') ?? 'localhost:3000'

  // The render and API routes trust x-auth-user-id as the verified identity —
  // strip any client-supplied value BEFORE any pass-through (including the
  // static/API short-circuit below); middleware is the only legitimate writer.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.delete('x-auth-user-id')

  // Skip static assets (and API routes — they pass through without branding)
  if (isStaticAsset(pathname) || pathname.startsWith('/api/')) {
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  // Enforce §4.2 auth gates before any protected content is served. The same
  // lookup yields the session's own company for branding alignment below, and
  // the verified user id so the render can skip a duplicate auth round trip.
  let sessionCompanyId: string | null = null
  if (!isAuthGateExempt(pathname)) {
    const { gate, companyId, userId } = await resolveSessionContext(request)
    if (gate) {
      return NextResponse.redirect(new URL(gate, request.url))
    }
    sessionCompanyId = companyId
    if (userId) {
      requestHeaders.set('x-auth-user-id', userId)
    }
  }

  // Resolve tenant subdomain
  const subdomain = getSubdomain(hostname)

  // Holding/platform consoles are brand-neutral (CLAUDE.md §7): they must
  // never carry a company's branding or custom CSS. Company resolution still
  // runs (the headers feed metadata), but brand tokens stay at defaults.
  // Path-based on purpose — isAdminHost() is true for ALL of localhost when
  // DEV_HOLDING_ADMIN is set, which would strip tenant pages of branding.
  const isConsole =
    pathname === '/admin' || pathname.startsWith('/admin/') ||
    pathname === '/platform' || pathname.startsWith('/platform/')

  let resolvedBrandCSS = buildCSSVarString(defaultBrandTokens)
  // Extended design tokens (shadows/spacing/etc) are always emitted — defaults
  // unless the company overrides them (see fetchBranding).
  let resolvedExtendedCSS = buildExtendedCSSVarString(defaultExtendedTokens)
  let resolvedCompanyId = ''
  let resolvedCompanySlug = subdomain ?? 'default'
  let resolvedCompanyName = subdomain ?? 'Platform'
  let resolvedCustomCSSPath = ''

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Fetch tenant branding from Supabase via REST (Edge-compatible)
  if (supabaseUrl && supabaseKey && subdomain) {
    try {
      let company = await fetchCompany(supabaseUrl, supabaseKey, `slug=eq.${subdomain}`)

      // Session/tenant alignment (§4.4): a tenant surface must carry the
      // signed-in user's own company, never another tenant's. On a real
      // production subdomain that isn't theirs, redirect to their own
      // subdomain. On fallback hosts (localhost, previews, root domain) no
      // tenant subdomain exists, so resolve branding from the session's
      // company instead of the DEV_DEFAULT_TENANT_SLUG fallback.
      if (!isConsole && sessionCompanyId && sessionCompanyId !== (company?.id ?? null)) {
        const ownCompany = await fetchCompany(
          supabaseUrl,
          supabaseKey,
          `id=eq.${sessionCompanyId}`,
        )
        if (ownCompany) {
          const realSlug = getRealTenantSlug(hostname)
          if (realSlug && company) {
            const url = request.nextUrl.clone()
            const hostParts = (hostname.split(':')[0] ?? hostname).split('.')
            url.hostname = [ownCompany.slug, ...hostParts.slice(1)].join('.')
            return NextResponse.redirect(url)
          }
          company = ownCompany
        }
      }

      if (company) {
        resolvedCompanyId = company.id
        resolvedCompanySlug = company.slug
        resolvedCompanyName = company.name

        // Branding fetches are skipped on consoles — the result would be
        // discarded (consoles always render with default tokens).
        if (!isConsole) {
          const branding = await fetchBranding(supabaseUrl, supabaseKey, company.id)
          resolvedBrandCSS = branding.brandCSS
          resolvedExtendedCSS = branding.extendedCSS
          resolvedCustomCSSPath = branding.customCSSPath
        }
      }
    } catch (err) {
      // Fall back to default branding — never block the request
      console.error('[middleware] Branding fetch error:', err)
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  setTenantHeaders(response, {
    companyId: resolvedCompanyId,
    companySlug: subdomain ?? 'default',
    companyName: resolvedCompanyName,
    isHolding: isAdminHost(hostname),
    brandCSS: isConsole
      ? `${buildCSSVarString(defaultBrandTokens)};${buildExtendedCSSVarString(defaultExtendedTokens)}`
      : `${resolvedBrandCSS};${resolvedExtendedCSS}`,
    customCSSPath: isConsole ? '' : resolvedCustomCSSPath,
  })
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
