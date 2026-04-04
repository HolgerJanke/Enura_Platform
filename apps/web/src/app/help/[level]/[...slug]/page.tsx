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

Diese Anleitung fuehrt Sie durch die ersten Schritte nach der Einrichtung Ihres Benutzerkontos.

### Anmeldung

1. Oeffnen Sie die Plattform-URL in Ihrem Browser.
2. Geben Sie Ihre E-Mail-Adresse und das temporaere Passwort ein, das Sie von Ihrem Administrator erhalten haben.
3. Klicken Sie auf **Anmelden**.

### Passwort aendern

Nach der ersten Anmeldung werden Sie aufgefordert, ein neues Passwort zu setzen.
Ihr neues Passwort muss mindestens 12 Zeichen lang sein und Gross-/Kleinbuchstaben, Zahlen und Sonderzeichen enthalten.

### Zwei-Faktor-Authentifizierung (2FA)

Nach dem Passwortwechsel muessen Sie die 2FA einrichten:

1. Scannen Sie den QR-Code mit einer Authenticator-App (z.B. Google Authenticator, Authy).
2. Geben Sie den 6-stelligen Code ein, um die Einrichtung zu bestaetigen.
3. **Wichtig:** Bewahren Sie Ihre Wiederherstellungscodes sicher auf.

### Navigation

Nach der Einrichtung gelangen Sie zu Ihrem Dashboard. Die Navigation befindet sich auf der linken Seite (Desktop) oder am unteren Bildschirmrand (Mobil).
  `,
  'setter-dashboard': `
## Setter-Dashboard

Das Setter-Dashboard zeigt Ihnen alle wichtigen KPIs und Statistiken zu Ihrer Setter-Taetigkeit.

### KPIs im Ueberblick

- **Anrufe/Tag**: Anzahl der getaetigten Anrufe pro Tag
- **Erreichbarkeitsquote**: Anteil der beantworteten Anrufe
- **Gebuchte Termine**: Anzahl der vereinbarten Beratungstermine
- **Terminquote**: Verhaeltnis von Terminen zu Anrufen
- **Durchschnittliche Anrufdauer**: Mittlere Dauer Ihrer Gespraeche
- **No-Show-Rate**: Anteil der nicht wahrgenommenen Termine

### KI-Anrufanalyse

Ihre Anrufe werden automatisch analysiert und auf einer Skala von 1-10 in vier Dimensionen bewertet:
Gespraechsfuehrung, Bedarfsermittlung, Einwandbehandlung und Terminvereinbarung.

### Tipps

Nutzen Sie die Filteroptionen, um Ihre KPIs nach Zeitraum zu filtern. Die Tagesbericht-E-Mail fasst Ihre Leistung zusammen.
  `,
  'berater-dashboard': `
## Berater-Dashboard

Das Berater-Dashboard gibt Ihnen einen Ueberblick ueber Ihre Pipeline, Abschlussquoten und Umsaetze.

### KPIs im Ueberblick

- **Termine/Woche**: Anzahl Ihrer Beratungstermine
- **Abschlussquote**: Anteil der abgeschlossenen Offerten
- **Offertvolumen (CHF)**: Gesamtwert Ihrer offenen Offerten
- **Deal-Dauer**: Durchschnittliche Zeit bis zum Abschluss
- **Aktivitaeten/Tag**: Anzahl der taeglichen Vertriebsaktivitaeten
- **Umsatz/Berater**: Ihr persoenlicher Umsatz

### Pipeline-Ansicht

Die Pipeline zeigt Ihnen alle Offerten nach Status (Entwurf, Gesendet, Verhandlung, Gewonnen, Verloren, Abgelaufen).
  `,
  'leads-verwalten': `
## Leads verwalten

In der Lead-Uebersicht sehen Sie alle zugewiesenen Leads mit Status und Bearbeitungshistorie.

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

### Phasen-Ueberblick

Projekte durchlaufen 27 Phasen von der Auftragsbestaetigung bis zur Schlussabnahme. Jede Phase hat klare Kriterien, wann ein Projekt in die naechste Phase wechseln kann.

### Warnungen

Projekte, die laenger als die konfigurierte Schwelle in einer Phase verbleiben, werden automatisch hervorgehoben.

### Drag-and-Drop

Berechtigte Benutzer koennen Projekte per Drag-and-Drop zwischen Phasen verschieben.
  `,
  'finanzen-cashflow': `
## Finanzen und Cashflow

Das Finanzmodul zeigt Rechnungen, Zahlungseingaenge und Liquiditaetsprognosen.

### KPIs

- **Monatsumsatz**: Gesamtumsatz des aktuellen Monats
- **Offene Forderungen**: Unbezahlte Rechnungen
- **Ueberfaellige Rechnungen**: Rechnungen nach Faelligkeit
- **Woechentliche Zahlungen**: Eingegangene Zahlungen
- **Liquiditaetsprognose**: 30/60/90-Tage-Vorschau

### Cashflow-Upload

Sie koennen Excel-Dateien mit Cashflow-Daten hochladen. Das System validiert und importiert die Daten automatisch.
  `,
  'tagesberichte': `
## Tagesberichte

Jeden Morgen erhalten Geschaeftsfuehrer und Teamleiter einen automatisch generierten Tagesbericht per E-Mail.

### Inhalt

- KPI-Zusammenfassung des Vortages
- Highlights und Warnungen
- Coaching-Empfehlungen pro Mitarbeiter

### Konfiguration

Super User koennen den Versandzeitpunkt und die Empfaenger in den Einstellungen anpassen.
  `,
  'mandantenverwaltung': `
## Mandantenverwaltung

Als Holding-Admin koennen Sie Mandanten (Unternehmen) anlegen und verwalten.

### Mandant anlegen

1. Navigieren Sie zu **Admin > Mandanten > Neu**.
2. Geben Sie den Firmennamen und den Slug (Subdomain) ein.
3. Laden Sie ein Branding-Paket (brand.json) hoch.
4. Der Mandant wird automatisch mit Standardrollen und Berechtigungen initialisiert.

### Branding

Jeder Mandant erhaelt ein eigenes Farbschema, Logo und Schriftart. Das Branding wird serverseitig aufgeloest.
  `,
  'connector-einstellungen': `
## Connector-Einstellungen

Connectors verbinden die Plattform mit externen Systemen.

### Verfuegbare Connectors

| Connector | Sync-Intervall | Authentifizierung |
|-----------|---------------|-------------------|
| Reonic CRM | 15 Min. | REST API Key |
| 3CX Cloud | 15 Min. | REST API + Webhook |
| Bexio | 1 Stunde | OAuth 2.0 |
| Google Calendar | 15 Min. | Google OAuth |
| Leadnotes | 15 Min. | REST API Key |

### Status pruefen

Auf der Connector-Uebersichtsseite sehen Sie den Status jeder Verbindung. Bei Fehlern wird der Holding-Admin nach 3 fehlgeschlagenen Versuchen benachrichtigt.
  `,
  'rollen-berechtigungen': `
## Rollen und Berechtigungen

Das Berechtigungssystem steuert den Zugriff auf Module und Funktionen.

### Verfuegbare Rollen

- **Super User**: Voller Mandantenzugriff
- **Geschaeftsfuehrung**: Alle Module, alle Mitarbeiter
- **Teamleiter**: Team-KPIs, kein Finanzzugriff
- **Setter/Berater**: Nur eigene Daten
- **Innendienst**: Planung, kein Vertrieb
- **Bau/Montage**: Zugewiesene Projekte
- **Buchhaltung**: Finanzen, keine Vertriebs-KPIs
- **Leadkontrolle**: Alle Leads, keine Finanzen

### Rollen zuweisen

Navigieren Sie zu **Einstellungen > Benutzer**, waehlen Sie einen Benutzer und weisen Sie die gewuenschte Rolle zu.
  `,
  'plattform-admin': `
## Plattform-Administration

Nur fuer Enura-Administratoren. Hier verwalten Sie Holdings und plattformweite Einstellungen.

### Holdings verwalten

Ein Holding ist die uebergeordnete Organisationseinheit, der mehrere Unternehmen zugeordnet werden koennen.

### System-Monitoring

Ueberwachen Sie den Zustand der Plattform: Connector-Health, Job-Queues und Systemmetriken.
  `,
  'datenbank-migrationen': `
## Datenbank und Migrationen

Technische Dokumentation zum Datenbankschema und Migrationsprozess.

### Schema

Das autoritative Schema liegt unter \`supabase/schema.sql\`. Aenderungen erfolgen ausschliesslich ueber nummerierte Migrationen.

### TimescaleDB

Die Tabellen \`calls\`, \`cashflow_entries\`, \`calendar_events\`, \`kpi_snapshots\` und \`audit_log\` sind Hypertables. Queries muessen immer einen Zeitfilter enthalten.

### Migrationsprozess

1. Erstellen Sie eine neue Datei unter \`supabase/migrations/\`.
2. Fuehren Sie die Migration lokal aus.
3. Synchronisieren Sie das Prisma-Schema mit \`pnpm prisma db pull\`.
  `,
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const session = await getSession()
  if (!session) return (<div className="p-8 text-center"><p className="text-gray-500">Nicht angemeldet.</p><a href="/login" className="text-blue-600 underline">Zur Anmeldung</a></div>)

  const { level, slug } = params
  const articleSlug = slug.join('/')

  // Validate level
  if (!['company', 'holding', 'meta'].includes(level)) {
    return (<div className="p-8 text-center"><p className="text-gray-500">Nicht gefunden.</p><a href="/" className="text-blue-600 underline">Zurueck</a></div>)
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
    return (<div className="p-8 text-center"><p className="text-gray-500">Nicht gefunden.</p><a href="/" className="text-blue-600 underline">Zurueck</a></div>)
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
