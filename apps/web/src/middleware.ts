import { NextRequest, NextResponse } from 'next/server'
import {
  defaultBrandTokens,
  buildCSSVarString,
  type BrandTokens,
} from '@enura/types'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Default tenant slug for local development and preview deployments */
const DEFAULT_TENANT_SLUG = process.env.DEV_DEFAULT_TENANT_SLUG ?? 'demo'

const STATIC_PATHS = ['/_next/', '/favicon.ico', '/api/', '/manifest.json', '/icon-']

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
// Main middleware — branding resolution only, no auth blocking
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

  // Resolve tenant subdomain
  const subdomain = getSubdomain(hostname)

  let resolvedBrandCSS = buildCSSVarString(defaultBrandTokens)
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

          // Fetch branding
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
    brandCSS: resolvedBrandCSS,
    customCSSPath: resolvedCustomCSSPath,
  })
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
