'use client'

import { useState } from 'react'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ToolRow = {
  id: string
  holding_id: string
  name: string
  slug: string
  category: string
  base_url: string | null
  auth_type: string
  secret_ref: string | null
  is_active: boolean
  icon_url: string | null
  docs_url: string | null
  created_at: string
  updated_at: string
}

type ToolsClientProps = {
  tools: ToolRow[]
}

type TestResult = {
  toolId: string
  status: 'loading' | 'success' | 'error'
  message?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  crm: 'CRM',
  telephony: 'Telefonie',
  accounting: 'Buchhaltung',
  calendar: 'Kalender',
  lead_aggregation: 'Lead-Aggregation',
  messaging: 'Messaging',
  email: 'E-Mail',
  storage: 'Speicher',
  analytics: 'Analytics',
  custom: 'Benutzerdefiniert',
}

const CATEGORY_COLORS: Record<string, string> = {
  crm: 'bg-blue-50 text-blue-700',
  telephony: 'bg-purple-50 text-purple-700',
  accounting: 'bg-green-50 text-green-700',
  calendar: 'bg-yellow-50 text-yellow-700',
  lead_aggregation: 'bg-orange-50 text-orange-700',
  messaging: 'bg-teal-50 text-teal-700',
  email: 'bg-indigo-50 text-indigo-700',
  storage: 'bg-gray-100 text-gray-700',
  analytics: 'bg-pink-50 text-pink-700',
  custom: 'bg-gray-100 text-gray-600',
}

const AUTH_TYPE_LABELS: Record<string, string> = {
  api_key: 'API Key',
  oauth2: 'OAuth 2.0',
  service_account: 'Service Account',
  webhook: 'Webhook',
  none: 'Keine',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function maskSecretRef(ref: string | null): string {
  if (!ref) return '--'
  if (ref.length <= 6) return '***'
  return `${ref.substring(0, 4)}${'*'.repeat(Math.min(ref.length - 4, 12))}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ToolsClient({ tools }: ToolsClientProps) {
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({})

  async function handleTestConnection(tool: ToolRow) {
    setTestResults((prev) => ({
      ...prev,
      [tool.id]: { toolId: tool.id, status: 'loading' },
    }))

    // Simulate connection test (in production, this calls the API)
    // The actual test would call POST /api/tools/:id/test
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500))

      if (!tool.base_url) {
        setTestResults((prev) => ({
          ...prev,
          [tool.id]: {
            toolId: tool.id,
            status: 'error',
            message: 'Keine Base-URL konfiguriert',
          },
        }))
        return
      }

      // Simulate success for active tools with a base URL
      setTestResults((prev) => ({
        ...prev,
        [tool.id]: {
          toolId: tool.id,
          status: tool.is_active ? 'success' : 'error',
          message: tool.is_active
            ? 'Verbindung erfolgreich'
            : 'Tool ist deaktiviert',
        },
      }))
    } catch {
      setTestResults((prev) => ({
        ...prev,
        [tool.id]: {
          toolId: tool.id,
          status: 'error',
          message: 'Verbindungstest fehlgeschlagen',
        },
      }))
    }
  }

  if (tools.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
        <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.42 15.17l-5.17-.16a.5.5 0 01-.42-.59l.69-3.01a.5.5 0 01.59-.42l5.17.16m-5.17-.16l.69-3.01m5.17.16l5.17-.16a.5.5 0 01.59.42l.69 3.01a.5.5 0 01-.42.59l-5.17.16m5.17-.16l-.69 3.01M3.75 7.5h16.5M3.75 16.5h16.5" />
        </svg>
        <p className="mt-4 text-sm text-gray-500">Noch keine Tools registriert.</p>
        <Link
          href="/admin/tools/new"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Erstes Tool registrieren
        </Link>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {tools.map((tool) => {
        const testResult = testResults[tool.id]
        return (
          <div
            key={tool.id}
            className="rounded-lg border border-gray-200 bg-white p-5 hover:shadow-sm transition-shadow flex flex-col"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-medium text-gray-900 truncate">{tool.name}</h3>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{tool.slug}</p>
              </div>
              <span
                className={`ml-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  tool.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}
              >
                {tool.is_active ? 'Aktiv' : 'Inaktiv'}
              </span>
            </div>

            {/* Details */}
            <div className="space-y-2 mb-4 flex-1">
              {/* Category Badge */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Kategorie:</span>
                <span
                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                    CATEGORY_COLORS[tool.category] ?? 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {CATEGORY_LABELS[tool.category] ?? tool.category}
                </span>
              </div>

              {/* Auth Type */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Auth:</span>
                <span className="text-xs text-gray-700">
                  {AUTH_TYPE_LABELS[tool.auth_type] ?? tool.auth_type}
                </span>
              </div>

              {/* Secret Ref (masked) */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Secret:</span>
                <span className="text-xs text-gray-700 font-mono">
                  {maskSecretRef(tool.secret_ref)}
                </span>
              </div>

              {/* Base URL */}
              {tool.base_url && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">URL:</span>
                  <span className="text-xs text-gray-700 truncate">{tool.base_url}</span>
                </div>
              )}
            </div>

            {/* Test Result */}
            {testResult && (
              <div
                className={`mb-3 rounded-md px-3 py-2 text-xs ${
                  testResult.status === 'loading'
                    ? 'bg-blue-50 text-blue-700'
                    : testResult.status === 'success'
                      ? 'bg-green-50 text-green-700'
                      : 'bg-red-50 text-red-700'
                }`}
              >
                {testResult.status === 'loading' ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Wird getestet...
                  </span>
                ) : (
                  testResult.message
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-3 border-t border-gray-100">
              <Link
                href={`/admin/tools/${tool.id}`}
                className="flex-1 rounded-md bg-gray-100 px-3 py-2 text-center text-xs font-medium text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Bearbeiten
              </Link>
              <button
                onClick={() => handleTestConnection(tool)}
                disabled={testResult?.status === 'loading'}
                className="flex-1 rounded-md bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Verbindung testen
              </button>
            </div>

            {/* Docs link */}
            {tool.docs_url && (
              <a
                href={tool.docs_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 text-xs text-blue-600 hover:text-blue-800 transition-colors"
              >
                Dokumentation &rarr;
              </a>
            )}
          </div>
        )
      })}
    </div>
  )
}
