export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { HelpCentreClient } from './help-client'
import { HELP_ARTICLES } from './data'
import type { QuickLink } from './data'

/** Quick links per role key. */
const QUICK_LINKS_BY_ROLE: Record<string, QuickLink[]> = {
  setter: [
    { title: 'Meine Anrufe', href: '/help/company/setter-dashboard', description: 'KPIs und Anrufstatistiken', icon: 'Phone' },
    { title: 'Prozesshaus', href: '/help/company/prozesshaus', description: 'Navigation und Aufbau', icon: 'LayoutDashboard' },
  ],
  berater: [
    { title: 'Pipeline-Übersicht', href: '/help/company/berater-dashboard', description: 'Offerten und Abschlüsse', icon: 'Briefcase' },
    { title: 'Umsatz verfolgen', href: '/help/company/finanzen-cashflow', description: 'Umsatz und Provisionen', icon: 'Banknote' },
  ],
  teamleiter: [
    { title: 'Team-KPIs', href: '/help/company/setter-dashboard', description: 'Leistung Ihres Teams', icon: 'Users' },
    { title: 'Berichte', href: '/help/company/tagesberichte', description: 'Tagesberichte und Coaching', icon: 'ClipboardList' },
  ],
  geschaeftsfuehrung: [
    { title: 'Prozesshaus', href: '/help/company/prozesshaus', description: 'Alle Prozesse im Überblick', icon: 'LayoutDashboard' },
    { title: 'Finanzen', href: '/help/company/finanzen-cashflow', description: 'Cashflow und Liquidität', icon: 'Banknote' },
  ],
  innendienst: [
    { title: 'Planung', href: '/help/company/projekte-kanban', description: 'Projektplanung und IA-Status', icon: 'ClipboardList' },
    { title: 'Projektdetails', href: '/help/company/projekt-details', description: 'Dokumente und Zeitachse', icon: 'Briefcase' },
  ],
  bau: [
    { title: 'Kanban-Board', href: '/help/company/projekte-kanban', description: 'Projekte im Kanban verwalten', icon: 'Building' },
    { title: 'Projektdetails', href: '/help/company/projekt-details', description: 'Dokumente und Zeitachse', icon: 'Briefcase' },
  ],
  buchhaltung: [
    { title: 'Finanzen', href: '/help/company/finanzen-cashflow', description: 'Rechnungen und Cashflow', icon: 'Banknote' },
    { title: 'Finanzplanung', href: '/help/company/finanzplanung-uebersicht', description: 'Rechnungseingang und Zahlungen', icon: 'ClipboardList' },
  ],
  leadkontrolle: [
    { title: 'Lead-Verwaltung', href: '/help/company/leads-verwalten', description: 'Leads filtern und bearbeiten', icon: 'Users' },
  ],
  super_user: [
    { title: 'Benutzer verwalten', href: '/help/company/benutzer-verwalten', description: 'Benutzer und Rollen zuweisen', icon: 'Settings' },
    { title: 'Integrationen', href: '/help/company/integrationen', description: 'Connectoren prüfen', icon: 'Settings' },
  ],
}

const DEFAULT_QUICK_LINKS: QuickLink[] = [
  { title: 'Prozesshaus', href: '/help/company/prozesshaus', description: 'Navigation und Aufbau', icon: 'LayoutDashboard' },
  { title: 'Erste Schritte', href: '/help/company/erste-schritte', description: 'Anmeldung und Einrichtung', icon: 'Settings' },
]

export default async function HelpCentrePage() {
  const session = await getSession()
  if (!session) return (<div className="p-8 text-center"><p className="text-gray-500">Nicht angemeldet.</p><a href="/login" className="text-blue-600 underline">Zur Anmeldung</a></div>)

  // Determine accessible levels based on user status
  const accessibleLevels: Array<'company' | 'holding' | 'meta'> = ['company']

  if (session.isHoldingAdmin || session.isEnuraAdmin) {
    accessibleLevels.push('holding')
  }

  if (session.isEnuraAdmin) {
    accessibleLevels.push('meta')
  }

  // Find the primary role key for quick links
  const primaryRoleKey = session.roles[0]?.key ?? ''
  const quickLinks: QuickLink[] = QUICK_LINKS_BY_ROLE[primaryRoleKey] ?? DEFAULT_QUICK_LINKS

  // Filter articles by accessible levels
  const articles = HELP_ARTICLES.filter((a) => accessibleLevels.includes(a.level))

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        ← Zurück zum Prozesshaus
      </Link>
      <h1 className="mb-2 text-2xl font-bold text-brand-text-primary">
        Hilfe-Center
      </h1>
      <p className="mb-8 text-sm text-brand-text-secondary">
        Finden Sie Anleitungen und Antworten auf häufige Fragen.
      </p>

      <HelpCentreClient
        articles={articles}
        quickLinks={quickLinks}
        accessibleLevels={accessibleLevels}
      />
    </div>
  )
}
