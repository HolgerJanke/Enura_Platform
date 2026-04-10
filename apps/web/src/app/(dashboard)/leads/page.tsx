import { requirePermission } from '@/lib/permissions'
import { getSession } from '@/lib/session'
import { getDataAccess } from '@/lib/data-access'
import {
  formatPercent,
  formatNumber,
  formatDate,
  KPI_SNAPSHOT_TYPES,
} from '@enura/types'
import type { LeadsDailyMetrics } from '@enura/types'

export default async function LeadsPage() {
  await requirePermission('module:leads:read')
  const session = await getSession()
  if (!session?.companyId) return null

  const db = getDataAccess()
  const today = new Date().toISOString().split('T')[0]!

  const snapshot = await db.kpis.findLatest(
    session.companyId,
    KPI_SNAPSHOT_TYPES.LEADS_DAILY,
  )

  const metrics = snapshot?.metrics as LeadsDailyMetrics | undefined

  // Compute quality rate: qualified / (new + qualified + disqualified) if any leads exist
  const totalClassified =
    (metrics?.leads_qualified ?? 0) +
    (metrics?.leads_disqualified ?? 0) +
    (metrics?.leads_new ?? 0)
  const qualityRate =
    totalClassified > 0
      ? (metrics?.leads_qualified ?? 0) / totalClassified
      : 0

  // Format response time
  const responseTimeDisplay =
    metrics?.avg_response_time_minutes !== null &&
    metrics?.avg_response_time_minutes !== undefined
      ? `${metrics.avg_response_time_minutes} Min.`
      : '--'

  // Sort lead sources by count descending
  const sourceEntries = Object.entries(metrics?.by_source ?? {}).sort(
    ([, a], [, b]) => b - a,
  )

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl sm:text-2xl font-semibold text-brand-text-primary mb-2">
        Leadkontrolle
      </h1>
      <p className="text-brand-text-secondary mb-6">{formatDate(today)}</p>

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">Neue Leads heute</p>
          <p className="text-2xl font-semibold text-brand-text-primary mt-1">
            {formatNumber(metrics?.leads_new ?? 0)}
          </p>
        </div>
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">
            Unbearbeitete Leads
          </p>
          <p className="text-2xl font-semibold text-brand-text-primary mt-1">
            {formatNumber(metrics?.leads_unworked_count ?? 0)}
          </p>
        </div>
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">
            Durchschnittl. Reaktionszeit
          </p>
          <p className="text-2xl font-semibold text-brand-text-primary mt-1">
            {responseTimeDisplay}
          </p>
        </div>
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">
            Lead-Qualitätsrate
          </p>
          <p className="text-2xl font-semibold text-brand-text-primary mt-1">
            {formatPercent(qualityRate)}
          </p>
        </div>
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">Termine gebucht</p>
          <p className="text-2xl font-semibold text-brand-text-primary mt-1">
            {formatNumber(metrics?.leads_appointment_booked ?? 0)}
          </p>
        </div>
      </div>

      {/* Lead status breakdown + Sources */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-brand-surface rounded-brand p-6 border border-gray-200">
          <h2 className="text-lg font-medium text-brand-text-primary mb-4">
            Lead-Status
          </h2>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-2 text-brand-text-secondary">Neu</td>
                <td className="py-2 text-right font-medium text-brand-text-primary">
                  {formatNumber(metrics?.leads_new ?? 0)}
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 text-brand-text-secondary">Qualifiziert</td>
                <td className="py-2 text-right font-medium text-brand-text-primary">
                  {formatNumber(metrics?.leads_qualified ?? 0)}
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 text-brand-text-secondary">
                  Termin gebucht
                </td>
                <td className="py-2 text-right font-medium text-brand-text-primary">
                  {formatNumber(metrics?.leads_appointment_booked ?? 0)}
                </td>
              </tr>
              <tr>
                <td className="py-2 text-brand-text-secondary">
                  Disqualifiziert
                </td>
                <td className="py-2 text-right font-medium text-brand-text-primary">
                  {formatNumber(metrics?.leads_disqualified ?? 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="bg-brand-surface rounded-brand p-6 border border-gray-200">
          <h2 className="text-lg font-medium text-brand-text-primary mb-4">
            Leads nach Quelle
          </h2>
          {sourceEntries.length > 0 ? (
            <table className="w-full text-sm">
              <tbody>
                {sourceEntries.map(([source, count], idx) => (
                  <tr
                    key={source}
                    className={
                      idx < sourceEntries.length - 1
                        ? 'border-b border-gray-100'
                        : ''
                    }
                  >
                    <td className="py-2 text-brand-text-secondary capitalize">
                      {source.replace(/_/g, ' ')}
                    </td>
                    <td className="py-2 text-right font-medium text-brand-text-primary">
                      {formatNumber(count)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-brand-text-secondary">
              Keine Quellen-Daten verfügbar.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
