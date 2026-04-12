import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import { HELP_ARTICLES } from '../../data'
import { HelpFeedback } from '@/components/help/HelpFeedback'

type ArticlePageProps = {
  params: {
    level: string
    slug: string[]
  }
}

const LEVEL_LABELS: Record<string, string> = {
  company: 'Unternehmen',
  holding: 'Holding-Verwaltung',
  meta: 'Plattform-Administration',
}

/**
 * Static article content keyed by slug.
 * In production this would be loaded from MDX files on disk or a CMS.
 */
const ARTICLE_CONTENT: Record<string, string> = {
  'erste-schritte': `
## Willkommen auf der Plattform

Diese Anleitung führt Sie durch die ersten Schritte nach der Einrichtung Ihres Benutzerkontos.

### Anmeldung

1. Öffnen Sie die Plattform-URL in Ihrem Browser.
2. Geben Sie Ihre E-Mail-Adresse und das temporäre Passwort ein, das Sie von Ihrem Administrator erhalten haben.
3. Klicken Sie auf **Anmelden**.

### Passwort ändern

Nach der ersten Anmeldung werden Sie aufgefordert, ein neues Passwort zu setzen.
Ihr neues Passwort muss mindestens 12 Zeichen lang sein und Groß-/Kleinbuchstaben, Zahlen und Sonderzeichen enthalten.

### Zwei-Faktor-Authentifizierung (2FA)

Nach dem Passwortwechsel müssen Sie die 2FA einrichten:

1. Scannen Sie den QR-Code mit einer Authenticator-App (z.B. Google Authenticator, Authy).
2. Geben Sie den 6-stelligen Code ein, um die Einrichtung zu bestätigen.
3. **Wichtig:** Bewahren Sie Ihre Wiederherstellungscodes sicher auf.

### Navigation

Nach der Einrichtung gelangen Sie zu Ihrem Dashboard. Die Navigation befindet sich auf der linken Seite (Desktop) oder am unteren Bildschirmrand (Mobil).
  `,
  'setter-dashboard': `
## Setter-Dashboard

Das Setter-Dashboard zeigt Ihnen alle wichtigen KPIs und Statistiken zu Ihrer Setter-Tätigkeit.

### KPIs im Überblick

- **Anrufe/Tag**: Anzahl der getätigten Anrufe pro Tag
- **Erreichbarkeitsquote**: Anteil der beantworteten Anrufe
- **Gebuchte Termine**: Anzahl der vereinbarten Beratungstermine
- **Terminquote**: Verhältnis von Terminen zu Anrufen
- **Durchschnittliche Anrufdauer**: Mittlere Dauer Ihrer Gespräche
- **No-Show-Rate**: Anteil der nicht wahrgenommenen Termine

### KI-Anrufanalyse

Ihre Anrufe werden automatisch analysiert und auf einer Skala von 1-10 in vier Dimensionen bewertet:
Gesprächsführung, Bedarfsermittlung, Einwandbehandlung und Terminvereinbarung.

### Tipps

Nutzen Sie die Filteroptionen, um Ihre KPIs nach Zeitraum zu filtern. Die Tagesbericht-E-Mail fasst Ihre Leistung zusammen.
  `,
  'berater-dashboard': `
## Berater-Dashboard

Das Berater-Dashboard gibt Ihnen einen Überblick über Ihre Pipeline, Abschlussquoten und Umsätze.

### KPIs im Überblick

- **Termine/Woche**: Anzahl Ihrer Beratungstermine
- **Abschlussquote**: Anteil der abgeschlossenen Offerten
- **Offertvolumen (CHF)**: Gesamtwert Ihrer offenen Offerten
- **Deal-Dauer**: Durchschnittliche Zeit bis zum Abschluss
- **Aktivitäten/Tag**: Anzahl der täglichen Vertriebsaktivitäten
- **Umsatz/Berater**: Ihr persönlicher Umsatz

### Pipeline-Ansicht

Die Pipeline zeigt Ihnen alle Offerten nach Status (Entwurf, Gesendet, Verhandlung, Gewonnen, Verloren, Abgelaufen).
  `,
  'leads-verwalten': `
## Leads verwalten

In der Lead-Übersicht sehen Sie alle zugewiesenen Leads mit Status und Bearbeitungshistorie.

### Lead-Status

- **Neu**: Frisch eingegangener Lead
- **Kontaktiert**: Erster Kontakt hergestellt
- **Qualifiziert**: Lead als potenzieller Kunde eingestuft
- **Termin vereinbart**: Beratungstermin steht
- **Gewonnen/Verloren**: Abschluss oder Absage

### Filtern und Sortieren

Nutzen Sie die Filterleiste, um Leads nach Status, Quelle oder Zeitraum einzugrenzen.
  `,
  'projekte-kanban': `
## Projekte und Kanban-Board

Das 27-Phasen-Kanban-Board bildet den gesamten Projektlebenszyklus ab.

### Phasen-Überblick

Projekte durchlaufen 27 Phasen von der Auftragsbestätigung bis zur Schlussabnahme. Jede Phase hat klare Kriterien, wann ein Projekt in die nächste Phase wechseln kann.

### Warnungen

Projekte, die länger als die konfigurierte Schwelle in einer Phase verbleiben, werden automatisch hervorgehoben.

### Drag-and-Drop

Berechtigte Benutzer können Projekte per Drag-and-Drop zwischen Phasen verschieben.
  `,
  'finanzen-cashflow': `
## Finanzen und Cashflow

Das Finanzmodul zeigt Rechnungen, Zahlungseingänge und Liquiditätsprognosen.

### KPIs

- **Monatsumsatz**: Gesamtumsatz des aktuellen Monats
- **Offene Forderungen**: Unbezahlte Rechnungen
- **Überfällige Rechnungen**: Rechnungen nach Fälligkeit
- **Wöchentliche Zahlungen**: Eingegangene Zahlungen
- **Liquiditätsprognose**: 30/60/90-Tage-Vorschau

### Cashflow-Upload

Sie können Excel-Dateien mit Cashflow-Daten hochladen. Das System validiert und importiert die Daten automatisch.
  `,
  'tagesberichte': `
## Tagesberichte

Jeden Morgen erhalten Geschäftsführer und Teamleiter einen automatisch generierten Tagesbericht per E-Mail.

### Inhalt

- KPI-Zusammenfassung des Vortages
- Highlights und Warnungen
- Coaching-Empfehlungen pro Mitarbeiter

### Konfiguration

Super User können den Versandzeitpunkt und die Empfänger in den Einstellungen anpassen.
  `,
  'mandantenverwaltung': `
## Mandantenverwaltung

Als Holding-Admin können Sie Mandanten (Unternehmen) anlegen und verwalten.

### Mandant anlegen

1. Navigieren Sie zu **Admin > Mandanten > Neu**.
2. Geben Sie den Firmennamen und den Slug (Subdomain) ein.
3. Laden Sie ein Branding-Paket (brand.json) hoch.
4. Der Mandant wird automatisch mit Standardrollen und Berechtigungen initialisiert.

### Branding

Jeder Mandant erhält ein eigenes Farbschema, Logo und Schriftart. Das Branding wird serverseitig aufgelöst.
  `,
  'connector-einstellungen': `
## Connector-Einstellungen

Connectors verbinden die Plattform mit externen Systemen.

### Verfügbare Connectors

| Connector | Sync-Intervall | Authentifizierung |
|-----------|---------------|-------------------|
| Reonic CRM | 15 Min. | REST API Key |
| 3CX Cloud | 15 Min. | REST API + Webhook |
| Bexio | 1 Stunde | OAuth 2.0 |
| Google Calendar | 15 Min. | Google OAuth |
| Leadnotes | 15 Min. | REST API Key |

### Status prüfen

Auf der Connector-Übersichtsseite sehen Sie den Status jeder Verbindung. Bei Fehlern wird der Holding-Admin nach 3 fehlgeschlagenen Versuchen benachrichtigt.
  `,
  'rollen-berechtigungen': `
## Rollen und Berechtigungen

Das Berechtigungssystem steuert den Zugriff auf Module und Funktionen.

### Verfügbare Rollen

- **Super User**: Voller Mandantenzugriff
- **Geschäftsführung**: Alle Module, alle Mitarbeiter
- **Teamleiter**: Team-KPIs, kein Finanzzugriff
- **Setter/Berater**: Nur eigene Daten
- **Innendienst**: Planung, kein Vertrieb
- **Bau/Montage**: Zugewiesene Projekte
- **Buchhaltung**: Finanzen, keine Vertriebs-KPIs
- **Leadkontrolle**: Alle Leads, keine Finanzen

### Rollen zuweisen

Navigieren Sie zu **Einstellungen > Benutzer**, wählen Sie einen Benutzer und weisen Sie die gewünschte Rolle zu.
  `,
  'plattform-admin': `
## Plattform-Administration

Nur für Enura-Administratoren. Hier verwalten Sie Holdings und plattformweite Einstellungen.

### Holdings verwalten

Ein Holding ist die übergeordnete Organisationseinheit, der mehrere Unternehmen zugeordnet werden können.

### System-Monitoring

Überwachen Sie den Zustand der Plattform: Connector-Health, Job-Queues und Systemmetriken.
  `,
  'datenbank-migrationen': `
## Datenbank und Migrationen

Technische Dokumentation zum Datenbankschema und Migrationsprozess.

### Schema

Das autoritative Schema liegt unter \`supabase/schema.sql\`. Änderungen erfolgen ausschließlich über nummerierte Migrationen.

### TimescaleDB

Die Tabellen \`calls\`, \`cashflow_entries\`, \`calendar_events\`, \`kpi_snapshots\` und \`audit_log\` sind Hypertables. Queries müssen immer einen Zeitfilter enthalten.

### Migrationsprozess

1. Erstellen Sie eine neue Datei unter \`supabase/migrations/\`.
2. Führen Sie die Migration lokal aus.
3. Synchronisieren Sie das Prisma-Schema mit \`pnpm prisma db pull\`.
  `,
  'liquiditaetsplanung': `
## Liquiditätsplanung

Die Liquiditätsplanung zeigt Budget-, Plan- und Ist-Werte für alle Zahlungsströme Ihrer Projekte.

### Drei Kategorien

- **Budget**: Geplanter Betrag aus dem Prozessschritt-Template (vom Holding Admin im Process Builder festgelegt)
- **Plan (Scheduled)**: Durch den Cash-out-Planer terminierte Zahlung — entsteht nach technischer Genehmigung einer Rechnung
- **Ist (Actual)**: Tatsächlicher Zahlungseingang/-ausgang (aus Bexio-Abgleich, Bank-Upload oder manueller Eingabe)

### Anzeigelogik

Die Anzeige folgt einer Priorität: **Ist > Plan > Budget**. Wenn ein Ist-Wert vorhanden ist, wird dieser angezeigt. Plan und Budget erscheinen als Vergleichszeile.

### Restwerte

Wenn eine Rechnung kleiner als das Budget ist, kann der Cash-out-Planer einen Restwert anlegen. Maximal drei Restwerte pro Prozessschritt sind möglich.

### Manueller Eintrag

Klicken Sie auf ein Liquiditätsereignis, um manuell Ist-Werte einzutragen (z.B. bei fehlender Bexio-Anbindung).
  `,
  'anomalien': `
## Anomalien und Warnungen

Das Anomalie-Modul erkennt automatisch kritische Abweichungen in Ihren Geschäftsprozessen.

### Schweregrade

- **Kritisch** (rot): Sofortige Aufmerksamkeit erforderlich — erscheint als Banner im Dashboard
- **Warnung** (gelb): Potenzielle Probleme, die beobachtet werden sollten
- **Info** (blau): Informative Hinweise ohne Handlungsbedarf

### Behandlung

Klicken Sie auf eine Anomalie, um Details zu sehen. Sie können Anomalien als "behandelt" markieren oder Kommentare hinzufügen.
  `,
  'branding': `
## Corporate Design / Branding

Verwalten Sie das visuelle Erscheinungsbild Ihrer Firmenumgebung.

### Markenfarben

Jede Company erbt die Grundfarben von der Holding. Super User können einzelne Farben überschreiben:
- **Primärfarbe**: Hauptaktionsfarbe für Buttons und aktive Elemente
- **Sekundärfarbe**: Texte und Überschriften
- **Akzentfarbe**: Hervorhebungen und Badges
- **Hintergrund/Oberfläche**: Seiten- und Kartenhintergrund
- **Textfarben**: Haupt- und Nebentextfarbe

### Erweiterte Designwerte

Schatten, Schriftgrößen, Zeilenhöhe und Rahmenbreite können feinjustiert werden.

### Benutzerdefiniertes CSS

Laden Sie eine eigene CSS-Datei hoch für fortgeschrittene Anpassungen. Die Datei wird vor dem Hochladen auf Sicherheit geprüft.

### Vorschau

Im Vorschau-Tab sehen Sie eine Live-Vorschau Ihrer Designänderungen vor dem Speichern.
  `,
  'benutzer-verwalten': `
## Benutzer verwalten

Super User und Administratoren können Benutzer anlegen, Rollen zuweisen und Passwörter zurücksetzen.

### Neuen Benutzer anlegen

1. Navigieren Sie zu **Benutzer** in den Einstellungen.
2. Klicken Sie auf **Neuer Benutzer**.
3. Geben Sie Name, E-Mail und die gewünschte Rolle ein.
4. Der Benutzer erhält ein temporäres Passwort und muss es beim ersten Login ändern.

### Rollen

Jede Rolle bestimmt, welche Module der Benutzer sehen kann:
- **Setter**: Anrufe und Terminbuchungen
- **Berater**: Pipeline und Abschlüsse
- **Innendienst**: Planung und IA-Status
- **Buchhaltung**: Finanzen und Cashflow
- **Geschäftsführung**: Alle Module (nur Lesen)
- **Teamleiter**: Setter, Berater und Leads
- **Super User**: Voller Zugriff inkl. Einstellungen

### Finanzplanung-Rollen

Falls das Finanzplanung-Modul aktiviert ist, stehen zusätzliche Rollen zur Verfügung:
- **Rechnungsprüfer**: Formale und inhaltliche Prüfung
- **Rechnungsgenehmiger**: Technische Freigabe
- **Cash-out-Planer**: Zahlungsterminierung
- **Finanzieller Genehmiger**: Finale Zahlungsfreigabe
  `,
  'integrationen': `
## Integrationen und Connectoren

Verbinden Sie externe Systeme mit der Plattform, um Daten automatisch zu synchronisieren.

### Verfügbare Connectoren

| Connector | Typ | Synchronisation |
|-----------|-----|-----------------|
| Reonic CRM | REST API | Alle 15 Minuten |
| 3CX Cloud | REST + Webhook | Alle 15 Minuten |
| Bexio | OAuth 2.0 | Stündlich |
| Google Calendar | Google OAuth | Alle 15 Minuten |
| Leadnotes | REST API | Alle 15 Minuten |

### Einrichtung

1. Navigieren Sie zu **Integrationen** in den Einstellungen.
2. Wählen Sie den gewünschten Connector.
3. Geben Sie die API-Zugangsdaten ein.
4. Klicken Sie auf **Verbindung testen**.
5. Nach erfolgreichem Test wird die automatische Synchronisation gestartet.

### Connector-Status

Der Gesundheitsstatus jedes Connectors wird auf der Übersichtsseite angezeigt. Bei Fehlern erhalten Sie eine Warnung im Dashboard.
  `,
  'leitfaden': `
## Leitfaden / Anrufskript

Erstellen und verwalten Sie Anrufskripte, die von der KI-Anrufanalyse als Bewertungsgrundlage verwendet werden.

### Skript erstellen

1. Navigieren Sie zu **Leitfaden** in den Einstellungen.
2. Bearbeiten Sie den Skripttext im Editor.
3. Klicken Sie auf **Speichern**.

### KI-Bewertung

Die KI bewertet Setter-Anrufe anhand des hinterlegten Skripts auf vier Dimensionen:
- Skripttreue
- Einwandbehandlung
- Gesprächsführung
- Terminvereinbarung

Jede Dimension erhält einen Score von 1-10.
  `,
  'finanzplanung-uebersicht': `
## Finanzplanung — Übersicht

Das Finanzplanung-Modul ist ein separates Add-on, das von der Holding lizenziert und pro Unternehmen aktiviert wird. Es deckt die Cash-OUT-Seite ab: eingehende Rechnungen, deren Validierung, Genehmigung und gesteuerte Auszahlungsplanung.

### Module

Das Finanzplanung-Modul besteht aus drei Bereichen:

1. **Rechnungseingang**: Eingehende Rechnungen werden per E-Mail, Upload oder API empfangen und durch KI automatisch ausgelesen.
2. **Validierungs-Workflow**: Dreistufiger Prüf- und Freigabeprozess (formale Prüfung → inhaltliche Prüfung → technische Genehmigung).
3. **Cash-out-Planung**: Genehmigte Rechnungen terminieren, Zahlungsläufe erstellen und Zahlungsdateien exportieren.

### Rollen

| Rolle | Zuständigkeit |
|-------|----------------|
| Rechnungsprüfer | Formale und inhaltliche Prüfung (Schritt 1 + 2) |
| Rechnungsgenehmiger | Technische Freigabe (Schritt 3) |
| Cash-out-Planer | Zahlungsterminierung und Zahlungslauf-Erstellung |
| Finanzieller Genehmiger | Finale Freigabe von Zahlungsläufen |

### Aktivierung

Das Modul wird über **Holding Admin → Add-ons** pro Unternehmen aktiviert.
  `,
  'finanzplanung-eingang': `
## Finanzplanung — Rechnungseingang

### Rechnungen empfangen

Rechnungen können auf drei Wegen eingehen:
- **E-Mail**: Automatisches Polling eines dedizierten Rechnungseingangs-Postfachs
- **Manueller Upload**: PDF oder Bild direkt in der Plattform hochladen
- **API/Webhook**: Push-Eingang aus Buchhaltungssoftware (später)

### KI-Extraktion

Sobald eine Rechnung eingeht, extrahiert die KI automatisch:
- Rechnungssteller (Name, Adresse, USt-Nr., Kontaktdaten)
- Empfänger
- Rechnungsnummer und -datum
- Einzelne Positionen (Beschreibung, Menge, Preis)
- Summen (Netto, USt, Brutto)
- Zahlungsziel und Fälligkeitsdatum

### Projekt-Matching

Die extrahierten Daten werden automatisch einem Projekt zugeordnet. Bei niedriger Konfidenz (< 80%) erscheint die Rechnung im Status "Match-Prüfung" und muss manuell zugewiesen werden.

### Dreistufiger Validierungs-Workflow

**Schritt 1 — Formale Prüfung** (Rechnungsprüfer):
- Vollständige Absenderangaben vorhanden?
- Rechnungsnummer und -datum vorhanden?
- USt-Ausweis korrekt?
- Entscheidung: Weiter zu Schritt 2 oder Zurücksenden

**Schritt 2 — Inhaltliche Prüfung** (Rechnungsprüfer):
- Fälligkeitsdatum prüfen oder überschreiben
- Budget-Vergleich (Rechnungswert vs. Prozessschritt-Budget)
- Entscheidung: Weiter zu Schritt 3 oder Zurücksenden

**Schritt 3 — Technische Genehmigung** (Rechnungsgenehmiger):
- Rechnungsdetails, Scan-Vorschau und Validator-Kommentar prüfen
- Genehmigung über Plattform oder WhatsApp
- Entscheidung: Genehmigen oder Ablehnen
  `,
  'finanzplanung-planung': `
## Finanzplanung — Zahlungsplanung

### Cash-out-Planungs-Tool

Nach technischer Genehmigung erscheinen Rechnungen im Planungs-Tool des Cash-out-Planers.

### Kalender-Ansicht

Die Hauptansicht zeigt Rechnungen als Karten in Datumsspalten:
- **Täglich**: Detaillierte kurzfristige Planung
- **Wöchentlich**: Mittelfristige Übersicht
- **Monatlich**: Strategische Liquiditätsplanung

Per Drag-and-Drop können Rechnungskarten in andere Datumsspalten verschoben werden, um das Zahlungsdatum zu ändern.

### Zahlungslauf erstellen

1. Wählen Sie genehmigte Rechnungen aus
2. Erstellen Sie einen Zahlungslauf für ein bestimmtes Datum
3. Prüfen Sie jede Position im Zahlungslauf
4. Reichen Sie den Zahlungslauf zur Genehmigung ein

### Finale Freigabe

Der Finanzielle Genehmiger muss jede Position mindestens einmal öffnen, bevor der "Finale Freigabe"-Button aktiv wird. Nach Freigabe wird die Zahlungsdatei generiert.

### Zahlungsdatei-Formate

- **pain.001 CH** (Swiss Payment Standards / SPS)
- **pain.001 SEPA** (EU-Standard)
- **MT101** (SWIFT Legacy)
- **CSV** (konfigurierbar)

Die Datei wird zum Download bereitgestellt und manuell im E-Banking importiert.
  `,
  'finanzplanung-lieferanten': `
## Finanzplanung — Lieferanten

### Lieferanten-Stammdaten

Die Lieferantentabelle wird automatisch aus eingehenden Rechnungen befüllt. Der Cash-out-Planer kann Lieferanten auch manuell anlegen und bearbeiten.

### Felder

- **Name und Adresse**: Firmenname, Straße, PLZ, Ort, Land
- **Identifikatoren**: Handelsregisternummer, USt-IdNr.
- **Kontakt**: Ansprechpartner, Telefon, E-Mail
- **Banking**: IBAN, BIC, Bankname
- **Zahlungsziel**: Bevorzugtes Zahlungsziel in Tagen (Standard: 30)

### Automatisches Matching

Bei eingehenden Rechnungen wird der Rechnungssteller automatisch mit bestehenden Lieferanten abgeglichen — zuerst über USt-Nr., dann IBAN, dann normalisierter Name. Wird kein Match gefunden, wird ein neuer Lieferant angelegt.
  `,
  'prozessvorlagen': `
## Prozessvorlagen hochladen

### JSON-Vorlagen

Prozessvorlagen werden als JSON-Dateien hochgeladen und stehen danach beim Erstellen neuer Prozesse als Ausgangsbasis zur Verfügung.

### Format

Die JSON-Datei muss folgende Struktur haben:

\`\`\`json
{
  "name": "Prozessname",
  "description": "Beschreibung",
  "category": "verkauf",
  "version": "1.0.0",
  "steps": [
    {
      "name": "Schrittname",
      "description": "Beschreibung",
      "responsible_roles": ["setter"],
      "sort_order": 0,
      "typical_hours": 1,
      "show_in_flowchart": true
    }
  ]
}
\`\`\`

### Kategorien

Erlaubte Kategorien: verkauf, planung, abwicklung, betrieb, sonstige

### Beispielvorlage

Laden Sie die Beispielvorlage unter **Vorlagen verwalten → Beispielvorlage herunterladen** herunter.
  `,
  'prozess-builder': `
## Prozess-Builder

Der Prozess-Builder ermöglicht Holding-Administratoren, Geschäftsprozesse für ihre Tochtergesellschaften zu entwerfen.

### Prozess erstellen

1. Navigieren Sie zu **Prozesse** im Holding-Admin-Bereich.
2. Wählen Sie ein Unternehmen und klicken Sie auf **Neuer Prozess**.
3. Wählen Sie optional eine Vorlage als Ausgangsbasis.
4. Definieren Sie Schritte mit Verantwortlichkeiten, Zeitvorgaben und Liquiditätsmarkern.

### Prozessschritte

Jeder Schritt kann konfiguriert werden mit:
- **Name und Beschreibung**
- **Verantwortliche Rollen**: Wer ist für diesen Schritt zuständig?
- **Erwartete Dauer**: Sollzeit in Stunden
- **Warnung nach X Tagen**: Automatische Warnung bei Verzögerung
- **Liquiditätsmarker**: Trigger oder Event für die Liquiditätsplanung
- **Datenquellen**: Welche externen Systeme liefern Daten?
- **Schnittstellen**: API-Verbindungen für automatische Datenübertragung

### Deployment

Fertige Prozesse werden über den Deployment-Workflow an die Zielunternehmen verteilt. Änderungen erfordern eine neue Version und Genehmigung.
  `,
  'addons': `
## Add-on Module verwalten

### Finanzplanung-Modul

Das Finanzplanung-Modul ist ein separates Add-on, das nicht im Grundpaket enthalten ist.

### Aktivierung

1. **Holding-Ebene**: Das Modul muss zuerst für Ihre Holding lizenziert werden. Wenden Sie sich an Ihren Enura-Ansprechpartner.
2. **Company-Ebene**: Nach der Lizenzierung können Sie das Modul über **Add-ons** in den Holding-Einstellungen pro Unternehmen aktivieren/deaktivieren.

### Toggle

Verwenden Sie den Schalter neben jedem Unternehmen, um das Modul zu aktivieren oder zu deaktivieren. Die Änderung wird sofort wirksam.
  `,
  'compliance': `
## Compliance und Zertifizierungen

### Compliance-Regeln

Definieren Sie Compliance-Regeln, die automatisch gegen Ihre Geschäftsprozesse geprüft werden. Regeln können manuell oder automatisch ausgewertet werden.

### Prüfungen

Compliance-Prüfungen werden regelmäßig durchgeführt und dokumentiert. Jede Prüfung erhält einen Status: bestanden, nicht bestanden, oder ausstehend.

### Zertifizierungen

Verwalten Sie Zertifizierungen (z.B. ISO 9001, ISO 14001) mit Ablaufdaten. Das System warnt rechtzeitig vor auslaufenden Zertifizierungen.

### Dokumente

Laden Sie Compliance-relevante Dokumente hoch und verknüpfen Sie diese mit Regeln und Prüfungen.
  `,
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const session = await getSession()
  if (!session) return (<div className="p-8 text-center"><p className="text-gray-500">Nicht angemeldet.</p><a href="/login" className="text-blue-600 underline">Zur Anmeldung</a></div>)

  const { level, slug } = params
  const articleSlug = slug.join('/')

  // Validate level
  if (!['company', 'holding', 'meta'].includes(level)) {
    return (<div className="p-8 text-center"><p className="text-gray-500">Nicht gefunden.</p><a href="/" className="text-blue-600 underline">Zurück</a></div>)
  }

  // Check access
  const accessibleLevels: string[] = ['company']
  if (session.isHoldingAdmin || session.isEnuraAdmin) accessibleLevels.push('holding')
  if (session.isEnuraAdmin) accessibleLevels.push('meta')

  if (!accessibleLevels.includes(level)) {
    return (<div className="p-8 text-center"><a href="/help" className="text-blue-600 underline">Weiter</a></div>)
  }

  // Find article metadata
  const article = HELP_ARTICLES.find((a) => a.slug === articleSlug && a.level === level)
  if (!article) {
    return (<div className="p-8 text-center"><p className="text-gray-500">Nicht gefunden.</p><a href="/" className="text-blue-600 underline">Zurück</a></div>)
  }

  // Get content
  const content = ARTICLE_CONTENT[articleSlug] ?? ''
  const renderedHtml = renderMarkdown(content)

  // Previous / next navigation within same level
  const sameLevel = HELP_ARTICLES.filter((a) => a.level === level)
  const currentIndex = sameLevel.findIndex((a) => a.slug === articleSlug)
  const prevArticle = currentIndex > 0 ? sameLevel[currentIndex - 1] : null
  const nextArticle = currentIndex < sameLevel.length - 1 ? sameLevel[currentIndex + 1] : null

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back to platform */}
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        ← Zurück zur Plattform
      </Link>

      {/* Breadcrumb */}
      <nav className="mb-6 text-sm" aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-brand-text-secondary">
          <li>
            <Link
              href="/help"
              className="hover:text-brand-text-primary hover:underline"
            >
              Hilfe-Center
            </Link>
          </li>
          <li aria-hidden="true">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </li>
          <li>
            <Link
              href="/help"
              className="hover:text-brand-text-primary hover:underline"
            >
              {LEVEL_LABELS[level] ?? level}
            </Link>
          </li>
          <li aria-hidden="true">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </li>
          <li className="font-medium text-brand-text-primary" aria-current="page">
            {article.title}
          </li>
        </ol>
      </nav>

      {/* Title and metadata */}
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-brand-text-primary">
          {article.title}
        </h1>
        <p className="mt-2 text-sm text-brand-text-secondary">
          Lesezeit: ca. {article.readingTimeMinutes} Minuten
        </p>
      </header>

      {/* Article content */}
      <article
        className="max-w-none"
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />

      {/* Feedback widget */}
      <div className="mt-10 border-t border-gray-200 pt-6">
        <HelpFeedback articleSlug={articleSlug} articleLevel={level} />
      </div>

      {/* Prev / Next navigation */}
      <nav
        className="mt-8 flex items-center justify-between border-t border-gray-200 pt-6"
        aria-label="Artikelnavigation"
      >
        {prevArticle ? (
          <Link
            href={`/help/${prevArticle.level}/${prevArticle.slug}`}
            className="group flex items-center gap-2 text-sm text-brand-text-secondary hover:text-brand-text-primary"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="group-hover:underline">{prevArticle.title}</span>
          </Link>
        ) : (
          <span />
        )}

        {nextArticle ? (
          <Link
            href={`/help/${nextArticle.level}/${nextArticle.slug}`}
            className="group flex items-center gap-2 text-sm text-brand-text-secondary hover:text-brand-text-primary"
          >
            <span className="group-hover:underline">{nextArticle.title}</span>
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Minimal markdown-to-HTML renderer (no external dependency)
// Handles: headings, bold, inline code, code blocks, lists, tables, paragraphs
// ---------------------------------------------------------------------------

function renderMarkdown(md: string): string {
  const lines = md.trim().split('\n')
  const html: string[] = []
  let inList = false
  let listType: 'ul' | 'ol' = 'ul'
  let inTable = false
  let inCodeBlock = false
  let codeBlockContent: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''

    // Code blocks
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        html.push(`<pre class="rounded-brand bg-gray-100 p-4 text-xs overflow-x-auto"><code>${codeBlockContent.join('\n')}</code></pre>`)
        codeBlockContent = []
        inCodeBlock = false
      } else {
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeBlockContent.push(escapeHtml(line))
      continue
    }

    // Close open list if current line is not a list item
    if (inList && !line.trim().startsWith('- ') && !line.trim().match(/^\d+\.\s/)) {
      html.push(listType === 'ol' ? '</ol>' : '</ul>')
      inList = false
    }

    // Close open table
    if (inTable && !line.trim().startsWith('|')) {
      html.push('</tbody></table>')
      inTable = false
    }

    const trimmed = line.trim()

    // Empty line
    if (trimmed === '') {
      continue
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      html.push(`<h3 class="text-base font-semibold text-brand-text-primary mt-8 mb-3">${inlineFormat(trimmed.slice(4))}</h3>`)
      continue
    }
    if (trimmed.startsWith('## ')) {
      html.push(`<h2 class="text-lg font-bold text-brand-text-primary mt-10 mb-4 pb-2 border-b border-gray-200">${inlineFormat(trimmed.slice(3))}</h2>`)
      continue
    }
    if (trimmed.startsWith('# ')) {
      html.push(`<h1 class="text-xl font-bold text-brand-text-primary mt-10 mb-4">${inlineFormat(trimmed.slice(2))}</h1>`)
      continue
    }

    // Table
    if (trimmed.startsWith('|')) {
      const cells = trimmed
        .split('|')
        .filter((c) => c.trim() !== '')
        .map((c) => c.trim())

      // Skip separator rows
      if (cells.every((c) => /^[-:]+$/.test(c))) {
        continue
      }

      if (!inTable) {
        html.push('<table class="w-full text-sm"><thead><tr>')
        cells.forEach((c) => html.push(`<th class="border-b border-gray-300 px-3 py-2 text-left font-semibold">${inlineFormat(c)}</th>`))
        html.push('</tr></thead><tbody>')
        inTable = true
      } else {
        html.push('<tr>')
        cells.forEach((c) => html.push(`<td class="border-b border-gray-200 px-3 py-2">${inlineFormat(c)}</td>`))
        html.push('</tr>')
      }
      continue
    }

    // Unordered list
    if (trimmed.startsWith('- ')) {
      if (!inList) {
        html.push('<ul class="list-disc pl-5 space-y-2 mb-4">')
        inList = true
        listType = 'ul'
      }
      html.push(`<li class="text-sm text-brand-text-secondary">${inlineFormat(trimmed.slice(2))}</li>`)
      continue
    }

    // Ordered list
    const orderedMatch = trimmed.match(/^(\d+)\.\s(.*)/)
    if (orderedMatch) {
      if (!inList) {
        html.push('<ol class="list-decimal pl-5 space-y-2 mb-4">')
        inList = true
        listType = 'ol'
      }
      html.push(`<li class="text-sm text-brand-text-secondary">${inlineFormat(orderedMatch[2] ?? '')}</li>`)
      continue
    }

    // Paragraph
    html.push(`<p class="text-sm leading-relaxed text-brand-text-secondary mb-4">${inlineFormat(trimmed)}</p>`)
  }

  // Close trailing open elements
  if (inList) html.push(listType === 'ol' ? '</ol>' : '</ul>')
  if (inTable) html.push('</tbody></table>')
  if (inCodeBlock) {
    html.push(`<pre class="rounded-brand bg-gray-100 p-4 text-xs overflow-x-auto"><code>${codeBlockContent.join('\n')}</code></pre>`)
  }

  return html.join('\n')
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inlineFormat(text: string): string {
  let result = escapeHtml(text)
  // Bold
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // Inline code
  result = result.replace(/`(.+?)`/g, '<code class="rounded bg-gray-100 px-1 py-0.5 text-xs">$1</code>')
  return result
}
