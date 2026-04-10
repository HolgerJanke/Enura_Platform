import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Datenschutzerklärung',
  description: 'Datenschutzerklärung der Enura Group Plattform',
}

export default function PrivacyPage() {
  return (
    <main
      className="mx-auto max-w-3xl px-4 py-12"
      style={{ color: 'var(--brand-text-primary, #111827)' }}
    >
      <h1
        className="mb-8 text-3xl font-bold"
        style={{ color: 'var(--brand-secondary, #1A1A1A)' }}
      >
        Datenschutzerklärung
      </h1>

      <section className="mb-8">
        <h2
          className="mb-3 text-xl font-semibold"
          style={{ color: 'var(--brand-secondary, #1A1A1A)' }}
        >
          1. Verantwortliche Stelle
        </h2>
        <p className="mb-2 leading-relaxed" style={{ color: 'var(--brand-text-secondary, #6B7280)' }}>
          Verantwortlich für die Datenverarbeitung auf dieser Plattform ist die
          Enura Group AG. Bei Fragen zum Datenschutz wenden Sie sich bitte an
          unseren Datenschutzbeauftragten unter{' '}
          <a
            href="mailto:datenschutz@enura.ch"
            className="underline"
            style={{ color: 'var(--brand-primary, #1A56DB)' }}
          >
            datenschutz@enura.ch
          </a>
          .
        </p>
      </section>

      <section className="mb-8">
        <h2
          className="mb-3 text-xl font-semibold"
          style={{ color: 'var(--brand-secondary, #1A1A1A)' }}
        >
          2. Welche Daten wir erheben
        </h2>
        <p className="mb-2 leading-relaxed" style={{ color: 'var(--brand-text-secondary, #6B7280)' }}>
          Im Rahmen der Nutzung dieser Business-Intelligence-Plattform erheben
          und verarbeiten wir folgende Daten:
        </p>
        <ul className="ml-6 list-disc space-y-1" style={{ color: 'var(--brand-text-secondary, #6B7280)' }}>
          <li>
            <strong>Anmeldedaten:</strong> E-Mail-Adresse, gehashtes Passwort,
            TOTP-Schlüssel für die Zwei-Faktor-Authentifizierung.
          </li>
          <li>
            <strong>Nutzungsdaten:</strong> Zugriffszeiten, aufgerufene Module,
            Rolle im System.
          </li>
          <li>
            <strong>Geschaeftsdaten:</strong> Leads, Angebote, Projekte,
            Anrufdaten und Finanzkennzahlen — diese Daten gehoeren dem
            jeweiligen Mandanten und sind durch Row-Level Security strikt
            getrennt.
          </li>
          <li>
            <strong>Technische Daten:</strong> IP-Adresse, Browser-Typ,
            Betriebssystem — ausschließlich zur Sicherstellung des Betriebs.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2
          className="mb-3 text-xl font-semibold"
          style={{ color: 'var(--brand-secondary, #1A1A1A)' }}
        >
          3. Cookies
        </h2>
        <p className="mb-2 leading-relaxed" style={{ color: 'var(--brand-text-secondary, #6B7280)' }}>
          Diese Plattform verwendet ausschließlich technisch notwendige
          Cookies. Dazu gehoeren:
        </p>
        <ul className="ml-6 list-disc space-y-1" style={{ color: 'var(--brand-text-secondary, #6B7280)' }}>
          <li>
            <strong>Session-Cookie:</strong> Zur Authentifizierung und
            Aufrechterhaltung Ihrer Sitzung.
          </li>
          <li>
            <strong>Cookie-Einwilligung:</strong> Speichert Ihre Zustimmung zu
            diesem Hinweis (1 Jahr gültig).
          </li>
        </ul>
        <p className="mt-2 leading-relaxed" style={{ color: 'var(--brand-text-secondary, #6B7280)' }}>
          Es werden keine Tracking-, Analyse- oder Werbe-Cookies eingesetzt.
        </p>
      </section>

      <section className="mb-8">
        <h2
          className="mb-3 text-xl font-semibold"
          style={{ color: 'var(--brand-secondary, #1A1A1A)' }}
        >
          4. Hosting & Dienstleister
        </h2>
        <p className="mb-2 leading-relaxed" style={{ color: 'var(--brand-text-secondary, #6B7280)' }}>
          Die Plattform wird in der EU (Frankfurt) bzw. in der Schweiz
          gehostet. Wir setzen folgende Dienstleister ein:
        </p>
        <ul className="ml-6 list-disc space-y-1" style={{ color: 'var(--brand-text-secondary, #6B7280)' }}>
          <li>
            <strong>Supabase:</strong> Datenbank, Authentifizierung und
            Dateispeicher (EU-Region).
          </li>
          <li>
            <strong>Vercel:</strong> Hosting der Web-Applikation.
          </li>
          <li>
            <strong>Upstash:</strong> Redis-Cache (EU-Region).
          </li>
          <li>
            <strong>Anthropic:</strong> KI-gestützte Anrufanalyse — es werden
            keine personenbezogenen Kundendaten an die KI uebermittelt.
            Transkripte werden vor der Verarbeitung anonymisiert.
          </li>
        </ul>
        <p className="mt-2 leading-relaxed" style={{ color: 'var(--brand-text-secondary, #6B7280)' }}>
          Alle Daten verbleiben innerhalb der EU bzw. der Schweiz. Eine
          Uebermittlung in Drittlaender findet nicht statt.
        </p>
      </section>

      <section className="mb-8">
        <h2
          className="mb-3 text-xl font-semibold"
          style={{ color: 'var(--brand-secondary, #1A1A1A)' }}
        >
          5. Ihre Rechte
        </h2>
        <p className="mb-2 leading-relaxed" style={{ color: 'var(--brand-text-secondary, #6B7280)' }}>
          Gemaess dem Schweizer Datenschutzgesetz (DSG) und der DSGVO haben Sie
          folgende Rechte:
        </p>
        <ul className="ml-6 list-disc space-y-1" style={{ color: 'var(--brand-text-secondary, #6B7280)' }}>
          <li>Recht auf Auskunft über Ihre gespeicherten Daten</li>
          <li>Recht auf Berichtigung unrichtiger Daten</li>
          <li>Recht auf Loeschung Ihrer Daten</li>
          <li>Recht auf Einschraenkung der Verarbeitung</li>
          <li>Recht auf Datenuebertragbarkeit</li>
          <li>
            Beschwerderecht bei der zuständigen Aufsichtsbehörde (EDOEB für
            die Schweiz)
          </li>
        </ul>
        <p className="mt-2 leading-relaxed" style={{ color: 'var(--brand-text-secondary, #6B7280)' }}>
          Zur Ausuebung Ihrer Rechte wenden Sie sich bitte an{' '}
          <a
            href="mailto:datenschutz@enura.ch"
            className="underline"
            style={{ color: 'var(--brand-primary, #1A56DB)' }}
          >
            datenschutz@enura.ch
          </a>
          .
        </p>
      </section>

      <footer
        className="border-t pt-6 text-sm"
        style={{
          borderColor: 'var(--brand-text-secondary, #6B7280)',
          color: 'var(--brand-text-secondary, #6B7280)',
        }}
      >
        <p>Stand: Maerz 2026</p>
      </footer>
    </main>
  )
}
