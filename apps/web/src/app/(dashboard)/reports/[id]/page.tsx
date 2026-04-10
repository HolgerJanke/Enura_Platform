import { requirePermission } from '@/lib/permissions'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { DailyReportRow } from '@enura/types'

type ReportSection = {
  executive_summary?: string
  highlights?: string[]
  concerns?: string[]
  coaching?: Array<{
    name?: string
    role?: string
    feedback?: string
  }>
  open_actions?: string[]
  tomorrow_focus?: string[]
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '--'
  try {
    return new Intl.DateTimeFormat('de-CH', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(dateString))
  } catch {
    return '--'
  }
}

function formatDateTime(dateString: string | null): string {
  if (!dateString) return '--'
  try {
    return new Intl.DateTimeFormat('de-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString))
  } catch {
    return '--'
  }
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-semibold text-brand-text-primary mb-3 flex items-center gap-2">
      {children}
    </h2>
  )
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-brand-surface rounded-brand border border-gray-200 p-5 mb-5">
      {children}
    </div>
  )
}

export default async function ReportDetailPage({
  params,
}: {
  params: { id: string }
}) {
  await requirePermission('module:reports:read')

  const session = await getSession()
  if (!session?.companyId) return (<div className="p-8 text-center"><a href="/login" className="text-blue-600 underline">Weiter</a></div>)

  const supabase = createSupabaseServerClient()

  const { data: report } = await supabase
    .from('daily_reports')
    .select('*')
    .eq('id', params.id)
    .eq('company_id', session.companyId)
    .single()

  if (!report) return (<div className="p-8 text-center"><a href="/reports" className="text-blue-600 underline">Weiter</a></div>)

  const typedReport = report as DailyReportRow
  const sections = typedReport.report_json as unknown as ReportSection

  const recipientCount = Array.isArray(typedReport.sent_to) ? typedReport.sent_to.length : 0

  return (
    <div className="p-6">
      {/* Back link */}
      <Link
        href="/reports"
        className="inline-flex items-center gap-1 text-sm font-medium text-brand-text-secondary hover:text-brand-text-primary transition-colors mb-4"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        Zurueck zum Archiv
      </Link>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-brand-text-primary">
          Tagesbericht
        </h1>
        <p className="text-brand-text-secondary mt-1">
          {formatDate(typedReport.report_date)}
        </p>
        <div className="flex items-center gap-4 mt-2 text-xs text-brand-text-secondary">
          <span>Gesendet: {formatDateTime(typedReport.sent_at)}</span>
          <span>{recipientCount} Empfaenger</span>
        </div>
      </div>

      {/* Executive Summary */}
      {sections.executive_summary && (
        <SectionCard>
          <SectionHeading>Zusammenfassung</SectionHeading>
          <p className="text-sm text-brand-text-primary leading-relaxed whitespace-pre-wrap">
            {sections.executive_summary}
          </p>
        </SectionCard>
      )}

      {/* Highlights */}
      {sections.highlights && sections.highlights.length > 0 && (
        <SectionCard>
          <SectionHeading>
            <span
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-xs text-white"
              style={{ backgroundColor: 'var(--brand-primary)' }}
              aria-hidden="true"
            >
              +
            </span>
            Highlights
          </SectionHeading>
          <ul className="space-y-2">
            {sections.highlights.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-brand-text-primary">
                <svg
                  className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* Concerns */}
      {sections.concerns && sections.concerns.length > 0 && (
        <SectionCard>
          <SectionHeading>
            <span
              className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-xs text-red-700"
              aria-hidden="true"
            >
              !
            </span>
            Handlungsbedarf
          </SectionHeading>
          <ul className="space-y-2">
            {sections.concerns.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-brand-text-primary">
                <svg
                  className="h-4 w-4 mt-0.5 flex-shrink-0 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* Coaching */}
      {sections.coaching && sections.coaching.length > 0 && (
        <SectionCard>
          <SectionHeading>Coaching-Hinweise</SectionHeading>
          <div className="space-y-4">
            {sections.coaching.map((entry, idx) => (
              <div
                key={idx}
                className="rounded-brand border border-gray-200 bg-brand-background p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-brand-text-primary">
                    {entry.name ?? 'Mitarbeiter'}
                  </span>
                  {entry.role && (
                    <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-brand-text-secondary">
                      {entry.role}
                    </span>
                  )}
                </div>
                <p className="text-sm text-brand-text-secondary leading-relaxed whitespace-pre-wrap">
                  {entry.feedback ?? ''}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Open Actions */}
      {sections.open_actions && sections.open_actions.length > 0 && (
        <SectionCard>
          <SectionHeading>Offene Massnahmen</SectionHeading>
          <ul className="space-y-2">
            {sections.open_actions.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-brand-text-primary">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-text-secondary" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* Tomorrow Focus */}
      {sections.tomorrow_focus && sections.tomorrow_focus.length > 0 && (
        <SectionCard>
          <SectionHeading>Fokus fuer morgen</SectionHeading>
          <ul className="space-y-2">
            {sections.tomorrow_focus.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-brand-text-primary">
                <svg
                  className="h-4 w-4 mt-0.5 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  aria-hidden="true"
                  style={{ color: 'var(--brand-primary)' }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* Empty state if no sections at all */}
      {!sections.executive_summary &&
        (!sections.highlights || sections.highlights.length === 0) &&
        (!sections.concerns || sections.concerns.length === 0) &&
        (!sections.coaching || sections.coaching.length === 0) &&
        (!sections.open_actions || sections.open_actions.length === 0) &&
        (!sections.tomorrow_focus || sections.tomorrow_focus.length === 0) && (
        <div className="bg-brand-surface rounded-brand border border-gray-200 p-8 text-center">
          <p className="text-sm text-brand-text-secondary">
            Dieser Bericht enthaelt keine strukturierten Abschnitte.
          </p>
        </div>
      )}
    </div>
  )
}
