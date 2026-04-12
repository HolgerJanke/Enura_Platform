export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getSession } from '@/lib/session'

export default async function AnalyticsLandingPage() {
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
      label: 'Setter-Performance',
      href: '/setter',
      description: 'Anrufe, Erreichbarkeit, Terminquote und KI-Gesprächsanalyse',
      icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
      color: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'Berater-Performance',
      href: '/berater',
      description: 'Pipeline, Abschlussquote, Umsatz pro Berater',
      icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
      color: 'bg-indigo-100 text-indigo-600',
    },
    {
      label: 'Lead-Kontrolle',
      href: '/leads',
      description: 'Neue Leads, unbearbeitete Leads, Reaktionszeit, Quellenanalyse',
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
      color: 'bg-green-100 text-green-600',
    },
    {
      label: 'Anomalien & Warnungen',
      href: '/anomalies',
      description: 'Kritische Abweichungen, blockierte Projekte, Schwellenwert-Alarme',
      icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
      color: 'bg-amber-100 text-amber-600',
    },
    {
      label: 'Tagesberichte',
      href: '/reports',
      description: 'KI-generierte Berichte mit KPI-Zusammenfassung und Coaching',
      icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      color: 'bg-purple-100 text-purple-600',
    },
  ]

  return (
    <div className="p-6">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        ← Zurück zum Prozesshaus
      </Link>
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Analytics</h1>
      <p className="text-sm text-gray-500 mb-8">
        Analyse-Tools für Vertrieb, Leads und Betrieb.
      </p>

      {/* Tool cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
