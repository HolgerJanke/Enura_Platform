'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { triggerSyncAction } from './[type]/actions'

type ConnectorTypeInfo = {
  readonly type: string
  readonly label: string
  readonly description: string
  readonly icon: string
}

type Props = {
  connectorTypes: ReadonlyArray<ConnectorTypeInfo>
  configuredConnectors: Array<Record<string, unknown>>
  syncLogs: Array<Record<string, unknown>>
  companyId: string
}

type ConnectorStatus = 'active' | 'error' | 'paused' | 'unconfigured'

function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return 'Nie'
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSeconds = Math.floor(diffMs / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffSeconds < 60) return 'Gerade eben'
    if (diffMinutes < 60) return `Vor ${diffMinutes} Min.`
    if (diffHours < 24) return `Vor ${diffHours} Std.`
    if (diffDays < 7) return `Vor ${diffDays} Tag${diffDays !== 1 ? 'en' : ''}`
    return new Intl.DateTimeFormat('de-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  } catch {
    return 'Unbekannt'
  }
}

function StatusBadge({ status }: { status: ConnectorStatus }) {
  const config: Record<ConnectorStatus, { label: string; classes: string }> = {
    active: { label: 'Aktiv', classes: 'bg-green-100 text-green-700' },
    error: { label: 'Fehler', classes: 'bg-red-100 text-red-700' },
    paused: { label: 'Pausiert', classes: 'bg-yellow-100 text-yellow-700' },
    unconfigured: { label: 'Nicht konfiguriert', classes: 'bg-gray-100 text-gray-600' },
  }
  const { label, classes } = config[status]
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}`}>
      {label}
    </span>
  )
}

function ConnectorIcon({ icon, status }: { icon: string; status: ConnectorStatus }) {
  const iconColor = status === 'active'
    ? 'text-green-600'
    : status === 'error'
      ? 'text-red-600'
      : 'text-gray-400'

  const iconMap: Record<string, JSX.Element> = {
    link: (
      <svg className={`h-6 w-6 ${iconColor}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m9.86-2.03a4.5 4.5 0 0 0-1.242-7.244l-4.5-4.5a4.5 4.5 0 0 0-6.364 6.364L5.25 9.879" />
      </svg>
    ),
    phone: (
      <svg className={`h-6 w-6 ${iconColor}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
      </svg>
    ),
    banknotes: (
      <svg className={`h-6 w-6 ${iconColor}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
      </svg>
    ),
    calendar: (
      <svg className={`h-6 w-6 ${iconColor}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 9v9.75" />
      </svg>
    ),
    inbox: (
      <svg className={`h-6 w-6 ${iconColor}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-17.5 0a2.25 2.25 0 0 0-2.25 2.25v1.5a2.25 2.25 0 0 0 2.25 2.25h19.5a2.25 2.25 0 0 0 2.25-2.25v-1.5a2.25 2.25 0 0 0-2.25-2.25m-17.5 0V4.125c0-.621.504-1.125 1.125-1.125h15.75c.621 0 1.125.504 1.125 1.125v9.375" />
      </svg>
    ),
  }

  return iconMap[icon] ?? iconMap['link']
}

export function ConnectorListClient({
  connectorTypes,
  configuredConnectors,
  syncLogs,
  companyId: _companyId,
}: Props) {
  const router = useRouter()
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const getConfiguredConnector = useCallback(
    (type: string): Record<string, unknown> | undefined => {
      return configuredConnectors.find((c) => c['type'] === type)
    },
    [configuredConnectors]
  )

  const getLatestSyncLog = useCallback(
    (connectorId: string): Record<string, unknown> | undefined => {
      return syncLogs.find((log) => log['connector_id'] === connectorId)
    },
    [syncLogs]
  )

  const getStatus = useCallback(
    (type: string): ConnectorStatus => {
      const connector = getConfiguredConnector(type)
      if (!connector) return 'unconfigured'
      const status = connector['status'] as string | undefined
      if (status === 'error') return 'error'
      if (status === 'paused') return 'paused'
      return 'active'
    },
    [getConfiguredConnector]
  )

  const handleSync = useCallback(
    (connectorId: string) => {
      setSyncError(null)
      setSyncingId(connectorId)
      startTransition(async () => {
        const result = await triggerSyncAction(connectorId)
        if (result.error) {
          setSyncError(result.error)
        }
        setSyncingId(null)
        router.refresh()
      })
    },
    [router]
  )

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {syncError && (
        <div
          className="col-span-full rounded-brand border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-2"
          role="alert"
        >
          {syncError}
        </div>
      )}

      {connectorTypes.map((ct) => {
        const connector = getConfiguredConnector(ct.type)
        const status = getStatus(ct.type)
        const connectorId = connector?.['id'] as string | undefined
        const lastSyncedAt = connector?.['last_synced_at'] as string | undefined
        const syncLog = connectorId ? getLatestSyncLog(connectorId) : undefined
        const recordsSynced = syncLog?.['records_written'] as number | undefined
        const isSyncing = syncingId === connectorId && isPending

        return (
          <div
            key={ct.type}
            className="bg-brand-surface rounded-brand border border-gray-200 p-5 flex flex-col gap-4 transition-shadow hover:shadow-md"
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-brand bg-brand-background border border-gray-200">
                  <ConnectorIcon icon={ct.icon} status={status} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-brand-text-primary">{ct.label}</h3>
                  <p className="text-xs text-brand-text-secondary mt-0.5">{ct.description}</p>
                </div>
              </div>
              <StatusBadge status={status} />
            </div>

            {/* Sync info */}
            {status !== 'unconfigured' && (
              <div className="flex items-center justify-between text-xs text-brand-text-secondary border-t border-gray-100 pt-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    <span>Letzte Sync: {formatRelativeTime(lastSyncedAt)}</span>
                  </div>
                  {recordsSynced !== undefined && (
                    <div className="flex items-center gap-1.5">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-12.75c0-.621.504-1.125 1.125-1.125h9.75c.621 0 1.125.504 1.125 1.125m-12 12.75h9.75m-9.75 0a1.125 1.125 0 0 1-1.125-1.125" />
                      </svg>
                      <span>{recordsSynced} Datensaetze</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 mt-auto pt-1">
              {status === 'unconfigured' ? (
                <Link
                  href={`/settings/connectors/${ct.type}`}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
                  style={{ backgroundColor: 'var(--brand-primary)' }}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Konfigurieren
                </Link>
              ) : (
                <>
                  <Link
                    href={`/settings/connectors/${ct.type}`}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-brand border border-gray-300 bg-brand-background px-3 py-2 text-sm font-medium text-brand-text-primary hover:bg-gray-50 transition-colors"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                    </svg>
                    Bearbeiten
                  </Link>
                  <button
                    type="button"
                    onClick={() => connectorId && handleSync(connectorId)}
                    disabled={isSyncing || !connectorId}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: 'var(--brand-primary)' }}
                    aria-label={`${ct.label} jetzt synchronisieren`}
                  >
                    <svg
                      className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                    </svg>
                    {isSyncing ? 'Synchronisiert...' : 'Jetzt synchronisieren'}
                  </button>
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
