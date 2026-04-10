import { getSession } from '@/lib/session'
import { ProcessHouseContainer } from '@/components/process-house/ProcessHouseContainer'
import { getCompanyContext } from '@/lib/tenant'
import { getDataAccess } from '@/lib/data-access'
import {
  formatCHF,
  formatPercent,
  formatNumber,
  formatDate,
  formatDuration,
  KPI_SNAPSHOT_TYPES,
} from '@enura/types'
import type { TenantDailySummaryMetrics, ConnectorRow } from '@enura/types'

export default async function DashboardPage() {
  const session = await getSession()
  const { companyName } = getCompanyContext()

  if (!session?.companyId) return null

  const displayName =
    session.profile.display_name ?? session.profile.first_name ?? 'Benutzer'

  const db = getDataAccess()
  const today = new Date().toISOString().split('T')[0]!

  // Fetch tenant daily summary snapshot and connectors in parallel
  const [snapshot, connectors] = await Promise.all([
    db.kpis.findLatest(
      session.companyId,
      KPI_SNAPSHOT_TYPES.TENANT_DAILY_SUMMARY,
    ),
    db.connectors.findByCompanyId(session.companyId),
  ])

  const metrics = snapshot?.metrics as TenantDailySummaryMetrics | undefined

  // Connector status display mapping
  const connectorStatusLabel: Record<string, { label: string; className: string }> = {
    active: {
      label: 'Aktiv',
      className: 'bg-green-100 text-green-700',
    },
    paused: {
      label: 'Pausiert',
      className: 'bg-yellow-100 text-yellow-700',
    },
    error: {
      label: 'Fehler',
      className: 'bg-red-100 text-red-700',
    },
    disconnected: {
      label: 'Getrennt',
      className: 'bg-gray-100 text-gray-700',
    },
  }

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl sm:text-2xl font-semibold text-brand-text-primary mb-2">
        Willkommen, {displayName}
      </h1>
      <p className="text-brand-text-secondary mb-8">
        {companyName} &mdash; Übersicht vom {formatDate(today)}
      </p>

      {/* Top-level aggregated KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">Offene Leads</p>
          <p className="text-2xl font-semibold text-brand-text-primary mt-1">
            {formatNumber(metrics?.leads.leads_unworked_count ?? 0)}
          </p>
        </div>
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">Anrufe heute</p>
          <p className="text-2xl font-semibold text-brand-text-primary mt-1">
            {formatNumber(metrics?.setter.calls_total ?? 0)}
          </p>
        </div>
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">Offene Angebote</p>
          <p className="text-2xl font-semibold text-brand-text-primary mt-1">
            {formatNumber(metrics?.berater.offers_created ?? 0)}
          </p>
        </div>
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">Umsatz MTD</p>
          <p className="text-2xl font-semibold text-brand-text-primary mt-1">
            {formatCHF(metrics?.finance?.revenue_total_chf ?? 0)}
          </p>
        </div>
      </div>

      {/* Module summaries */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Setter summary */}
        <div className="bg-brand-surface rounded-brand p-6 border border-gray-200">
          <h2 className="text-lg font-medium text-brand-text-primary mb-4">
            Setter
          </h2>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-1.5 text-brand-text-secondary">
                  Erreichbarkeit
                </td>
                <td className="py-1.5 text-right font-medium text-brand-text-primary">
                  {formatPercent(metrics?.setter.reach_rate ?? 0)}
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-1.5 text-brand-text-secondary">
                  Termine gebucht
                </td>
                <td className="py-1.5 text-right font-medium text-brand-text-primary">
                  {formatNumber(metrics?.setter.appointments_booked ?? 0)}
                </td>
              </tr>
              <tr>
                <td className="py-1.5 text-brand-text-secondary">
                  Durchschnittl. Dauer
                </td>
                <td className="py-1.5 text-right font-medium text-brand-text-primary">
                  {formatDuration(metrics?.setter.avg_duration_sec ?? 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Berater summary */}
        <div className="bg-brand-surface rounded-brand p-6 border border-gray-200">
          <h2 className="text-lg font-medium text-brand-text-primary mb-4">
            Berater
          </h2>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-1.5 text-brand-text-secondary">
                  Abschlussrate
                </td>
                <td className="py-1.5 text-right font-medium text-brand-text-primary">
                  {formatPercent(metrics?.berater.closing_rate ?? 0)}
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-1.5 text-brand-text-secondary">
                  Pipeline-Wert
                </td>
                <td className="py-1.5 text-right font-medium text-brand-text-primary">
                  {formatCHF(metrics?.berater.pipeline_value_chf ?? 0)}
                </td>
              </tr>
              <tr>
                <td className="py-1.5 text-brand-text-secondary">
                  Aktivitäten
                </td>
                <td className="py-1.5 text-right font-medium text-brand-text-primary">
                  {formatNumber(metrics?.berater.activities_total ?? 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Projects summary */}
        <div className="bg-brand-surface rounded-brand p-6 border border-gray-200">
          <h2 className="text-lg font-medium text-brand-text-primary mb-4">
            Projekte
          </h2>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-1.5 text-brand-text-secondary">Aktiv</td>
                <td className="py-1.5 text-right font-medium text-brand-text-primary">
                  {formatNumber(metrics?.projects.total_active ?? 0)}
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-1.5 text-brand-text-secondary">Blockiert</td>
                <td className="py-1.5 text-right font-medium text-brand-text-primary">
                  {formatNumber(metrics?.projects.stalled_count ?? 0)}
                </td>
              </tr>
              <tr>
                <td className="py-1.5 text-brand-text-secondary">
                  Abgeschlossen (30T)
                </td>
                <td className="py-1.5 text-right font-medium text-brand-text-primary">
                  {formatNumber(metrics?.projects.completed_30d ?? 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Process House */}
      <div className="bg-brand-surface rounded-brand p-6 border border-gray-200 mb-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-brand-text-secondary mb-4">
          Prozesshaus
        </h2>
        <ProcessHouseContainer />
      </div>

      {/* Connector health */}
      <div className="bg-brand-surface rounded-brand p-6 border border-gray-200">
        <h2 className="text-lg font-medium text-brand-text-primary mb-4">
          Systemstatus
        </h2>
        {connectors.length > 0 ? (
          <ul className="space-y-3">
            {connectors.map((connector: ConnectorRow) => {
              const statusInfo = connectorStatusLabel[connector.status] ?? {
                label: connector.status,
                className: 'bg-gray-100 text-gray-700',
              }
              return (
                <li
                  key={connector.id}
                  className="flex items-center justify-between"
                >
                  <div>
                    <span className="text-sm text-brand-text-primary">
                      {connector.name}
                    </span>
                    {connector.last_synced_at && (
                      <span className="text-xs text-brand-text-secondary ml-2">
                        Letzte Sync: {formatDate(connector.last_synced_at)}
                      </span>
                    )}
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.className}`}
                  >
                    {statusInfo.label}
                  </span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-sm text-brand-text-secondary">
            Keine Connectoren konfiguriert.
          </p>
        )}
      </div>
    </div>
  )
}
