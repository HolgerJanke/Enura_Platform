import type { Metadata, Viewport } from 'next'
import { getTenantContext } from '@/lib/tenant'
import './globals.css'

export async function generateMetadata(): Promise<Metadata> {
  const { tenantName } = getTenantContext()
  return {
    title: tenantName || 'Platform',
    description: `${tenantName} — Business Intelligence`,
    manifest: '/manifest.json',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: tenantName || 'Dashboard',
    },
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { brandCSS, tenantName } = getTenantContext()

  return (
    <html lang="de-CH" style={cssStringToObject(brandCSS)}>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="bg-brand-background font-brand text-brand-text-primary antialiased">
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
