import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import {
  defaultBrandTokens,
  defaultExtendedTokens,
  buildCSSVarString,
  buildExtendedCSSVarString,
  type ExtendedBrandTokens,
  type BrandTokens,
} from '@enura/types'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Header carrying the middleware-verified user id to the app. It is deleted
 * from every INBOUND request (so a client cannot forge it) and re-set only
 * after we have validated the session — see `buildRequestHeaders`.
 */
const AUTH_USER_HEADER = 'x-auth-user-id'

const PUBLIC_PATHS = ['/login', '/reset-password', '/enrol-2fa', '/verify-2fa', '/invite', '/privacy', '/help', '/debug']
const STATIC_PREFIXES = ['/_next/', '/favicon.ico', '/manifest.json', '/icon-']

const BRANDING_TTL_MS = 5 * 60 * 1000

// ---------------------------------------------------------------------------
// Path / host helpers
// ---------------------------------------------------------------------------

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p))
}

function isStaticAsset(pathname: string): boolean {
  return STATIC_PREFIXES.some((p) => pathname.startsWith(p))
}

function isAdminHost(hostname: string): boolean {
  if (hostname.startsWith('admin.')) return true
  const isLocalhost = hostname.startsWith('localhost') || hostname.startsWith('127.0.0.1')
  return isLocalhost && process.env.DEV_HOLDING_ADMIN === 'true'
}

type HostContext =
  | { kind: 'admin' }
  /** A real per-tenant subdomain, e.g. alpen-energie.enura-group.com. */
  | { kind: 'tenant'; slug: string }
  /** localhost / *.vercel.app / root domain — no tenant subdomain in the host. */
  | { kind: 'fallback'; slug: string | null }

function resolveHost(hostname: string): HostContext {
  if (isAdminHost(hostname)) return { kind: 'admin' }

  const devDefault = process.env.DEV_DEFAULT_TENANT_SLUG ?? 'alpen-energie'

  if (hostname.startsWith('localhost') || hostname.startsWith('127.0.0.1')) {
    return { kind: 'fallback', slug: devDefault }
  }
  if (hostname.includes('.vercel.app')) {
    return { kind: 'fallback', slug: devDefault }
  }

  const rootDomain = process.env.PLATFORM_ROOT_DOMAIN ?? 'enura-group.com'
  if (hostname === rootDomain || hostname === `www.${rootDomain}`) {
    return { kind: 'fallback', slug: devDefault }
  }

  const parts = hostname.split('.')
  if (parts.length >= 3) {
    const sub = parts[0]
    if (!sub || sub === 'www' || sub === 'admin') {
      return { kind: 'fallback', slug: devDefault }
    }
    return { kind: 'tenant', slug: sub }
  }

  return { kind: 'fallback', slug: null }
}

// ---------------------------------------------------------------------------
// Branding resolution (anon REST + per-isolate TTL cache)
//
// Branding is public and changes rarely, so caching it removes a Supabase round
// trip from every navigation. Staleness here is only cosmetic (never a security
// boundary), so a short TTL is safe.
// ---------------------------------------------------------------------------

interface ResolvedBrand {
  companyId: string
  companyName: string
  companySlug: string
  brandCSS: string
  customCSSPath: string
}

interface BrandCacheEntry extends ResolvedBrand {
  expiresAt: number
}

const brandingBySlug = new Map<string, BrandCacheEntry>()
const brandingByCompanyId = new Map<string, BrandCacheEntry>()

function restHeaders(key: string): HeadersInit {
  return { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' }
}

function buildBrandCSS(branding: Record<string, unknown> | undefined, extended: Partial<ExtendedBrandTokens> | null): string {
  const tokens: BrandTokens = branding
    ? {
        ...defaultBrandTokens,
        primary: (branding['primary_color'] as string) ?? defaultBrandTokens.primary,
        secondary: (branding['secondary_color'] as string) ?? defaultBrandTokens.secondary,
        accent: (branding['accent_color'] as string) ?? defaultBrandTokens.accent,
        background: (branding['background_color'] as string) ?? defaultBrandTokens.background,
        surface: (branding['surface_color'] as string) ?? defaultBrandTokens.surface,
        textPrimary: (branding['text_primary'] as string) ?? defaultBrandTokens.textPrimary,
        textSecondary: (branding['text_secondary'] as string) ?? defaultBrandTokens.textSecondary,
        font: (branding['font_family'] as string) ?? defaultBrandTokens.font,
        fontUrl: (branding['font_url'] as string | null) ?? defaultBrandTokens.fontUrl,
        radius: (branding['border_radius'] as string) ?? defaultBrandTokens.radius,
      }
    : defaultBrandTokens

  // Extended tokens are always emitted (falling back to defaults) so
  // --brand-shadow-* / --brand-spacing-* never resolve to browser defaults.
  return (
    buildCSSVarString(tokens) +
    ';' +
    buildExtendedCSSVarString({ ...defaultExtendedTokens, ...(extended ?? {}) })
  )
}

async function fetchBrandForCompany(
  companyId: string,
  url: string,
  key: string,
): Promise<{ brandCSS: string; customCSSPath: string }> {
  let brandingRow: Record<string, unknown> | undefined
  try {
    const res = await fetch(
      `${url}/rest/v1/company_branding?company_id=eq.${companyId}&select=primary_color,secondary_color,accent_color,background_color,surface_color,text_primary,text_secondary,font_family,font_url,border_radius,dark_mode_enabled,custom_css_path&limit=1`,
      { headers: restHeaders(key) },
    )
    if (res.ok) brandingRow = ((await res.json()) as Array<Record<string, unknown>>)[0]
  } catch {
    /* fall back to defaults */
  }

  // Extended tokens fetched SEPARATELY and guarded: the column arrives with
  // migration 022, and folding it into the request above would take the core
  // brand colours down with it when the column is absent.
  let extended: Partial<ExtendedBrandTokens> | null = null
  try {
    const extRes = await fetch(
      `${url}/rest/v1/company_branding?company_id=eq.${companyId}&select=extended_tokens&limit=1`,
      { headers: restHeaders(key) },
    )
    if (extRes.ok) {
      extended = ((await extRes.json()) as Array<{ extended_tokens: Partial<ExtendedBrandTokens> | null }>)[0]?.extended_tokens ?? null
    }
  } catch {
    /* core branding must never regress because of this */
  }

  return {
    brandCSS: buildBrandCSS(brandingRow, extended),
    customCSSPath: (brandingRow?.['custom_css_path'] as string) ?? '',
  }
}

function cacheBrand(entry: ResolvedBrand): BrandCacheEntry {
  const cached: BrandCacheEntry = { ...entry, expiresAt: Date.now() + BRANDING_TTL_MS }
  brandingBySlug.set(entry.companySlug, cached)
  brandingByCompanyId.set(entry.companyId, cached)
  return cached
}

async function resolveBrandBySlug(slug: string): Promise<ResolvedBrand | null> {
  const cached = brandingBySlug.get(slug)
  if (cached && cached.expiresAt > Date.now()) return cached

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null

  try {
    const companyRes = await fetch(
      `${url}/rest/v1/companies?slug=eq.${slug}&select=id,name&limit=1`,
      { headers: restHeaders(key) },
    )
    if (!companyRes.ok) return null
    const company = ((await companyRes.json()) as Array<{ id: string; name: string }>)[0]
    if (!company) return null

    const { brandCSS, customCSSPath } = await fetchBrandForCompany(company.id, url, key)
    return cacheBrand({ companyId: company.id, companyName: company.name, companySlug: slug, brandCSS, customCSSPath })
  } catch {
    return null
  }
}

async function resolveBrandByCompanyId(companyId: string): Promise<ResolvedBrand | null> {
  const cached = brandingByCompanyId.get(companyId)
  if (cached && cached.expiresAt > Date.now()) return cached

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null

  try {
    const companyRes = await fetch(
      `${url}/rest/v1/companies?id=eq.${companyId}&select=id,name,slug&limit=1`,
      { headers: restHeaders(key) },
    )
    if (!companyRes.ok) return null
    const company = ((await companyRes.json()) as Array<{ id: string; name: string; slug: string }>)[0]
    if (!company) return null

    const { brandCSS, customCSSPath } = await fetchBrandForCompany(company.id, url, key)
    return cacheBrand({ companyId: company.id, companyName: company.name, companySlug: company.slug, brandCSS, customCSSPath })
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Request header assembly
// ---------------------------------------------------------------------------

interface TenantHeaderValues {
  companyId: string
  companySlug: string
  companyName: string
  isHolding: boolean
  brandCSS: string
  customCSSPath: string
  userId: string | null
}

/**
 * Build the request headers forwarded to the app. Always deletes any inbound
 * auth header first (anti-forgery), then sets the middleware-verified values so
 * `getCompanyContext()` / `getSession()` can read them via `headers()`.
 */
function buildRequestHeaders(request: NextRequest, values: TenantHeaderValues): Headers {
  const h = new Headers(request.headers)
  h.delete(AUTH_USER_HEADER)
  h.set('x-company-id', values.companyId)
  h.set('x-company-slug', values.companySlug)
  h.set('x-company-name', values.companyName)
  h.set('x-is-holding', String(values.isHolding))
  h.set('x-brand-css', values.brandCSS)
  h.set('x-custom-css', values.customCSSPath)
  h.set('x-user-id', values.userId ?? '')
  if (values.userId) h.set(AUTH_USER_HEADER, values.userId)
  return h
}

function applyResponseHeaders(response: NextResponse, values: TenantHeaderValues): void {
  response.headers.set('x-company-id', values.companyId)
  response.headers.set('x-company-slug', values.companySlug)
  response.headers.set('x-company-name', values.companyName)
  response.headers.set('x-is-holding', String(values.isHolding))
  response.headers.set('x-brand-css', values.brandCSS)
  response.headers.set('x-custom-css', values.customCSSPath)
  response.headers.set('x-user-id', values.userId ?? '')
}

// ---------------------------------------------------------------------------
// Auth gate + session profile
// ---------------------------------------------------------------------------

interface GateProfile {
  must_reset_password: boolean
  totp_enabled: boolean
  company_id: string | null
}

/**
 * CLAUDE.md §4.2 gates (b)/(c): a signed-in user with a pending temp-password
 * reset or without 2FA must be redirected BEFORE the page renders. The layout
 * gate (1.3) is a backstop; enforcing here stops gated content leaking into the
 * RSC payload (Next renders page + layout in parallel).
 */
function gateRedirectPath(profile: GateProfile, pathname: string): string | null {
  if (isPublicPath(pathname)) return null
  if (profile.must_reset_password) return '/reset-password'
  if (!profile.totp_enabled) return '/enrol-2fa'
  return null
}

// ---------------------------------------------------------------------------
// Main middleware
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl
  const hostname = request.headers.get('host') ?? 'localhost:3000'

  // Static assets: strip any forged auth header, otherwise pass straight through.
  if (isStaticAsset(pathname)) {
    const h = new Headers(request.headers)
    h.delete(AUTH_USER_HEADER)
    return NextResponse.next({ request: { headers: h } })
  }

  // API routes do their own session checks (see api/*/route.ts). We only strip
  // the inbound auth header so a client can't forge identity to those routes.
  if (pathname.startsWith('/api/')) {
    const h = new Headers(request.headers)
    h.delete(AUTH_USER_HEADER)
    return NextResponse.next({ request: { headers: h } })
  }

  // Supabase client bound to request cookies; capture any cookie refreshes so
  // we can replay them onto whichever response we ultimately return.
  const cookieWrites: Array<{ name: string; value: string; options: CookieOptions }> = []
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(list: Array<{ name: string; value: string; options: CookieOptions }>) {
          // Update the forwarded request cookies too, so downstream RLS queries
          // in THIS request use the refreshed token (not a just-expired one),
          // and stash them to replay onto the response the browser receives.
          list.forEach((c) => {
            request.cookies.set(c.name, c.value)
            cookieWrites.push(c)
          })
        },
      },
    },
  )

  // Verify the session. `getClaims()` verifies the JWT LOCALLY once the project
  // is on asymmetric signing keys (no Auth-server round trip); until then it
  // transparently falls back to a network verify. When the access-token hook
  // (migration 047) is registered, the gate state rides on the token and we skip
  // the profiles read below entirely.
  let userId: string | null = null
  let claimGate: GateProfile | null = null
  try {
    const { data } = await supabase.auth.getClaims()
    const claims = (data?.claims ?? null) as Record<string, unknown> | null
    if (claims?.['sub']) {
      userId = claims['sub'] as string
      if ('must_reset_password' in claims || 'totp_enabled' in claims) {
        claimGate = {
          must_reset_password: Boolean(claims['must_reset_password']),
          totp_enabled: Boolean(claims['totp_enabled']),
          company_id: (claims['company_id'] as string | null) ?? null,
        }
      }
    }
  } catch {
    userId = null
  }
  // Fallback if getClaims could not resolve a session (e.g. transient decode issue).
  if (!userId) {
    try {
      const { data } = await supabase.auth.getUser()
      userId = data.user?.id ?? null
    } catch {
      userId = null
    }
  }

  const host = resolveHost(hostname)

  const withCookies = (response: NextResponse): NextResponse => {
    cookieWrites.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
    return response
  }
  const redirect = (path: string): NextResponse =>
    withCookies(NextResponse.redirect(new URL(path, request.url)))

  // -----------------------------------------------------------------------
  // Signed-in users: enforce the reset-password / 2FA gate (1.4) and align
  // branding + subdomain with their own company (1.5).
  // -----------------------------------------------------------------------
  let sessionCompanyId: string | null = null
  if (userId) {
    // Fast path: gate state already on the token. Otherwise read it fresh from
    // the DB (always current, so a completed reset/2FA clears the gate at once).
    let gateProfile = claimGate
    if (!gateProfile) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('must_reset_password, totp_enabled, company_id')
        .eq('id', userId)
        .single<GateProfile>()
      gateProfile = profileData ?? null
    }

    if (gateProfile) {
      sessionCompanyId = gateProfile.company_id
      const gate = gateRedirectPath(gateProfile, pathname)
      if (gate && pathname !== gate) return redirect(gate)
    }
  }

  // -----------------------------------------------------------------------
  // Resolve branding. Authenticated users are always shown THEIR OWN company's
  // branding; anonymous visitors get the subdomain's branding.
  // -----------------------------------------------------------------------
  let brand: ResolvedBrand | null = null
  const isHolding = host.kind === 'admin'

  if (host.kind === 'admin') {
    // Holding/Enura console — neutral branding.
    brand = null
  } else if (host.kind === 'tenant') {
    const subdomainBrand = await resolveBrandBySlug(host.slug)

    if (userId && sessionCompanyId && subdomainBrand && subdomainBrand.companyId !== sessionCompanyId) {
      // 1.5: signed-in user on a foreign tenant subdomain → send them to their
      // own subdomain so they never see another tenant's branding around their
      // own data. Anonymous visitors are left on the subdomain they requested.
      const own = await resolveBrandByCompanyId(sessionCompanyId)
      if (own) {
        const rootDomain = process.env.PLATFORM_ROOT_DOMAIN ?? 'enura-group.com'
        return redirect(`https://${own.companySlug}.${rootDomain}${pathname}`)
      }
    }

    brand = userId && sessionCompanyId
      ? (await resolveBrandByCompanyId(sessionCompanyId)) ?? subdomainBrand
      : subdomainBrand
  } else {
    // Fallback host (localhost / vercel / root): prefer the signed-in user's own
    // company branding over the env default so they don't see a default shell.
    if (userId && sessionCompanyId) {
      brand = await resolveBrandByCompanyId(sessionCompanyId)
    }
    if (!brand && host.slug) {
      brand = await resolveBrandBySlug(host.slug)
    }
  }

  const values: TenantHeaderValues = {
    companyId: brand?.companyId ?? '',
    companySlug: host.kind === 'admin' ? 'admin' : brand?.companySlug ?? (host.kind === 'tenant' ? host.slug : host.slug ?? 'default'),
    companyName: host.kind === 'admin' ? 'Enura Group' : brand?.companyName ?? 'Platform',
    isHolding,
    brandCSS: brand?.brandCSS ?? buildCSSVarString(defaultBrandTokens) + ';' + buildExtendedCSSVarString(defaultExtendedTokens),
    customCSSPath: brand?.customCSSPath ?? '',
    userId,
  }

  const response = NextResponse.next({ request: { headers: buildRequestHeaders(request, values) } })
  applyResponseHeaders(response, values)
  return withCookies(response)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
