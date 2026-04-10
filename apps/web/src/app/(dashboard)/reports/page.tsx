import { requirePermission } from '@/lib/permissions'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { DailyReportRow } from '@enura/types'
import Link from 'next/link'

function formatDate(dateString: string | null): string {
  if (!dateString) return '--'
  try {
    return new Intl.DateTimeFormat('de-CH', {
      day: '2-digit',
      month: '2-digit',
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

export default async function ReportsArchivePage() {
  await requirePermission('module:reports:read')

  const session = await getSession()
  if (!session?.companyId) return null

  const supabase = createSupabaseServerClient()

  const { data: reports } = await supabase
    .from('daily_reports')
    .select('id, report_date, sent_to, sent_at, report_json')
    .eq('company_id', session.companyId)
    .order('report_date', { ascending: false })
    .limit(30)

  const typedReports = (reports as Pick<DailyReportRow, 'id' | 'report_date' | 'sent_to' | 'sent_at' | 'report_json'>[] | null) ?? []

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-brand-text-primary">
          Berichtsarchiv
        </h1>
        <p className="text-brand-text-secondary mt-1">
          Die letzten 30 taeglich generierten Berichte.
        </p>
      </div>

      {/* Table */}
      <div className="bg-brand-surface rounded-brand border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-brand-text-secondary">
                  Datum
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-brand-text-secondary">
                  Empfaenger
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-brand-text-secondary">
                  Gesendet um
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-brand-text-secondary">
                  Aktionen
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {typedReports.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-sm text-brand-text-secondary"
                  >
                    Noch keine Berichte vorhanden. Berichte werden taeglich automatisch generiert.
                  </td>
                </tr>
              )}
              {typedReports.map((report) => {
                const recipientCount = Array.isArray(report.sent_to) ? report.sent_to.length : 0

                return (
                  <tr
                    key={report.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-brand-text-primary">
                      {formatDate(report.report_date)}
                    </td>
                    <td className="px-4 py-3 text-sm text-brand-text-secondary">
                      {recipientCount} Empfaenger
                    </td>
                    <td className="px-4 py-3 text-sm text-brand-text-secondary">
                      {formatDateTime(report.sent_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/reports/${report.id}`}
                        className="inline-flex items-center gap-1 rounded-brand px-3 py-1.5 text-xs font-medium transition-colors hover:bg-gray-100"
                        style={{ color: 'var(--brand-primary)' }}
                      >
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                          />
                        </svg>
                        Anzeigen
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
