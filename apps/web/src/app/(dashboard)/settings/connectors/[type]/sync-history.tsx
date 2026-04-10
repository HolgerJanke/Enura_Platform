'use client'

import { useState } from 'react'

type Props = {
  logs: Array<Record<string, unknown>>
}

function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '--'
  try {
    return new Intl.DateTimeFormat('de-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(dateString))
  } catch {
    return '--'
  }
}

function formatDuration(
  startedAt: string | null | undefined,
  finishedAt: string | null | undefined
): string {
  if (!startedAt || !finishedAt) return '--'
  try {
    const start = new Date(startedAt).getTime()
    const end = new Date(finishedAt).getTime()
    const diffMs = end - start
    if (diffMs < 0) return '--'

    const seconds = Math.floor(diffMs / 1000)
    if (seconds < 60) return `${seconds}s`

    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    if (minutes < 60) return `${minutes}m ${remainingSeconds}s`

    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return `${hours}h ${remainingMinutes}m`
  } catch {
    return '--'
  }
}

function SyncStatusBadge({ status }: { status: string }) {
  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
        Erfolg
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
        Fehler
      </span>
    )
  }
  if (status === 'running') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
        <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
        </svg>
        Läuft
      </span>
    )
  }
  return (
    <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
      {status}
    </span>
  )
}

export function SyncHistory({ logs }: Props) {
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null)

  if (logs.length === 0) {
    return (
      <div className="bg-brand-surface rounded-brand border border-gray-200 p-6">
        <h2 className="text-lg font-medium text-brand-text-primary mb-2">Synchronisierungsverlauf</h2>
        <p className="text-sm text-brand-text-secondary">
          Noch keine Synchronisierungen durchgeführt.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-brand-surface rounded-brand border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-brand-text-primary">Synchronisierungsverlauf</h2>
        <p className="text-xs text-brand-text-secondary mt-0.5">
          Letzte {logs.length} Synchronisierungen
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-brand-text-secondary">
                Gestartet
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-brand-text-secondary">
                Dauer
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-brand-text-secondary">
                Abgerufen
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-brand-text-secondary">
                Geschrieben
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-brand-text-secondary">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-brand-text-secondary">
                Fehler
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {logs.map((log) => {
              const logId = log['id'] as string
              const startedAt = log['started_at'] as string | undefined
              const finishedAt = log['finished_at'] as string | undefined
              const recordsFetched = log['records_fetched'] as number | undefined
              const recordsWritten = log['records_written'] as number | undefined
              const status = log['status'] as string | undefined
              const errorMessage = log['error_message'] as string | undefined
              const isExpanded = expandedErrorId === logId

              return (
                <tr key={logId} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-brand-text-primary whitespace-nowrap">
                    {formatDateTime(startedAt)}
                  </td>
                  <td className="px-4 py-3 text-sm text-brand-text-secondary whitespace-nowrap">
                    {formatDuration(startedAt, finishedAt)}
                  </td>
                  <td className="px-4 py-3 text-sm text-brand-text-secondary text-right whitespace-nowrap">
                    {recordsFetched !== undefined ? recordsFetched.toLocaleString('de-CH') : '--'}
                  </td>
                  <td className="px-4 py-3 text-sm text-brand-text-secondary text-right whitespace-nowrap">
                    {recordsWritten !== undefined ? recordsWritten.toLocaleString('de-CH') : '--'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <SyncStatusBadge status={status ?? 'unknown'} />
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {errorMessage ? (
                      <div>
                        <button
                          type="button"
                          onClick={() => setExpandedErrorId(isExpanded ? null : logId)}
                          className="text-xs text-red-600 hover:text-red-700 underline transition-colors"
                          aria-label={isExpanded ? 'Fehlerdetails ausblenden' : 'Fehlerdetails anzeigen'}
                        >
                          {isExpanded ? 'Ausblenden' : 'Details anzeigen'}
                        </button>
                        {isExpanded && (
                          <div className="mt-2 rounded-brand border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 font-mono whitespace-pre-wrap break-all max-w-md">
                            {errorMessage}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-brand-text-secondary">--</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
