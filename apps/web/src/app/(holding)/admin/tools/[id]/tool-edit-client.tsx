'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { updateTool, testConnection, type UpdateToolInput, type TestConnectionResult } from './actions'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ToolDetail = {
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

type ToolEditClientProps = {
  tool: ToolDetail
  availableSecrets: string[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'crm', label: 'CRM' },
  { value: 'telephony', label: 'Telefonie' },
  { value: 'accounting', label: 'Buchhaltung' },
  { value: 'calendar', label: 'Kalender' },
  { value: 'lead_aggregation', label: 'Lead-Aggregation' },
  { value: 'messaging', label: 'Messaging' },
  { value: 'email', label: 'E-Mail' },
  { value: 'storage', label: 'Speicher' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'custom', label: 'Benutzerdefiniert' },
]

const AUTH_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'api_key', label: 'API Key' },
  { value: 'oauth2', label: 'OAuth 2.0' },
  { value: 'service_account', label: 'Service Account' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'none', label: 'Keine Authentifizierung' },
]

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ToolEditClient({ tool, availableSecrets }: ToolEditClientProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null)

  const [name, setName] = useState(tool.name)
  const [slug, setSlug] = useState(tool.slug)
  const [category, setCategory] = useState(tool.category)
  const [baseUrl, setBaseUrl] = useState(tool.base_url ?? '')
  const [authType, setAuthType] = useState(tool.auth_type)
  const [secretRef, setSecretRef] = useState(tool.secret_ref ?? '')
  const [docsUrl, setDocsUrl] = useState(tool.docs_url ?? '')
  const [isActive, setIsActive] = useState(tool.is_active)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setFieldErrors({})
    setIsSubmitting(true)

    try {
      const input: UpdateToolInput = {
        name,
        slug,
        category: category as UpdateToolInput['category'],
        base_url: baseUrl || '',
        auth_type: authType as UpdateToolInput['auth_type'],
        secret_ref: secretRef || '',
        docs_url: docsUrl || '',
        is_active: isActive,
      }

      const result = await updateTool(tool.id, input)

      if (!result.success) {
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors)
        }
        if (result.error) {
          setError(result.error)
        }
        return
      }

      setSuccess('Tool wurde erfolgreich aktualisiert.')
      router.refresh()
    } catch {
      setError('Ein unerwarteter Fehler ist aufgetreten.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleTestConnection() {
    setTestResult(null)
    setIsTesting(true)

    try {
      const result = await testConnection(tool.id)
      setTestResult(result)
    } catch {
      setTestResult({
        success: false,
        status: 'error',
        message: 'Verbindungstest fehlgeschlagen.',
      })
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div>
      {/* Back link & header */}
      <Link
        href="/admin/tools"
        className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        &larr; Zurueck zur Tool-Registry
      </Link>

      <div className="flex items-center justify-between mt-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{tool.name}</h1>
          <p className="text-sm text-gray-500 mt-1 font-mono">{tool.slug}</p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
            tool.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {tool.is_active ? 'Aktiv' : 'Inaktiv'}
        </span>
      </div>

      {/* Metadata */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 mb-6 flex gap-6 text-xs text-gray-500">
        <span>Erstellt: {formatDateTime(tool.created_at)}</span>
        <span>Aktualisiert: {formatDateTime(tool.updated_at)}</span>
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

      {/* Connection Test */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 mb-6">
        <h2 className="text-sm font-medium text-gray-900 mb-3">Verbindungstest</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={handleTestConnection}
            disabled={isTesting}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTesting ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Wird getestet...
              </>
            ) : (
              'Verbindung testen'
            )}
          </button>
          {testResult && (
            <div
              className={`rounded-md px-3 py-2 text-xs font-medium ${
                testResult.success
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700'
              }`}
            >
              {testResult.message}
            </div>
          )}
        </div>
      </div>

      {/* Edit Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Tool-Name"
          />
          {fieldErrors['name'] && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors['name'].join(', ')}</p>
          )}
        </div>

        {/* Slug */}
        <div>
          <label htmlFor="slug" className="block text-sm font-medium text-gray-700 mb-1">
            Slug <span className="text-red-500">*</span>
          </label>
          <input
            id="slug"
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Tool-Slug"
          />
          {fieldErrors['slug'] && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors['slug'].join(', ')}</p>
          )}
        </div>

        {/* Category */}
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
            Kategorie <span className="text-red-500">*</span>
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Tool-Kategorie"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {fieldErrors['category'] && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors['category'].join(', ')}</p>
          )}
        </div>

        {/* Base URL */}
        <div>
          <label htmlFor="base_url" className="block text-sm font-medium text-gray-700 mb-1">
            Base URL
          </label>
          <input
            id="base_url"
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.example.com/v1"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Tool Base-URL"
          />
          {fieldErrors['base_url'] && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors['base_url'].join(', ')}</p>
          )}
        </div>

        {/* Auth Type */}
        <div>
          <label htmlFor="auth_type" className="block text-sm font-medium text-gray-700 mb-1">
            Authentifizierungstyp <span className="text-red-500">*</span>
          </label>
          <select
            id="auth_type"
            value={authType}
            onChange={(e) => setAuthType(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Authentifizierungstyp"
          >
            {AUTH_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {fieldErrors['auth_type'] && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors['auth_type'].join(', ')}</p>
          )}
        </div>

        {/* Secret Ref (dropdown from available secrets) */}
        <div>
          <label htmlFor="secret_ref" className="block text-sm font-medium text-gray-700 mb-1">
            Secret-Referenz
          </label>
          <select
            id="secret_ref"
            value={secretRef}
            onChange={(e) => setSecretRef(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Secret-Referenz auswaehlen"
          >
            <option value="">Kein Secret</option>
            {availableSecrets.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Waehlen Sie ein vorhandenes Secret aus der Secret-Verwaltung.
          </p>
          {fieldErrors['secret_ref'] && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors['secret_ref'].join(', ')}</p>
          )}
        </div>

        {/* Docs URL */}
        <div>
          <label htmlFor="docs_url" className="block text-sm font-medium text-gray-700 mb-1">
            Dokumentations-URL
          </label>
          <input
            id="docs_url"
            type="url"
            value={docsUrl}
            onChange={(e) => setDocsUrl(e.target.value)}
            placeholder="https://docs.example.com"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Dokumentations-URL"
          />
          {fieldErrors['docs_url'] && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors['docs_url'].join(', ')}</p>
          )}
        </div>

        {/* Active Toggle */}
        <div className="flex items-center gap-3">
          <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
            Tool aktiv
          </label>
          <button
            type="button"
            id="is_active"
            role="switch"
            aria-checked={isActive}
            onClick={() => setIsActive(!isActive)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isActive ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isActive ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Wird gespeichert...
              </>
            ) : (
              'Aenderungen speichern'
            )}
          </button>
          <Link
            href="/admin/tools"
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Abbrechen
          </Link>
        </div>
      </form>
    </div>
  )
}
