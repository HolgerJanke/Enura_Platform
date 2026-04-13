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
  // -- Company-level articles --
  { title: 'Erste Schritte mit der Plattform', slug: 'erste-schritte', level: 'company', excerpt: 'Anmeldung, Passwort und 2FA einrichten.', tags: ['login','passwort','2fa'], readingTimeMinutes: 3 },
  { title: 'Prozesshaus — Navigation und Aufbau', slug: 'prozesshaus', level: 'company', excerpt: 'Das Prozesshaus als zentrale Navigation: Management-, Kern- und Stützprozesse.', tags: ['prozesshaus','navigation','dashboard','prozess'], readingTimeMinutes: 5 },
  { title: 'Setter-Dashboard verstehen', slug: 'setter-dashboard', level: 'company', excerpt: 'KPIs und Anrufstatistiken.', tags: ['setter','kpi'], readingTimeMinutes: 5 },
  { title: 'Berater-Dashboard verstehen', slug: 'berater-dashboard', level: 'company', excerpt: 'Pipeline und Abschlussquote.', tags: ['berater','pipeline'], readingTimeMinutes: 5 },
  { title: 'Leads verwalten', slug: 'leads-verwalten', level: 'company', excerpt: 'Leads einsehen und bearbeiten.', tags: ['leads','filter'], readingTimeMinutes: 4 },
  { title: 'Projekte und Kanban-Board', slug: 'projekte-kanban', level: 'company', excerpt: 'Projekte im Kanban-Board verwalten und Phasen nachverfolgen.', tags: ['projekte','kanban','phasen'], readingTimeMinutes: 6 },
  { title: 'Projektdetails und Dokumente', slug: 'projekt-details', level: 'company', excerpt: 'Projektübersicht, Zeitachse, Finanzen und Dokument-Upload.', tags: ['projekt','dokument','upload','zeitachse','finanzen'], readingTimeMinutes: 5 },
  { title: 'Finanzen und Cashflow', slug: 'finanzen-cashflow', level: 'company', excerpt: 'Rechnungen und Liquidität.', tags: ['finanzen','cashflow'], readingTimeMinutes: 5 },
  { title: 'Liquiditätsplanung', slug: 'liquiditaetsplanung', level: 'company', excerpt: 'Budget, Plan und Ist-Werte in der Liquiditätsübersicht.', tags: ['liquiditaet','budget','plan'], readingTimeMinutes: 6 },
  { title: 'Tagesberichte', slug: 'tagesberichte', level: 'company', excerpt: 'KI-generierte Tagesberichte.', tags: ['berichte','ki'], readingTimeMinutes: 3 },
  { title: 'Anomalien und Warnungen', slug: 'anomalien', level: 'company', excerpt: 'Kritische Abweichungen erkennen und behandeln.', tags: ['anomalien','warnung'], readingTimeMinutes: 4 },
  { title: 'Corporate Design / Branding', slug: 'branding', level: 'company', excerpt: 'Markenfarben, Schriftart und benutzerdefiniertes CSS.', tags: ['branding','design','farben'], readingTimeMinutes: 5 },
  { title: 'Benutzer verwalten', slug: 'benutzer-verwalten', level: 'company', excerpt: 'Benutzer anlegen, Rollen zuweisen, Passwörter zurücksetzen.', tags: ['benutzer','rollen','einladung'], readingTimeMinutes: 5 },
  { title: 'Integrationen und Connectoren', slug: 'integrationen', level: 'company', excerpt: 'Externe Systeme anbinden und synchronisieren.', tags: ['connector','api','integration'], readingTimeMinutes: 6 },
  { title: 'Leitfaden / Anrufskript', slug: 'leitfaden', level: 'company', excerpt: 'Anrufskripte erstellen und KI-gestützt prüfen.', tags: ['skript','leitfaden','anruf'], readingTimeMinutes: 4 },
  { title: 'Finanzplanung — Übersicht', slug: 'finanzplanung-uebersicht', level: 'company', excerpt: 'Rechnungsverarbeitung, Validierung und Zahlungsplanung.', tags: ['finanzplanung','rechnung','zahlung'], readingTimeMinutes: 7 },
  { title: 'Finanzplanung — Rechnungseingang', slug: 'finanzplanung-eingang', level: 'company', excerpt: 'Eingehende Rechnungen prüfen, validieren und genehmigen.', tags: ['rechnung','validierung','genehmigung'], readingTimeMinutes: 8 },
  { title: 'Finanzplanung — Zahlungsplanung', slug: 'finanzplanung-planung', level: 'company', excerpt: 'Cash-out terminieren, Zahlungsläufe erstellen und freigeben.', tags: ['zahlung','planung','cashout'], readingTimeMinutes: 7 },
  { title: 'Finanzplanung — Lieferanten', slug: 'finanzplanung-lieferanten', level: 'company', excerpt: 'Lieferanten-Stammdaten verwalten und Banking-Daten pflegen.', tags: ['lieferant','iban','stammdaten'], readingTimeMinutes: 4 },
  { title: 'Prozessvorlagen hochladen', slug: 'prozessvorlagen', level: 'company', excerpt: 'JSON-Vorlagen für Prozesse hochladen und verwalten.', tags: ['prozess','vorlage','template','json'], readingTimeMinutes: 4 },
  // -- Holding-level articles --
  { title: 'Mandantenverwaltung', slug: 'mandantenverwaltung', level: 'holding', excerpt: 'Mandanten anlegen und verwalten.', tags: ['mandant','branding'], readingTimeMinutes: 7 },
  { title: 'Connector-Einstellungen', slug: 'connector-einstellungen', level: 'holding', excerpt: 'API-Verbindungen konfigurieren.', tags: ['connector','api'], readingTimeMinutes: 8 },
  { title: 'Rollen und Berechtigungen', slug: 'rollen-berechtigungen', level: 'holding', excerpt: 'Rollen definieren und Berechtigungsmatrix verwalten.', tags: ['rollen','rechte','berechtigungen','matrix'], readingTimeMinutes: 6 },
  { title: 'Prozess-Builder', slug: 'prozess-builder', level: 'holding', excerpt: 'Geschäftsprozesse entwerfen, Schritte definieren und deployen.', tags: ['prozess','builder','workflow'], readingTimeMinutes: 8 },
  { title: 'Prozesshaus konfigurieren', slug: 'prozesshaus-admin', level: 'holding', excerpt: 'Prozesse im Prozesshaus anordnen (M/P/S), Phasen und Sichtbarkeit konfigurieren.', tags: ['prozesshaus','konfiguration','phasen','sortierung'], readingTimeMinutes: 5 },
  { title: 'Add-on Module verwalten', slug: 'addons', level: 'holding', excerpt: 'Finanzplanung und andere Add-ons pro Unternehmen aktivieren.', tags: ['addon','modul','lizenz'], readingTimeMinutes: 4 },
  { title: 'Compliance und Zertifizierungen', slug: 'compliance', level: 'holding', excerpt: 'Compliance-Regeln, Prüfungen und Zertifizierungen verwalten.', tags: ['compliance','zertifizierung','audit'], readingTimeMinutes: 6 },
  { title: 'Holding-Finanzen', slug: 'holding-finanzen', level: 'holding', excerpt: 'Finanzübersicht über alle Tochtergesellschaften.', tags: ['finanzen','holding','übersicht'], readingTimeMinutes: 5 },
  { title: 'Secret-Verwaltung', slug: 'secret-verwaltung', level: 'holding', excerpt: 'API-Keys und Secrets sicher verwalten und rotieren.', tags: ['secret','api-key','sicherheit'], readingTimeMinutes: 4 },
  { title: 'Holding-Analytics', slug: 'holding-analytics', level: 'holding', excerpt: 'Übergreifende Auswertungen und Kennzahlen über alle Unternehmen.', tags: ['analytics','auswertung','kennzahlen'], readingTimeMinutes: 5 },
  // -- Meta-level articles --
  { title: 'Plattform-Administration', slug: 'plattform-admin', level: 'meta', excerpt: 'Holdings und Systemeinstellungen.', tags: ['plattform','admin'], readingTimeMinutes: 10 },
  { title: 'Datenbank und Migrationen', slug: 'datenbank-migrationen', level: 'meta', excerpt: 'Schema und Migrationen.', tags: ['datenbank','migration'], readingTimeMinutes: 12 },
]

/**
 * Maps URL path prefixes to help article slugs.
 * When a user clicks "Hilfe" from a specific page, they are redirected
 * to the most relevant help article instead of the generic help centre.
 */
export const PATH_TO_ARTICLE: Record<string, { level: string; slug: string }> = {
  // Company / Dashboard
  '/dashboard': { level: 'company', slug: 'prozesshaus' },
  '/analytics': { level: 'company', slug: 'prozesshaus' },
  '/setter': { level: 'company', slug: 'setter-dashboard' },
  '/berater': { level: 'company', slug: 'berater-dashboard' },
  '/leads': { level: 'company', slug: 'leads-verwalten' },
  '/projects': { level: 'company', slug: 'projekt-details' },
  '/finance': { level: 'company', slug: 'finanzen-cashflow' },
  '/liquidity': { level: 'company', slug: 'liquiditaetsplanung' },
  '/anomalies': { level: 'company', slug: 'anomalien' },
  '/cashflow-gantt': { level: 'company', slug: 'liquiditaetsplanung' },
  '/reports': { level: 'company', slug: 'tagesberichte' },
  '/innendienst': { level: 'company', slug: 'projekte-kanban' },
  // Company settings
  '/settings/branding': { level: 'company', slug: 'branding' },
  '/settings/users': { level: 'company', slug: 'benutzer-verwalten' },
  '/settings/connectors': { level: 'company', slug: 'integrationen' },
  '/settings/call-script': { level: 'company', slug: 'leitfaden' },
  '/settings/reports': { level: 'company', slug: 'tagesberichte' },
  // Finanzplanung
  '/finanzplanung': { level: 'company', slug: 'finanzplanung-uebersicht' },
  '/finanzplanung/eingang': { level: 'company', slug: 'finanzplanung-eingang' },
  '/finanzplanung/planung': { level: 'company', slug: 'finanzplanung-planung' },
  '/finanzplanung/genehmigung': { level: 'company', slug: 'finanzplanung-planung' },
  '/finanzplanung/lieferanten': { level: 'company', slug: 'finanzplanung-lieferanten' },
  '/finanzplanung/upload': { level: 'company', slug: 'finanzplanung-eingang' },
  // Holding admin
  '/admin': { level: 'holding', slug: 'mandantenverwaltung' },
  '/admin/users': { level: 'holding', slug: 'rollen-berechtigungen' },
  '/admin/finance': { level: 'holding', slug: 'holding-finanzen' },
  '/admin/secrets': { level: 'holding', slug: 'secret-verwaltung' },
  '/admin/processes': { level: 'holding', slug: 'prozess-builder' },
  '/admin/processes/house': { level: 'holding', slug: 'prozesshaus-admin' },
  '/admin/processes/templates': { level: 'company', slug: 'prozessvorlagen' },
  '/admin/tools': { level: 'holding', slug: 'connector-einstellungen' },
  '/admin/analytics': { level: 'holding', slug: 'holding-analytics' },
  '/admin/compliance': { level: 'holding', slug: 'compliance' },
  '/admin/settings/branding': { level: 'holding', slug: 'mandantenverwaltung' },
  '/admin/settings/permissions': { level: 'holding', slug: 'rollen-berechtigungen' },
  '/admin/settings/roles': { level: 'holding', slug: 'rollen-berechtigungen' },
  '/admin/settings/addons': { level: 'holding', slug: 'addons' },
  // Platform (Enura admin)
  '/platform': { level: 'meta', slug: 'plattform-admin' },
}

/**
 * Resolves the best help article for a given pathname.
 * Tries exact match first, then progressively shorter prefixes.
 */
export function getHelpArticleForPath(pathname: string): { level: string; slug: string } | null {
  // Exact match
  if (PATH_TO_ARTICLE[pathname]) return PATH_TO_ARTICLE[pathname]

  // Try progressively shorter path prefixes
  const segments = pathname.split('/').filter(Boolean)
  for (let i = segments.length - 1; i >= 1; i--) {
    const prefix = '/' + segments.slice(0, i).join('/')
    if (PATH_TO_ARTICLE[prefix]) return PATH_TO_ARTICLE[prefix]
  }

  return null
}
