import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { HelpCentreClient } from './help-client'

/** Help article metadata used for search indexing and navigation. */
export type HelpArticle = {
  title: string
  slug: string
  level: 'company' | 'holding' | 'meta'
  excerpt: string
  tags: string[]
  readingTimeMinutes: number
}

/** Role-specific quick link displayed on the help centre landing page. */
type QuickLink = {
  title: string
  href: string
  description: string
  icon: string
}

/** The static help article index. In production this would come from a CMS or MDX directory scan. */
export const HELP_ARTICLES: HelpArticle[] = [
  // -- Company-level articles (visible to all authenticated users) --
  {
    title: 'Erste Schritte mit dem Dashboard',
    slug: 'erste-schritte',
    level: 'company',
    excerpt: 'Erfahren Sie, wie Sie sich anmelden, Ihr Passwort aendern und die 2FA einrichten.',
    tags: ['login', 'passwort', '2fa', 'onboarding'],
    readingTimeMinutes: 3,
  },
  {
    title: 'Setter-Dashboard verstehen',
    slug: 'setter-dashboard',
    level: 'company',
    excerpt: 'KPIs, Anrufstatistiken und Terminuebersicht fuer Setter.',
    tags: ['setter', 'kpi', 'anrufe', 'termine'],
    readingTimeMinutes: 5,
  },
  {
    title: 'Berater-Dashboard verstehen',
    slug: 'berater-dashboard',
    level: 'company',
    excerpt: 'Pipeline, Abschlussquote und Umsatz pro Berater im Ueberblick.',
    tags: ['berater', 'pipeline', 'umsatz', 'abschluss'],
    readingTimeMinutes: 5,
  },
  {
    title: 'Leads verwalten',
    slug: 'leads-verwalten',
    level: 'company',
    excerpt: 'Neue Leads einsehen, filtern und bearbeiten.',
    tags: ['leads', 'filter', 'bearbeiten', 'leadkontrolle'],
    readingTimeMinutes: 4,
  },
  {
    title: 'Projekte und Kanban-Board',
    slug: 'projekte-kanban',
    level: 'company',
    excerpt: 'Projektphasen im 27-Phasen-Kanban verwalten und nachverfolgen.',
    tags: ['projekte', 'kanban', 'phasen', 'bau', 'montage'],
    readingTimeMinutes: 6,
  },
  {
    title: 'Finanzen und Cashflow',
    slug: 'finanzen-cashflow',
    level: 'company',
    excerpt: 'Rechnungen, Zahlungen und Liquiditaetsprognosen verstehen.',
    tags: ['finanzen', 'cashflow', 'rechnungen', 'liquiditaet'],
    readingTimeMinutes: 5,
  },
  {
    title: 'Tagesberichte',
    slug: 'tagesberichte',
    level: 'company',
    excerpt: 'Automatische KI-generierte Tagesberichte lesen und verstehen.',
    tags: ['berichte', 'ki', 'tagesbericht', 'email'],
    readingTimeMinutes: 3,
  },

  // -- Holding-level articles (holding admins & enura admins) --
  {
    title: 'Mandantenverwaltung',
    slug: 'mandantenverwaltung',
    level: 'holding',
    excerpt: 'Neue Mandanten anlegen, Branding konfigurieren und Benutzer verwalten.',
    tags: ['mandant', 'tenant', 'branding', 'verwaltung'],
    readingTimeMinutes: 7,
  },
  {
    title: 'Connector-Einstellungen',
    slug: 'connector-einstellungen',
    level: 'holding',
    excerpt: 'API-Verbindungen zu Reonic, 3CX, Bexio und anderen Systemen konfigurieren.',
    tags: ['connector', 'api', 'reonic', '3cx', 'bexio', 'sync'],
    readingTimeMinutes: 8,
  },
  {
    title: 'Rollen und Berechtigungen',
    slug: 'rollen-berechtigungen',
    level: 'holding',
    excerpt: 'Das Berechtigungssystem verstehen und Rollen zuweisen.',
    tags: ['rollen', 'berechtigungen', 'rechte', 'zugriff'],
    readingTimeMinutes: 6,
  },

  // -- Meta-level articles (enura admins only) --
  {
    title: 'Plattform-Administration',
    slug: 'plattform-admin',
    level: 'meta',
    excerpt: 'Holdings anlegen, Systemeinstellungen und Plattform-Monitoring.',
    tags: ['plattform', 'admin', 'system', 'monitoring'],
    readingTimeMinutes: 10,
  },
  {
    title: 'Datenbank und Migrationen',
    slug: 'datenbank-migrationen',
    level: 'meta',
    excerpt: 'Schema-Aenderungen, Migrationen und TimescaleDB-Besonderheiten.',
    tags: ['datenbank', 'migration', 'schema', 'timescaledb'],
    readingTimeMinutes: 12,
  },
]

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
