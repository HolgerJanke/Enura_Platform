export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getSession } from '@/lib/session'

export default async function ControllingLandingPage() {
  const session = await getSession()
  if (!session?.companyId) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Nicht angemeldet.</p>
      </div>
    )
  }

  const tools = [
    {
      label: 'Finanzen & Cashflow',
      href: '/finance',
      description: 'Rechnungen, offene Forderungen, monatlicher Umsatz und Cashflow-Diagramm',
      icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
      color: 'bg-green-100 text-green-600',
    },
    {
      label: 'Liquiditätsplanung',
      href: '/liquidity',
      description: 'Budget, Plan und Ist-Werte, 30/60/90-Tage Liquiditätsprognose',
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      color: 'bg-blue-100 text-blue-600',
    },
  ]

  return (
    <div className="p-6">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        ← Zurück zum Prozesshaus
      </Link>
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Finanzen & Controlling</h1>
      <p className="text-sm text-gray-500 mb-8">
        Finanzübersicht und Liquiditätsplanung.
      </p>

      {/* Tool cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {tools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="rounded-lg border border-gray-200 bg-white p-5 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tool.color}`}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tool.icon} />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-gray-900">{tool.label}</h3>
            </div>
            <p className="text-xs text-gray-500">{tool.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
