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
export type QuickLink = {
  title: string
  href: string
  description: string
  icon: string
}

export const HELP_ARTICLES: HelpArticle[] = [
  { title: 'Erste Schritte mit dem Dashboard', slug: 'erste-schritte', level: 'company', excerpt: 'Anmeldung, Passwort und 2FA einrichten.', tags: ['login','passwort','2fa'], readingTimeMinutes: 3 },
  { title: 'Setter-Dashboard verstehen', slug: 'setter-dashboard', level: 'company', excerpt: 'KPIs und Anrufstatistiken.', tags: ['setter','kpi'], readingTimeMinutes: 5 },
  { title: 'Berater-Dashboard verstehen', slug: 'berater-dashboard', level: 'company', excerpt: 'Pipeline und Abschlussquote.', tags: ['berater','pipeline'], readingTimeMinutes: 5 },
  { title: 'Leads verwalten', slug: 'leads-verwalten', level: 'company', excerpt: 'Leads einsehen und bearbeiten.', tags: ['leads','filter'], readingTimeMinutes: 4 },
  { title: 'Projekte und Kanban-Board', slug: 'projekte-kanban', level: 'company', excerpt: '27-Phasen-Kanban verwalten.', tags: ['projekte','kanban'], readingTimeMinutes: 6 },
  { title: 'Finanzen und Cashflow', slug: 'finanzen-cashflow', level: 'company', excerpt: 'Rechnungen und Liquiditaet.', tags: ['finanzen','cashflow'], readingTimeMinutes: 5 },
  { title: 'Tagesberichte', slug: 'tagesberichte', level: 'company', excerpt: 'KI-generierte Tagesberichte.', tags: ['berichte','ki'], readingTimeMinutes: 3 },
  { title: 'Mandantenverwaltung', slug: 'mandantenverwaltung', level: 'holding', excerpt: 'Mandanten anlegen und verwalten.', tags: ['mandant','branding'], readingTimeMinutes: 7 },
  { title: 'Connector-Einstellungen', slug: 'connector-einstellungen', level: 'holding', excerpt: 'API-Verbindungen konfigurieren.', tags: ['connector','api'], readingTimeMinutes: 8 },
  { title: 'Rollen und Berechtigungen', slug: 'rollen-berechtigungen', level: 'holding', excerpt: 'Berechtigungssystem und Rollen.', tags: ['rollen','rechte'], readingTimeMinutes: 6 },
  { title: 'Plattform-Administration', slug: 'plattform-admin', level: 'meta', excerpt: 'Holdings und Systemeinstellungen.', tags: ['plattform','admin'], readingTimeMinutes: 10 },
  { title: 'Datenbank und Migrationen', slug: 'datenbank-migrationen', level: 'meta', excerpt: 'Schema und Migrationen.', tags: ['datenbank','migration'], readingTimeMinutes: 12 },
]
