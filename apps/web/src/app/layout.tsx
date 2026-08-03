import type { Metadata, Viewport } from 'next'
import {
  buildCSSVarString,
  buildExtendedCSSVarString,
  defaultBrandTokens,
  defaultExtendedTokens,
} from '@enura/types'
import { getCompanyContext } from '@/lib/tenant'
import { getSession } from '@/lib/session'
import CookieBanner from '@/components/CookieBanner'
import { EnuraAdminBar } from '@/components/EnuraAdminBar'
import './globals.css'

/** Neutral (Enura-group) branding — the same defaults middleware uses for admin hosts. */
const NEUTRAL_BRAND_CSS =
  buildCSSVarString(defaultBrandTokens) + ';' + buildExtendedCSSVarString(defaultExtendedTokens)

export async function generateMetadata(): Promise<Metadata> {
  const { companyName } = getCompanyContext()
  return {
    title: companyName || 'Platform',
    description: `${companyName} — Business Intelligence`,
    manifest: '/manifest.json',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: companyName || 'Dashboard',
    },
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // No maximumScale — pinch-zoom must stay enabled (WCAG 1.4.4 / axe meta-viewport).
  viewportFit: 'cover',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { brandCSS, customCSSPath } = getCompanyContext()
  // Server-verified (finding C7): the bar's visibility must come from the
  // real session, not a client-side cookie heuristic. getSession() reads
  // headers() and is safe to call in a Server Component; getCompanyContext()
  // above already calls headers() too, so this adds no new dynamic-rendering
  // cost.
  const session = await getSession()

  // §4.4 / OD-1: a holding/enura admin is NOT a tenant user and must never be
  // shown a tenant's branding — not even for the SSR frame before the (dashboard)
  // client-side tier bounce fires. Middleware brand resolution is admin-unaware
  // (keyed on profiles.company_id), so override to neutral branding here, where
  // the full session (incl. admin flags) is known. A pure company user is
  // unaffected and keeps their own company branding.
  const isAdmin = Boolean(session?.isEnuraAdmin || session?.isHoldingAdmin)
  const effectiveBrandCSS = isAdmin ? NEUTRAL_BRAND_CSS : brandCSS

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const customCSSUrl = !isAdmin && customCSSPath
    ? `${supabaseUrl}/storage/v1/object/public/corporate-assets/${customCSSPath}`
    : null

  return (
    <html lang="de-CH" style={cssStringToObject(effectiveBrandCSS)}>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        {/* Modern standard; the apple-prefixed variant below is kept for older iOS. */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        {customCSSUrl ? (
          <link rel="stylesheet" href={customCSSUrl} />
        ) : null}
      </head>
      <body className="bg-brand-background font-brand text-brand-text-primary antialiased">
        <EnuraAdminBar
          isEnuraAdmin={Boolean(session?.isEnuraAdmin)}
          userName={session?.profile.display_name ?? ''}
        />
        <CookieBanner />
        {children}
      </body>
    </html>
  )
}

function cssStringToObject(cssString: string): React.CSSProperties {
  const result: Record<string, string> = {}
  if (!cssString) return result
  const pairs = cssString.split(';')
  for (const pair of pairs) {
    const colonIndex = pair.indexOf(':')
    if (colonIndex === -1) continue
    const key = pair.substring(0, colonIndex).trim()
    const value = pair.substring(colonIndex + 1).trim()
    if (key && value) {
      result[key] = value
    }
  }
  return result as React.CSSProperties
}
