import {
  Html,
  Head,
  Body,
  Container,
  Text,
  Section,
  Hr,
  Preview,
  Heading,
} from '@react-email/components'
import type { AnomalySeverity } from '@enura/types'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AnomalyAlertEmailProps {
  tenantName: string
  severity: AnomalySeverity
  type: string
  metric: string
  currentValue: number
  baselineValue: number
  deviationPct: number
  message: string
  detectedAt: string
  entityName: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEVERITY_CONFIG: Record<AnomalySeverity, { emoji: string; label: string; color: string; bgColor: string; borderColor: string }> = {
  critical: {
    emoji: '\uD83D\uDD34',
    label: 'Kritisch',
    color: '#991b1b',
    bgColor: '#fef2f2',
    borderColor: '#dc2626',
  },
  warning: {
    emoji: '\uD83D\uDFE1',
    label: 'Warnung',
    color: '#92400e',
    bgColor: '#fffbeb',
    borderColor: '#f59e0b',
  },
  info: {
    emoji: '\uD83D\uDD35',
    label: 'Information',
    color: '#1e40af',
    bgColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString('de-CH', {
      dateStyle: 'long',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AnomalyAlertEmail({
  tenantName,
  severity,
  type,
  metric,
  currentValue,
  baselineValue,
  deviationPct,
  message,
  detectedAt,
  entityName,
}: AnomalyAlertEmailProps) {
  const config = SEVERITY_CONFIG[severity]

  return (
    <Html lang="de">
      <Head />
      <Preview>
        {config.emoji} {config.label} - {tenantName}: {message.slice(0, 100)}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={{ ...headerSection, borderBottomColor: config.borderColor }}>
            <Heading as="h1" style={companyHeading}>
              {tenantName}
            </Heading>
            <Text style={dateText}>
              Anomalie-Alarm
            </Text>
          </Section>

          {/* Severity Badge */}
          <Section style={contentSection}>
            <Section
              style={{
                ...severityBadge,
                backgroundColor: config.bgColor,
                borderLeftColor: config.borderColor,
              }}
            >
              <Text style={{ ...severityText, color: config.color }}>
                {config.emoji} {config.label}
              </Text>
            </Section>
          </Section>

          {/* Message */}
          <Section style={contentSection}>
            <Text style={messageText}>{message}</Text>
          </Section>

          <Hr style={divider} />

          {/* Details table */}
          <Section style={contentSection}>
            <Heading as="h2" style={sectionHeading}>
              Details
            </Heading>

            {entityName && (
              <Section style={detailRow}>
                <Text style={detailLabel}>Betrifft:</Text>
                <Text style={detailValue}>{entityName}</Text>
              </Section>
            )}

            <Section style={detailRow}>
              <Text style={detailLabel}>Typ:</Text>
              <Text style={detailValue}>{type.replace(/_/g, ' ')}</Text>
            </Section>

            <Section style={detailRow}>
              <Text style={detailLabel}>Metrik:</Text>
              <Text style={detailValue}>{metric}</Text>
            </Section>

            <Section style={detailRow}>
              <Text style={detailLabel}>Aktueller Wert:</Text>
              <Text style={{ ...detailValue, fontWeight: '700', color: config.color }}>
                {currentValue}
              </Text>
            </Section>

            <Section style={detailRow}>
              <Text style={detailLabel}>Basiswert (Durchschnitt):</Text>
              <Text style={detailValue}>{baselineValue}</Text>
            </Section>

            <Section style={detailRow}>
              <Text style={detailLabel}>Abweichung:</Text>
              <Text style={{ ...detailValue, color: deviationPct < 0 ? '#dc2626' : '#16a34a' }}>
                {deviationPct > 0 ? '+' : ''}{deviationPct.toFixed(1)}%
              </Text>
            </Section>

            <Section style={detailRow}>
              <Text style={detailLabel}>Erkannt am:</Text>
              <Text style={detailValue}>{formatTimestamp(detectedAt)}</Text>
            </Section>
          </Section>

          <Hr style={divider} />

          {/* Action hint */}
          <Section style={contentSection}>
            <Section style={actionBox}>
              <Heading as="h3" style={actionHeading}>
                Empfohlene Massnahme
              </Heading>
              <Text style={actionText}>
                Bitte pruefen Sie die betroffene Metrik im Dashboard und ergreifen Sie
                gegebenenfalls Massnahmen. Bei Connector-Problemen ueberpruefen Sie die
                Konfiguration unter Einstellungen.
              </Text>
            </Section>
          </Section>

          {/* Footer */}
          <Section style={footerSection}>
            <Text style={footerText}>
              Diese Benachrichtigung wurde automatisch von der Enura BI-Plattform generiert.
            </Text>
            <Text style={footerMuted}>
              Um Benachrichtigungseinstellungen zu aendern, wenden Sie sich an Ihren Administrator.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default AnomalyAlertEmail

// ---------------------------------------------------------------------------
// Styles (inline for email client compatibility)
// ---------------------------------------------------------------------------

const body: React.CSSProperties = {
  backgroundColor: '#f4f4f5',
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  margin: '0',
  padding: '0',
}

const container: React.CSSProperties = {
  maxWidth: '640px',
  margin: '0 auto',
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  overflow: 'hidden',
  marginTop: '40px',
  marginBottom: '40px',
}

const headerSection: React.CSSProperties = {
  padding: '32px 40px 24px',
  borderBottom: '3px solid #dc2626',
}

const companyHeading: React.CSSProperties = {
  fontSize: '26px',
  fontWeight: '700',
  color: '#111827',
  margin: '0 0 4px 0',
  lineHeight: '1.3',
}

const dateText: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: '600',
  color: '#374151',
  margin: '0',
}

const contentSection: React.CSSProperties = {
  padding: '24px 40px',
}

const severityBadge: React.CSSProperties = {
  borderLeft: '4px solid #dc2626',
  borderRadius: '0 8px 8px 0',
  padding: '12px 20px',
}

const severityText: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: '700',
  margin: '0',
}

const messageText: React.CSSProperties = {
  fontSize: '16px',
  lineHeight: '1.7',
  color: '#374151',
  margin: '0',
}

const sectionHeading: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: '600',
  color: '#111827',
  margin: '0 0 16px 0',
  lineHeight: '1.4',
}

const divider: React.CSSProperties = {
  borderColor: '#e4e4e7',
  margin: '0',
}

const detailRow: React.CSSProperties = {
  display: 'flex',
  marginBottom: '8px',
  padding: '0',
}

const detailLabel: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: '600',
  color: '#6b7280',
  margin: '0 12px 0 0',
  minWidth: '180px',
  display: 'inline',
}

const detailValue: React.CSSProperties = {
  fontSize: '14px',
  color: '#111827',
  margin: '0',
  display: 'inline',
}

const actionBox: React.CSSProperties = {
  backgroundColor: '#f0fdf4',
  border: '1px solid #bbf7d0',
  borderRadius: '8px',
  padding: '16px 20px',
}

const actionHeading: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: '600',
  color: '#166534',
  margin: '0 0 8px 0',
}

const actionText: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: '1.6',
  color: '#15803d',
  margin: '0',
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
  margin: '0 0 6px 0',
}

const footerMuted: React.CSSProperties = {
  fontSize: '12px',
  lineHeight: '1.5',
  color: '#9ca3af',
  margin: '0',
}
