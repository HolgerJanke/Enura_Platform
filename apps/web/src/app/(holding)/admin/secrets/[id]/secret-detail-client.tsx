'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { rotateSecret, deactivateSecret, reactivateSecret } from './actions'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SecretDetail = {
  id: string
  holding_id: string
  name: string
  secret_type: string
  scope: string
  description: string | null
  is_active: boolean
  created_at: string
  last_rotated_at: string | null
  rotation_interval_days: number | null
  next_rotation_due: string | null
  vault_id: string | null
}

type AccessLogEntry = {
  id: number
  secret_id: string
  accessed_by: string
  context: string | null
  accessed_at: string
}

type SecretDetailClientProps = {
  secret: SecretDetail
  accessLogs: AccessLogEntry[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SECRET_TYPE_LABELS: Record<string, string> = {
  api_key: 'API Key',
  oauth2_token: 'OAuth 2.0 Token',
  service_account: 'Service Account',
  certificate: 'Zertifikat',
  password: 'Passwort',
  webhook_secret: 'Webhook Secret',
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function getRotationStatus(nextDue: string | null): 'ok' | 'warning' | 'overdue' | 'none' {
  if (!nextDue) return 'none'
  const now = new Date()
  const due = new Date(nextDue)
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'overdue'
  if (diffDays <= 7) return 'warning'
  return 'ok'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SecretDetailClient({ secret, accessLogs }: SecretDetailClientProps) {
  const router = useRouter()
  const [showRotateForm, setShowRotateForm] = useState(false)
  const [newValue, setNewValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const rotStatus = getRotationStatus(secret.next_rotation_due)

  async function handleRotate() {
    setError(null)
    setSuccess(null)
    setIsLoading(true)
    try {
      const result = await rotateSecret(secret.id, newValue)
      if (!result.success) {
        setError(result.error ?? 'Fehler bei der Rotation.')
      } else {
        setSuccess('Secret wurde erfolgreich rotiert.')
        setNewValue('')
        setShowRotateForm(false)
        router.refresh()
      }
    } catch {
      setError('Ein unerwarteter Fehler ist aufgetreten.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleToggleActive() {
    setError(null)
    setSuccess(null)
    setIsLoading(true)
    try {
      const result = secret.is_active
        ? await deactivateSecret(secret.id)
        : await reactivateSecret(secret.id)
      if (!result.success) {
        setError(result.error ?? 'Fehler beim Statuswechsel.')
      } else {
        setSuccess(secret.is_active ? 'Secret wurde deaktiviert.' : 'Secret wurde reaktiviert.')
        router.refresh()
      }
    } catch {
      setError('Ein unerwarteter Fehler ist aufgetreten.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      {/* Back link & header */}
      <Link
        href="/admin/secrets"
        className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        &larr; Zurueck zur Secret-Verwaltung
      </Link>

      <div className="flex items-center justify-between mt-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 font-mono">{secret.name}</h1>
          {secret.description && (
            <p className="text-gray-500 mt-1">{secret.description}</p>
          )}
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
            secret.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {secret.is_active ? 'Aktiv' : 'Inaktiv'}
        </span>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {/* Metadata Grid */}
      <div className="rounded-lg border border-gray-200 bg-white mb-6">
        <div className="grid grid-cols-2 gap-px bg-gray-200">
          <MetaField label="Typ" value={SECRET_TYPE_LABELS[secret.secret_type] ?? secret.secret_type} />
          <MetaField label="Scope" value={secret.scope} />
          <MetaField label="Erstellt am" value={formatDateTime(secret.created_at)} />
          <MetaField
            label="Letzte Rotation"
            value={secret.last_rotated_at ? formatDateTime(secret.last_rotated_at) : 'Nie'}
          />
          <MetaField
            label="Rotationsintervall"
            value={
              secret.rotation_interval_days
                ? `${secret.rotation_interval_days} Tage`
                : 'Nicht konfiguriert'
            }
          />
          <MetaField
            label="Naechste Rotation"
            value={secret.next_rotation_due ? formatDate(secret.next_rotation_due) : '--'}
            highlight={rotStatus === 'overdue' ? 'red' : rotStatus === 'warning' ? 'yellow' : undefined}
          />
          <MetaField
            label="Vault-Referenz"
            value={secret.vault_id ? `${secret.vault_id.substring(0, 8)}...` : 'Nicht gesetzt'}
          />
          <MetaField label="Holding-ID" value={`${secret.holding_id.substring(0, 8)}...`} />
        </div>
      </div>

      {/* Actions */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Aktionen</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowRotateForm(!showRotateForm)}
            disabled={isLoading || !secret.is_active}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Wert rotieren
          </button>
          <button
            onClick={handleToggleActive}
            disabled={isLoading}
            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              secret.is_active
                ? 'border-red-300 text-red-700 hover:bg-red-50'
                : 'border-green-300 text-green-700 hover:bg-green-50'
            }`}
          >
            {secret.is_active ? 'Deaktivieren' : 'Reaktivieren'}
          </button>
        </div>

        {/* Rotate form */}
        {showRotateForm && (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <label htmlFor="new_value" className="block text-sm font-medium text-gray-700 mb-2">
              Neuer Secret-Wert
            </label>
            <input
              id="new_value"
              type="password"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              autoComplete="new-password"
              placeholder="Neuen geheimen Wert eingeben..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Neuer geheimer Wert"
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleRotate}
                disabled={isLoading || newValue.length === 0}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Wird rotiert...' : 'Rotation ausfuehren'}
              </button>
              <button
                onClick={() => {
                  setShowRotateForm(false)
                  setNewValue('')
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Access Log */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Zugriffsprotokoll</h2>
          <p className="text-sm text-gray-500 mt-0.5">Letzte 20 Zugriffe auf dieses Secret</p>
        </div>
        {accessLogs.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-gray-500">Noch keine Zugriffe protokolliert.</p>
          </div>
        ) : (
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Zeitpunkt</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Zugriff durch</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Kontext</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {accessLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDateTime(log.accessed_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-mono">
                      {log.accessed_by}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {log.context ?? '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Meta Field Helper
// ---------------------------------------------------------------------------

function MetaField({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: 'red' | 'yellow'
}) {
  const textColor = highlight === 'red'
    ? 'text-red-700'
    : highlight === 'yellow'
      ? 'text-yellow-700'
      : 'text-gray-900'

  return (
    <div className="bg-white px-4 py-3">
      <dt className="text-xs font-medium text-gray-500 uppercase">{label}</dt>
      <dd className={`mt-1 text-sm font-medium ${textColor}`}>{value}</dd>
    </div>
  )
}
