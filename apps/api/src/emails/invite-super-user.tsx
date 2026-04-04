import {
  Html,
  Head,
  Body,
  Container,
  Text,
  Link,
  Section,
  Hr,
  Preview,
  Heading,
} from '@react-email/components'

export interface InviteSuperUserEmailProps {
  companyName: string
  loginUrl: string
  tempPassword: string
  primaryColor: string
}

export function InviteSuperUserEmail({
  companyName,
  loginUrl,
  tempPassword,
  primaryColor,
}: InviteSuperUserEmailProps) {
  return (
    <Html lang="de">
      <Head />
      <Preview>
        Ihr Administrator-Konto bei {companyName} wurde eingerichtet
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={headerSection}>
            <Heading
              as="h1"
              style={{ ...heading, color: primaryColor }}
            >
              {companyName}
            </Heading>
          </Section>

          <Section style={contentSection}>
            <Heading as="h2" style={subheading}>
              Willkommen, Administrator!
            </Heading>

            <Text style={paragraph}>
              Ihr Administrator-Konto wurde eingerichtet. Sie haben als Super
              User vollen Zugriff auf die Verwaltung von {companyName}.
            </Text>

            <Text style={paragraph}>
              Melden Sie sich hier an, um loszulegen:
            </Text>

            <Section style={linkBox}>
              <Link href={loginUrl} style={{ ...link, color: primaryColor }}>
                {loginUrl}
              </Link>
            </Section>

            <Text style={labelText}>Ihr temporaeres Passwort:</Text>

            <Section style={passwordBox}>
              <Text style={passwordText}>{tempPassword}</Text>
            </Section>

            <Section style={warningBox}>
              <Text style={warningText}>
                Dieses Passwort ist nur einmalig gueltig. Sie werden bei der
                ersten Anmeldung aufgefordert, es zu aendern.
              </Text>
            </Section>

            <Hr style={divider} />

            <Heading as="h3" style={stepHeading}>
              Naechste Schritte
            </Heading>

            <Text style={paragraph}>
              <strong>1.</strong> Melden Sie sich mit dem temporaeren Passwort
              an.
            </Text>
            <Text style={paragraph}>
              <strong>2.</strong> Vergeben Sie ein sicheres, persoenliches
              Passwort.
            </Text>
            <Text style={paragraph}>
              <strong>3.</strong> Richten Sie eine Authenticator-App ein (z.B.
              Google Authenticator, Authy oder Microsoft Authenticator). Die
              Zwei-Faktor-Authentifizierung ist fuer alle Konten verpflichtend.
            </Text>

            <Hr style={divider} />

            <Text style={paragraph}>
              Als Administrator koennen Sie anschliessend weitere Benutzer
              anlegen, Rollen zuweisen und das Branding Ihres Unternehmens
              konfigurieren.
            </Text>
          </Section>

          <Section style={footerSection}>
            <Text style={footerText}>
              Bei Fragen oder Problemen wenden Sie sich an Ihren Enura
              Ansprechpartner oder schreiben Sie an{' '}
              <Link
                href="mailto:support@enura-platform.com"
                style={{ ...footerLink, color: primaryColor }}
              >
                support@enura-platform.com
              </Link>
              .
            </Text>
            <Text style={footerDisclaimer}>
              Diese E-Mail wurde automatisch versendet. Bitte antworten Sie
              nicht direkt auf diese Nachricht.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default InviteSuperUserEmail

const body: React.CSSProperties = {
  backgroundColor: '#f4f4f5',
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  margin: '0',
  padding: '0',
}

const container: React.CSSProperties = {
  maxWidth: '580px',
  margin: '0 auto',
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  overflow: 'hidden',
  marginTop: '40px',
  marginBottom: '40px',
}

const headerSection: React.CSSProperties = {
  padding: '32px 40px 24px',
  borderBottom: '1px solid #e4e4e7',
}

const heading: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: '700',
  margin: '0',
  lineHeight: '1.3',
}

const contentSection: React.CSSProperties = {
  padding: '32px 40px',
}

const subheading: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: '600',
  color: '#111827',
  margin: '0 0 16px 0',
  lineHeight: '1.4',
}

const stepHeading: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: '600',
  color: '#111827',
  margin: '0 0 12px 0',
  lineHeight: '1.4',
}

const paragraph: React.CSSProperties = {
  fontSize: '15px',
  lineHeight: '1.6',
  color: '#374151',
  margin: '0 0 12px 0',
}

const linkBox: React.CSSProperties = {
  backgroundColor: '#f9fafb',
  borderRadius: '6px',
  padding: '12px 16px',
  margin: '8px 0 24px 0',
}

const link: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: '500',
  textDecoration: 'underline',
  wordBreak: 'break-all' as const,
}

const labelText: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: '600',
  color: '#6b7280',
  margin: '0 0 8px 0',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
}

const passwordBox: React.CSSProperties = {
  backgroundColor: '#111827',
  borderRadius: '6px',
  padding: '14px 20px',
  margin: '0 0 16px 0',
}

const passwordText: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
  fontSize: '18px',
  fontWeight: '600',
  color: '#ffffff',
  margin: '0',
  letterSpacing: '0.1em',
}

const warningBox: React.CSSProperties = {
  backgroundColor: '#fffbeb',
  borderLeft: '4px solid #f59e0b',
  borderRadius: '0 6px 6px 0',
  padding: '12px 16px',
  margin: '0 0 8px 0',
}

const warningText: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: '1.5',
  color: '#92400e',
  margin: '0',
}

const divider: React.CSSProperties = {
  borderColor: '#e4e4e7',
  margin: '24px 0',
}

const footerSection: React.CSSProperties = {
  padding: '24px 40px 32px',
  backgroundColor: '#f9fafb',
  borderTop: '1px solid #e4e4e7',
}

const footerText: React.CSSProperties = {
  fontSize: '13px',
  lineHeight: '1.5',
  color: '#6b7280',
  margin: '0 0 8px 0',
}

const footerLink: React.CSSProperties = {
  textDecoration: 'underline',
}

const footerDisclaimer: React.CSSProperties = {
  fontSize: '12px',
  lineHeight: '1.5',
  color: '#9ca3af',
  margin: '0',
}
