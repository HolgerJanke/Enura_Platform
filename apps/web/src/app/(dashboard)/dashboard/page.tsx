import { getSession } from '@/lib/session'
import { ProcessHouseContainer } from '@/components/process-house/ProcessHouseContainer'
import { getCompanyContext } from '@/lib/tenant'
import { getDataAccess } from '@/lib/data-access'
import { formatDate, KPI_SNAPSHOT_TYPES } from '@enura/types'
import type { ConnectorRow } from '@enura/types'

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

  const _metrics = snapshot?.metrics

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
