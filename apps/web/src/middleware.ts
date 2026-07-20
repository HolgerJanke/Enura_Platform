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

function getSubdomain(hostname: string): string | null {
  // Localhost development — use env default
  if (
    hostname.startsWith('localhost') ||
    hostname.startsWith('127.0.0.1')
  ) {
    return DEFAULT_TENANT_SLUG
  }

  // Vercel preview/production URLs — use env default
  if (hostname.includes('.vercel.app')) {
    return DEFAULT_TENANT_SLUG
  }

  const rootDomain = process.env.PLATFORM_ROOT_DOMAIN ?? 'enura-group.com'

  // Root domain (with or without www) — use env default
  if (hostname === rootDomain || hostname === `www.${rootDomain}`) {
    return DEFAULT_TENANT_SLUG
  }

  // Extract subdomain: e.g. acme-solar.enura-group.com → acme-solar
  const parts = hostname.split('.')
  if (parts.length >= 3) {
    const sub = parts[0]
    if (sub === 'www' || sub === 'admin') {
      return DEFAULT_TENANT_SLUG
    }
    return sub ?? null
  }

  return null
}

function isAuthGateExempt(pathname: string): boolean {
  return AUTH_GATE_EXEMPT.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )
}

/**
 * Auth gates (CLAUDE.md §4.2): a signed-in user with a pending temp-password
 * reset or missing 2FA enrolment may not reach any route except the gate pages
 * themselves. Layout-level gates alone are not enough — Next.js renders page
 * and layout in parallel, so page content still ends up in the RSC payload
 * even when the layout returns a redirect screen. Only a middleware redirect
 * prevents protected content from being served at all.
 *
 * Returns the gate path to redirect to, or null when the request may proceed.
 * Fails open on lookup errors — the layout gates remain as visual backstop.
 */
async function resolveAuthGate(request: NextRequest): Promise<string | null> {
  // Mock auth: gate flags live in the mock-session cookie
  if (process.env.MOCK_AUTH !== 'false') {
    const raw = request.cookies.get('mock-session')?.value
    if (raw) {
      try {
        const mock = JSON.parse(raw) as {
          mustResetPassword?: boolean
          totpEnabled?: boolean
        }
        if (mock.mustResetPassword) return '/reset-password'
        if (mock.totpEnabled === false) return '/enrol-2fa'
        return null
      } catch {
        // Unreadable mock cookie — fall through to real auth below
      }
    }
  }

  // Real Supabase auth — skip entirely for unauthenticated visitors
  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'))
  if (!hasAuthCookie) return null

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return null

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        // Read-only check — session refresh is handled by the server client
        setAll: () => {},
      },
    })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
      .from('profiles')
      .select('must_reset_password, totp_enabled')
      .eq('id', user.id)
      .maybeSingle()
    if (!profile) return null

    if (profile.must_reset_password) return '/reset-password'
    if (!profile.totp_enabled) return '/enrol-2fa'
  } catch (err) {
    console.error('[middleware] Auth-gate check error:', err)
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

  // Skip static assets entirely
  if (isStaticAsset(pathname)) {
    return NextResponse.next()
  }

  // API routes — pass through without branding
  if (pathname.startsWith('/api/')) {
    return NextResponse.next({ request })
  }

  // Enforce §4.2 auth gates before any protected content is served
  if (!isAuthGateExempt(pathname)) {
    const gate = await resolveAuthGate(request)
    if (gate) {
      return NextResponse.redirect(new URL(gate, request.url))
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
  // unless the company overrides them. Resolved via a separate, independently
  // guarded request so a missing column never breaks core branding (see below).
  let resolvedExtendedCSS = buildExtendedCSSVarString(defaultExtendedTokens)
  let resolvedCompanyId = ''
  let resolvedCompanyName = subdomain ?? 'Platform'
  let resolvedCustomCSSPath = ''

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Fetch tenant branding from Supabase via REST (Edge-compatible)
  if (supabaseUrl && supabaseKey && subdomain) {
    try {
      const companyRes = await fetch(
        `${supabaseUrl}/rest/v1/companies?slug=eq.${subdomain}&select=id,name&limit=1`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Accept: 'application/json',
          },
        },
      )
      if (companyRes.ok) {
        const companies = (await companyRes.json()) as Array<{ id: string; name: string }>
        const company = companies[0]
        if (company) {
          resolvedCompanyId = company.id
          resolvedCompanyName = company.name

          // Branding fetches are skipped on consoles — the result would be
          // discarded (consoles always render with default tokens).
          if (!isConsole) {
            const brandRes = await fetch(
              `${supabaseUrl}/rest/v1/company_branding?company_id=eq.${company.id}&select=primary_color,secondary_color,accent_color,background_color,surface_color,text_primary,text_secondary,font_family,font_url,border_radius,dark_mode_enabled,custom_css_path&limit=1`,
              {
                headers: {
                  apikey: supabaseKey,
                  Authorization: `Bearer ${supabaseKey}`,
                  Accept: 'application/json',
                },
              },
            )
            if (brandRes.ok) {
              const brandings = (await brandRes.json()) as Array<Record<string, unknown>>
              const branding = brandings[0]
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
                resolvedBrandCSS = buildCSSVarString(tokens)
                resolvedCustomCSSPath = (branding['custom_css_path'] as string) ?? ''
              }
            }

            // Extended tokens live in a JSONB column (migration 022) that may not
            // be applied in every environment. Fetch them separately so a 400 on
            // the column never falls back the core branding above to defaults.
            try {
              const extRes = await fetch(
                `${supabaseUrl}/rest/v1/company_branding?company_id=eq.${company.id}&select=extended_tokens&limit=1`,
                {
                  headers: {
                    apikey: supabaseKey,
                    Authorization: `Bearer ${supabaseKey}`,
                    Accept: 'application/json',
                  },
                },
              )
              if (extRes.ok) {
                const rows = (await extRes.json()) as Array<{ extended_tokens: Partial<ExtendedBrandTokens> | null }>
                const overrides = rows[0]?.extended_tokens
                if (overrides) {
                  resolvedExtendedCSS = buildExtendedCSSVarString({
                    ...defaultExtendedTokens,
                    ...overrides,
                  })
                }
              }
            } catch (err) {
              // Keep default extended tokens — never block the request
              console.error('[middleware] Extended-token fetch error:', err)
            }
          }
        }
      }
    } catch (err) {
      // Fall back to default branding — never block the request
      console.error('[middleware] Branding fetch error:', err)
    }
  }

  const response = NextResponse.next({ request })
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
