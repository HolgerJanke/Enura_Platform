'use client'

import { useState } from 'react'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SecretRow = {
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
}

type SecretsClientProps = {
  secrets: SecretRow[]
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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
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

function getRotationStatus(nextDue: string | null): 'ok' | 'warning' | 'overdue' | 'none' {
  if (!nextDue) return 'none'
  const now = new Date()
  const due = new Date(nextDue)
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'overdue'
  if (diffDays <= 7) return 'warning'
  return 'ok'
}

function rotationStatusColor(status: 'ok' | 'warning' | 'overdue' | 'none'): string {
  switch (status) {
    case 'ok': return 'text-green-700 bg-green-50'
    case 'warning': return 'text-yellow-700 bg-yellow-50'
    case 'overdue': return 'text-red-700 bg-red-50'
    case 'none': return 'text-gray-500 bg-gray-50'
  }
}

function rotationStatusLabel(status: 'ok' | 'warning' | 'overdue' | 'none'): string {
  switch (status) {
    case 'ok': return 'OK'
    case 'warning': return 'Bald faellig'
    case 'overdue': return 'Ueberfaellig'
    case 'none': return 'Keine Rotation'
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SecretsClient({ secrets }: SecretsClientProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'calendar'>('all')

  const sortedByRotation = [...secrets]
    .filter((s) => s.next_rotation_due !== null)
    .sort((a, b) => {
      const aDate = a.next_rotation_due ? new Date(a.next_rotation_due).getTime() : Infinity
      const bDate = b.next_rotation_due ? new Date(b.next_rotation_due).getTime() : Infinity
      return aDate - bDate
    })

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'all'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Alle Secrets ({secrets.length})
        </button>
        <button
          onClick={() => setActiveTab('calendar')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'calendar'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Rotationskalender ({sortedByRotation.length})
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'all' && <SecretsTable secrets={secrets} />}
      {activeTab === 'calendar' && <RotationCalendar secrets={sortedByRotation} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Secrets Table
// ---------------------------------------------------------------------------

function SecretsTable({ secrets }: { secrets: SecretRow[] }) {
  if (secrets.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
        <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
        </svg>
        <p className="mt-4 text-sm text-gray-500">Noch keine Secrets vorhanden.</p>
        <Link
          href="/admin/secrets/new"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Erstes Secret anlegen
        </Link>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Typ</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Scope</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Letzte Rotation</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Naechste Rotation</th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Aktionen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {secrets.map((secret) => {
            const rotStatus = getRotationStatus(secret.next_rotation_due)
            return (
              <tr key={secret.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900 font-mono">{secret.name}</span>
                    {secret.description && (
                      <span className="text-xs text-gray-500 mt-0.5">{secret.description}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                    {SECRET_TYPE_LABELS[secret.secret_type] ?? secret.secret_type}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{secret.scope}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      secret.is_active
                        ? 'bg-green-50 text-green-700'
                        : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {secret.is_active ? 'Aktiv' : 'Inaktiv'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {secret.last_rotated_at ? formatDateTime(secret.last_rotated_at) : '--'}
                </td>
                <td className="px-4 py-3">
                  {secret.next_rotation_due ? (
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${rotationStatusColor(rotStatus)}`}
                    >
                      {formatDate(secret.next_rotation_due)} &middot; {rotationStatusLabel(rotStatus)}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">--</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/secrets/${secret.id}`}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    Bearbeiten
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rotation Calendar (Timeline)
// ---------------------------------------------------------------------------

function RotationCalendar({ secrets }: { secrets: SecretRow[] }) {
  if (secrets.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
        <p className="text-sm text-gray-500">
          Keine Secrets mit konfigurierter Rotation vorhanden.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {secrets.map((secret) => {
        const rotStatus = getRotationStatus(secret.next_rotation_due)
        return (
          <div
            key={secret.id}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-5 py-4 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center gap-4">
              {/* Status Indicator */}
              <div
                className={`h-3 w-3 rounded-full ${
                  rotStatus === 'overdue'
                    ? 'bg-red-500'
                    : rotStatus === 'warning'
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                }`}
                aria-label={rotationStatusLabel(rotStatus)}
              />
              <div>
                <p className="text-sm font-medium text-gray-900 font-mono">{secret.name}</p>
                <p className="text-xs text-gray-500">
                  {SECRET_TYPE_LABELS[secret.secret_type] ?? secret.secret_type} &middot;{' '}
                  Intervall: {secret.rotation_interval_days} Tage
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className={`text-sm font-medium ${
                  rotStatus === 'overdue'
                    ? 'text-red-700'
                    : rotStatus === 'warning'
                      ? 'text-yellow-700'
                      : 'text-gray-900'
                }`}>
                  {secret.next_rotation_due ? formatDate(secret.next_rotation_due) : '--'}
                </p>
                <p className="text-xs text-gray-500">
                  Letzte: {secret.last_rotated_at ? formatDate(secret.last_rotated_at) : 'Nie'}
                </p>
              </div>
              <Link
                href={`/admin/secrets/${secret.id}`}
                className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Details
              </Link>
            </div>
          </div>
        )
      })}
    </div>
  )
}
