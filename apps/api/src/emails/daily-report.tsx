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
import type { DailyReportResponse, CoachingItem } from '../ai/schemas/daily-report-response.js'
import type { Warning } from '../workers/reports/assemble-kpis.js'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DailyReportEmailProps {
  companyName: string
  reportDate: string
  dataDate: string
  report: DailyReportResponse
  warnings: Warning[]
  generatedAt: string
  primaryColor: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DailyReportEmail({
  companyName,
  reportDate,
  dataDate,
  report,
  warnings,
  generatedAt,
  primaryColor,
}: DailyReportEmailProps) {
  return (
    <Html lang="de">
      <Head />
      <Preview>
        Tagesbericht {companyName} - {reportDate}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          {/* ============================================================= */}
          {/* Header                                                        */}
          {/* ============================================================= */}
          <Section style={headerSection}>
            <Heading as="h1" style={{ ...companyHeading, color: primaryColor }}>
              {companyName}
            </Heading>
            <Text style={dateText}>
              Tagesbericht vom {reportDate}
            </Text>
            <Text style={dateMuted}>
              Daten vom {dataDate}
            </Text>
          </Section>

          {/* ============================================================= */}
          {/* Executive Summary                                             */}
          {/* ============================================================= */}
          <Section style={contentSection}>
            <Heading as="h2" style={sectionHeading}>
              Zusammenfassung
            </Heading>
            <Text style={paragraph}>{report.executive_summary}</Text>
          </Section>

          <Hr style={divider} />

          {/* ============================================================= */}
          {/* Highlights                                                     */}
          {/* ============================================================= */}
          {report.highlights.length > 0 && (
            <Section style={contentSection}>
              <Heading as="h2" style={sectionHeading}>
                Highlights
              </Heading>
              {report.highlights.map((highlight, i) => (
                <Section key={`h-${i}`} style={highlightRow}>
                  <Text style={highlightIcon}>&#9989;</Text>
                  <Text style={highlightText}>{highlight}</Text>
                </Section>
              ))}
            </Section>
          )}

          {/* ============================================================= */}
          {/* Warnings / Concerns                                           */}
          {/* ============================================================= */}
          {(report.concerns.length > 0 || warnings.length > 0) && (
            <>
              <Hr style={divider} />
              <Section style={contentSection}>
                <Heading as="h2" style={sectionHeading}>
                  Warnungen &amp; Handlungsbedarf
                </Heading>

                {/* AI-generated concerns */}
                {report.concerns.map((concern, i) => (
                  <Section key={`c-${i}`} style={warningRow}>
                    <Text style={warningIcon}>&#9888;&#65039;</Text>
                    <Text style={warningText}>{concern}</Text>
                  </Section>
                ))}

                {/* System warnings from KPI thresholds */}
                {warnings.map((w, i) => (
                  <Section
                    key={`w-${i}`}
                    style={{
                      ...warningRow,
                      borderLeftColor:
                        w.severity === 'high'
                          ? '#dc2626'
                          : w.severity === 'medium'
                            ? '#f59e0b'
                            : '#6b7280',
                    }}
                  >
                    <Text style={warningText}>{w.message}</Text>
                  </Section>
                ))}
              </Section>
            </>
          )}

          {/* ============================================================= */}
          {/* Coaching Points                                               */}
          {/* ============================================================= */}
          {report.coaching.length > 0 && (
            <>
              <Hr style={divider} />
              <Section style={contentSection}>
                <Heading as="h2" style={sectionHeading}>
                  Coaching-Hinweise
                </Heading>
                {report.coaching.map((point: CoachingItem, i: number) => (
                  <Section key={`cp-${i}`} style={coachingCard}>
                    <Text style={coachingName}>{point.person}</Text>
                    <Text style={coachingLabel}>Beobachtung:</Text>
                    <Text style={coachingText}>{point.observation}</Text>
                    <Text style={coachingLabel}>Empfehlung:</Text>
                    <Text style={coachingText}>{point.recommendation}</Text>
                  </Section>
                ))}
              </Section>
            </>
          )}

          {/* ============================================================= */}
          {/* Open Actions                                                  */}
          {/* ============================================================= */}
          {report.open_actions.length > 0 && (
            <>
              <Hr style={divider} />
              <Section style={contentSection}>
                <Heading as="h2" style={sectionHeading}>
                  Offene Massnahmen
                </Heading>
                {report.open_actions.map((action, i) => (
                  <Section key={`a-${i}`} style={actionRow}>
                    <Text style={checkboxIcon}>&#9744;</Text>
                    <Text style={actionText}>{action}</Text>
                  </Section>
                ))}
              </Section>
            </>
          )}

          {/* ============================================================= */}
          {/* Tomorrow Focus                                                */}
          {/* ============================================================= */}
          <Hr style={divider} />
          <Section style={contentSection}>
            <Section style={focusBox}>
              <Heading as="h3" style={focusHeading}>
                Fokus fuer morgen
              </Heading>
              <Text style={focusText}>{report.tomorrow_focus}</Text>
            </Section>
          </Section>

          {/* ============================================================= */}
          {/* Footer                                                        */}
          {/* ============================================================= */}
          <Section style={footerSection}>
            <Text style={footerText}>
              Dieser Bericht wurde automatisch erstellt am{' '}
              {new Date(generatedAt).toLocaleString('de-CH', {
                dateStyle: 'long',
                timeStyle: 'short',
              })}
              .
            </Text>
            <Text style={footerMuted}>
              Erstellt mit KI-Unterstuetzung (Claude) auf Basis der
              verfuegbaren Daten. Alle Angaben ohne Gewaehr.
            </Text>
            <Text style={footerMuted}>
              Enura Group BI-Plattform
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default DailyReportEmail

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
  borderBottom: '1px solid #e4e4e7',
}

const companyHeading: React.CSSProperties = {
  fontSize: '26px',
  fontWeight: '700',
  margin: '0 0 4px 0',
  lineHeight: '1.3',
}

const dateText: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: '600',
  color: '#374151',
  margin: '0 0 2px 0',
}

const dateMuted: React.CSSProperties = {
  fontSize: '14px',
  color: '#6b7280',
  margin: '0',
}

const contentSection: React.CSSProperties = {
  padding: '24px 40px',
}

const sectionHeading: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: '600',
  color: '#111827',
  margin: '0 0 16px 0',
  lineHeight: '1.4',
}

const paragraph: React.CSSProperties = {
  fontSize: '15px',
  lineHeight: '1.7',
  color: '#374151',
  margin: '0 0 12px 0',
}

const divider: React.CSSProperties = {
  borderColor: '#e4e4e7',
  margin: '0',
}

// -- Highlights --

const highlightRow: React.CSSProperties = {
  display: 'flex',
  marginBottom: '8px',
  padding: '0',
}

const highlightIcon: React.CSSProperties = {
  fontSize: '16px',
  margin: '0 8px 0 0',
  lineHeight: '1.6',
  display: 'inline',
}

const highlightText: React.CSSProperties = {
  fontSize: '15px',
  lineHeight: '1.6',
  color: '#065f46',
  margin: '0',
  display: 'inline',
}

// -- Warnings --

const warningRow: React.CSSProperties = {
  backgroundColor: '#fffbeb',
  borderLeft: '4px solid #f59e0b',
  borderRadius: '0 6px 6px 0',
  padding: '10px 16px',
  marginBottom: '8px',
}

const warningIcon: React.CSSProperties = {
  fontSize: '16px',
  margin: '0 6px 0 0',
  display: 'inline',
}

const warningText: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: '1.5',
  color: '#92400e',
  margin: '0',
  display: 'inline',
}

// -- Coaching --

const coachingCard: React.CSSProperties = {
  border: '1px solid #e4e4e7',
  borderRadius: '8px',
  padding: '16px 20px',
  marginBottom: '12px',
  backgroundColor: '#fafafa',
}

const coachingName: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: '700',
  color: '#111827',
  margin: '0 0 8px 0',
}

const coachingLabel: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: '600',
  color: '#6b7280',
  margin: '0 0 2px 0',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
}

const coachingText: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: '1.5',
  color: '#374151',
  margin: '0 0 10px 0',
}

// -- Actions --

const actionRow: React.CSSProperties = {
  display: 'flex',
  marginBottom: '6px',
  padding: '0',
}

const checkboxIcon: React.CSSProperties = {
  fontSize: '16px',
  margin: '0 8px 0 0',
  lineHeight: '1.6',
  color: '#6b7280',
  display: 'inline',
}

const actionText: React.CSSProperties = {
  fontSize: '15px',
  lineHeight: '1.6',
  color: '#374151',
  margin: '0',
  display: 'inline',
}

// -- Focus box --

const focusBox: React.CSSProperties = {
  backgroundColor: '#eff6ff',
  border: '1px solid #bfdbfe',
  borderRadius: '8px',
  padding: '16px 20px',
}

const focusHeading: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: '600',
  color: '#1e40af',
  margin: '0 0 8px 0',
}

const focusText: React.CSSProperties = {
  fontSize: '15px',
  lineHeight: '1.6',
  color: '#1e3a5f',
  margin: '0',
}

// -- Footer --

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
  margin: '0 0 4px 0',
}
