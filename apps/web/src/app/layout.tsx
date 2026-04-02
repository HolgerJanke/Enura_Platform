import type { Metadata, Viewport } from 'next'
import { getCompanyContext } from '@/lib/tenant'
import { getSession } from '@/lib/session'
import CookieBanner from '@/components/CookieBanner'
import { EnuraAdminBar } from '@/components/EnuraAdminBar'
import './globals.css'

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
  maximumScale: 1,
  viewportFit: 'cover',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { brandCSS, customCSSPath } = getCompanyContext()
  const session = await getSession()
  const isEnuraAdmin = session?.isEnuraAdmin ?? false
  const adminName = session ? [session.profile.first_name, session.profile.last_name].filter(Boolean).join(' ') || 'Admin' : ''

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const customCSSUrl = customCSSPath
    ? `${supabaseUrl}/storage/v1/object/public/corporate-assets/${customCSSPath}`
    : null

  return (
    <html lang="de-CH" style={cssStringToObject(brandCSS)}>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        {customCSSUrl ? (
          <link rel="stylesheet" href={customCSSUrl} />
        ) : null}
      </head>
      <body className="bg-brand-background font-brand text-brand-text-primary antialiased">
        {isEnuraAdmin && <EnuraAdminBar userName={adminName} />}
        <div className={isEnuraAdmin ? 'pt-11' : ''}>
          <CookieBanner />
          {children}
        </div>
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
