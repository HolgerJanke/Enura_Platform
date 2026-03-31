import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { HelpCentreClient } from './help-client'
import { HELP_ARTICLES } from './data'
import type { QuickLink } from './data'

/** Quick links per role key. */
const QUICK_LINKS_BY_ROLE: Record<string, QuickLink[]> = {
  setter: [
    { title: 'Meine Anrufe', href: '/help/company/setter-dashboard', description: 'KPIs und Anrufstatistiken', icon: 'Phone' },
    { title: 'Termine buchen', href: '/help/company/setter-dashboard', description: 'Termine anlegen und verwalten', icon: 'Calendar' },
  ],
  berater: [
    { title: 'Pipeline-Uebersicht', href: '/help/company/berater-dashboard', description: 'Offerten und Abschluesse', icon: 'Briefcase' },
    { title: 'Umsatz verfolgen', href: '/help/company/finanzen-cashflow', description: 'Umsatz und Provisionen', icon: 'Banknote' },
  ],
  teamleiter: [
    { title: 'Team-KPIs', href: '/help/company/setter-dashboard', description: 'Leistung Ihres Teams', icon: 'Users' },
    { title: 'Berichte', href: '/help/company/tagesberichte', description: 'Tagesberichte und Coaching', icon: 'ClipboardList' },
  ],
  geschaeftsfuehrung: [
    { title: 'Dashboard-Uebersicht', href: '/help/company/erste-schritte', description: 'Alle Module im Ueberblick', icon: 'LayoutDashboard' },
    { title: 'Finanzen', href: '/help/company/finanzen-cashflow', description: 'Cashflow und Liquiditaet', icon: 'Banknote' },
  ],
  innendienst: [
    { title: 'Planung', href: '/help/company/projekte-kanban', description: 'Projektplanung und IA-Status', icon: 'ClipboardList' },
  ],
  bau: [
    { title: 'Kanban-Board', href: '/help/company/projekte-kanban', description: '27-Phasen-Kanban', icon: 'Building' },
  ],
  leadkontrolle: [
    { title: 'Lead-Verwaltung', href: '/help/company/leads-verwalten', description: 'Leads filtern und bearbeiten', icon: 'Users' },
  ],
  super_user: [
    { title: 'Benutzer verwalten', href: '/help/holding/rollen-berechtigungen', description: 'Rollen und Rechte zuweisen', icon: 'Settings' },
    { title: 'Connectors', href: '/help/holding/connector-einstellungen', description: 'API-Verbindungen pruefen', icon: 'Settings' },
  ],
}

const DEFAULT_QUICK_LINKS: QuickLink[] = [
  { title: 'Erste Schritte', href: '/help/company/erste-schritte', description: 'Anmeldung und Einrichtung', icon: 'LayoutDashboard' },
]

export default async function HelpCentrePage() {
  const session = await getSession()
  if (!session) redirect('/login')

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
      <h1 className="mb-2 text-2xl font-bold text-brand-text-primary">
        Hilfe-Center
      </h1>
      <p className="mb-8 text-sm text-brand-text-secondary">
        Finden Sie Anleitungen und Antworten auf haeufige Fragen.
      </p>

      <HelpCentreClient
        articles={articles}
        quickLinks={quickLinks}
        accessibleLevels={accessibleLevels}
      />
    </div>
  )
}
