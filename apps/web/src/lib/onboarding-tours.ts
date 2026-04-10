import type { TourStep } from '@/components/help/GuidedTour'

// ---------------------------------------------------------------------------
// Role-specific onboarding tours
// ---------------------------------------------------------------------------

export const SETTER_TOUR: TourStep[] = [
  {
    id: 'setter-nav',
    targetId: 'nav-setter',
    position: 'right',
    title: 'Setter-Dashboard',
    content:
      'Hier finden Sie Ihre persönlichen Anruf-Statistiken, Terminquoten und KI-gestützte Gesprächsanalysen. Klicken Sie auf diesen Menüpunkt, um Ihr Dashboard zu öffnen.',
    actionLabel: 'Weiter',
  },
  {
    id: 'setter-kpis',
    targetId: 'kpi-grid',
    position: 'bottom',
    title: 'Ihre KPIs',
    content:
      'Diese Kacheln zeigen Ihre wichtigsten Kennzahlen: Anrufe pro Tag, Erreichbarkeitsquote, gebuchte Termine und durchschnittliche Gesprächsdauer. Grüne Pfeile bedeuten Verbesserung gegenüber der Vorwoche.',
    actionLabel: 'Weiter',
  },
  {
    id: 'setter-calls',
    targetId: 'recent-calls-table',
    position: 'top',
    title: 'Letzte Anrufe',
    content:
      'In dieser Tabelle sehen Sie Ihre letzten Gespräche mit KI-Score und Verbesserungsvorschlägen. Klicken Sie auf einen Eintrag, um die detaillierte Analyse zu öffnen.',
    actionLabel: 'Verstanden',
  },
]

export const BERATER_TOUR: TourStep[] = [
  {
    id: 'berater-nav',
    targetId: 'nav-berater',
    position: 'right',
    title: 'Berater-Dashboard',
    content:
      'Ihr Berater-Bereich zeigt Pipeline-Übersicht, Abschlussquoten und Umsatz pro Berater. Alle Daten werden automatisch aus dem CRM synchronisiert.',
    actionLabel: 'Weiter',
  },
  {
    id: 'berater-pipeline',
    targetId: 'pipeline-overview',
    position: 'bottom',
    title: 'Pipeline-Übersicht',
    content:
      'Hier sehen Sie Ihre offenen Angebote nach Status: Entwurf, Versendet, in Verhandlung. Die Summen zeigen das potenzielle Volumen in CHF.',
    actionLabel: 'Weiter',
  },
  {
    id: 'berater-closing',
    targetId: 'closing-rate-chart',
    position: 'top',
    title: 'Abschlussquote',
    content:
      'Das Diagramm zeigt Ihre Abschlussquote im Zeitverlauf. Vergleichen Sie sich mit dem Team-Durchschnitt, um Optimierungspotenzial zu erkennen.',
    actionLabel: 'Verstanden',
  },
]

export const INNENDIENST_TOUR: TourStep[] = [
  {
    id: 'innendienst-nav',
    targetId: 'nav-innendienst',
    position: 'right',
    title: 'Innendienst-Bereich',
    content:
      'Hier verwalten Sie offene Planungsaufträge, blockierte Projekte und den IA-Status. Die Übersicht wird automatisch mit dem CRM synchronisiert.',
    actionLabel: 'Weiter',
  },
  {
    id: 'innendienst-planning',
    targetId: 'planning-queue',
    position: 'bottom',
    title: 'Planungswarteschlange',
    content:
      'Diese Liste zeigt alle offenen Planungsaufträge sortiert nach Priorität. Rote Markierungen weisen auf Projekte hin, die länger als 5 Tage blockiert sind.',
    actionLabel: 'Weiter',
  },
  {
    id: 'innendienst-ia',
    targetId: 'ia-status-panel',
    position: 'top',
    title: 'IA-Status',
    content:
      'Der IA-Status zeigt den Fortschritt der internen Abnahme. Nutzen Sie die Filterfunktion, um gezielt nach Status oder Zuständigem zu suchen.',
    actionLabel: 'Verstanden',
  },
]

export const BUCHHALTUNG_TOUR: TourStep[] = [
  {
    id: 'buch-nav',
    targetId: 'nav-finance',
    position: 'right',
    title: 'Finanzen',
    content:
      'Im Finanz-Dashboard sehen Sie Rechnungsstatus, Cashflow und offene Forderungen. Die Daten werden stündlich mit Bexio synchronisiert.',
    actionLabel: 'Weiter',
  },
  {
    id: 'buch-invoices',
    targetId: 'invoice-overview',
    position: 'bottom',
    title: 'Rechnungsübersicht',
    content:
      'Hier sind alle Rechnungen nach Status gruppiert: Entwurf, Versendet, Bezahlt, Überfällig. Klicken Sie auf eine Kategorie, um die Einzelposten zu sehen.',
    actionLabel: 'Weiter',
  },
  {
    id: 'buch-cashflow',
    targetId: 'cashflow-chart',
    position: 'top',
    title: 'Cashflow-Diagramm',
    content:
      'Das Cashflow-Diagramm zeigt Plan- und Ist-Werte im Vergleich. Gelbe Bereiche markieren Perioden, in denen die Liquidität unter den konfigurierten Schwellenwert fällt.',
    actionLabel: 'Verstanden',
  },
]

export const HOLDING_ADMIN_TOUR: TourStep[] = [
  {
    id: 'holding-tenants',
    targetId: 'admin-tenants-tab',
    position: 'bottom',
    title: 'Mandanten-Verwaltung',
    content:
      'Hier verwalten Sie alle Tochtergesellschaften der Holding. Sie können neue Mandanten anlegen, Branding konfigurieren und den Connector-Status prüfen.',
    actionLabel: 'Weiter',
  },
  {
    id: 'holding-health',
    targetId: 'connector-health-panel',
    position: 'bottom',
    title: 'Connector-Gesundheit',
    content:
      'Diese Ansicht zeigt den Synchronisations-Status aller Connectoren über alle Mandanten hinweg. Rote Einträge erfordern sofortige Aufmerksamkeit.',
    actionLabel: 'Weiter',
  },
  {
    id: 'holding-impersonate',
    targetId: 'impersonate-button',
    position: 'left',
    title: 'Mandant impersonieren',
    content:
      'Mit dieser Funktion können Sie sich als Super User eines Mandanten einloggen, um Support zu leisten. Jede Impersonierung wird im Audit-Log protokolliert.',
    actionLabel: 'Verstanden',
  },
]

// ---------------------------------------------------------------------------
// Process Builder walkthrough (9 steps)
// ---------------------------------------------------------------------------

export const PROCESS_BUILDER_WALKTHROUGH: TourStep[] = [
  {
    id: 'pb-sidebar',
    targetId: 'process-sidebar',
    position: 'right',
    title: 'Prozess-Navigation',
    content:
      'In der Seitenleiste sehen Sie alle definierten Prozesse, gruppiert nach Kategorie. Wählen Sie einen Prozess aus, um dessen Schritte zu bearbeiten.',
    actionLabel: 'Weiter',
  },
  {
    id: 'pb-canvas',
    targetId: 'process-canvas',
    position: 'bottom',
    title: 'Prozess-Canvas',
    content:
      'Der Canvas zeigt den gesamten Prozessablauf als Kette von Schrittkarten. Jede Karte repräsentiert eine Phase mit Informationsquellen und Schnittstellen.',
    actionLabel: 'Weiter',
  },
  {
    id: 'pb-step-card',
    targetId: 'step-card-0',
    position: 'right',
    title: 'Schritt-Karte',
    content:
      'Eine Schrittkarte zeigt den Schrittnamen, die verantwortliche Rolle und die definierten Ein- und Ausgaben. Klicken Sie auf eine Karte, um Details zu bearbeiten.',
    actionLabel: 'Weiter',
  },
  {
    id: 'pb-info-sources',
    targetId: 'info-sources-panel',
    position: 'left',
    title: 'Informationsquellen',
    content:
      'Informationsquellen definieren, woher ein Schritt seine Daten bezieht. Das können CRM-Felder, Dokumente oder manuelle Eingaben sein.',
    actionLabel: 'Weiter',
  },
  {
    id: 'pb-interfaces',
    targetId: 'interfaces-panel',
    position: 'left',
    title: 'Schnittstellen',
    content:
      'Schnittstellen bestimmen, welche externen Systeme bei diesem Schritt angesprochen werden: Bexio, Reonic, Google Calendar oder andere Connectoren.',
    actionLabel: 'Weiter',
  },
  {
    id: 'pb-field-mapping',
    targetId: 'field-mapping-section',
    position: 'bottom',
    title: 'Feldmapping',
    content:
      'Das Feldmapping verbindet Quellfelder aus externen Systemen mit Zielfeldern in der Plattform. Hier definieren Sie Transformationen wie Datumsformat oder numerische Umwandlung.',
    actionLabel: 'Weiter',
  },
  {
    id: 'pb-liquidity',
    targetId: 'liquidity-markers-section',
    position: 'bottom',
    title: 'Liquiditätsmarker',
    content:
      'Liquiditätsmarker verknüpfen Prozessschritte mit der Cashflow-Planung. Sie definieren, wann ein Zahlungsereignis erwartet wird und wie es den Liquiditätsplan beeinflusst.',
    actionLabel: 'Weiter',
  },
  {
    id: 'pb-versioning',
    targetId: 'version-history-button',
    position: 'left',
    title: 'Versionierung',
    content:
      'Jede Änderung an einem Prozess erzeugt eine neue Version. Sie können ältere Versionen einsehen und bei Bedarf wiederherstellen. Nur die aktive Version wird im Betrieb verwendet.',
    actionLabel: 'Weiter',
  },
  {
    id: 'pb-deploy',
    targetId: 'deploy-button',
    position: 'bottom',
    title: 'Prozess bereitstellen',
    content:
      'Wenn alle Schritte definiert und geprüft sind, klicken Sie auf "Bereitstellen", um den Prozess für die Mandanten freizuschalten. Die vorherige Version bleibt als Backup erhalten.',
    actionLabel: 'Tour abschließen',
  },
]

// ---------------------------------------------------------------------------
// Tour registry (maps role key to tour definition)
// ---------------------------------------------------------------------------

export type TourId =
  | 'setter_onboarding'
  | 'berater_onboarding'
  | 'innendienst_onboarding'
  | 'buchhaltung_onboarding'
  | 'holding_admin_onboarding'
  | 'process_builder_walkthrough'

export const TOUR_REGISTRY: Record<TourId, { label: string; steps: TourStep[] }> = {
  setter_onboarding: { label: 'Setter Einführung', steps: SETTER_TOUR },
  berater_onboarding: { label: 'Berater Einführung', steps: BERATER_TOUR },
  innendienst_onboarding: { label: 'Innendienst Einführung', steps: INNENDIENST_TOUR },
  buchhaltung_onboarding: { label: 'Buchhaltung Einführung', steps: BUCHHALTUNG_TOUR },
  holding_admin_onboarding: { label: 'Holding-Admin Einführung', steps: HOLDING_ADMIN_TOUR },
  process_builder_walkthrough: {
    label: 'Process Builder Anleitung',
    steps: PROCESS_BUILDER_WALKTHROUGH,
  },
}

/**
 * Returns the appropriate onboarding tour ID for a given role key.
 * Returns null if no tour is defined for the role.
 */
export function getTourIdForRole(roleKey: string): TourId | null {
  const mapping: Record<string, TourId> = {
    setter: 'setter_onboarding',
    berater: 'berater_onboarding',
    innendienst: 'innendienst_onboarding',
    buchhaltung: 'buchhaltung_onboarding',
    holding_admin: 'holding_admin_onboarding',
  }
  return mapping[roleKey] ?? null
}
