'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createTool, type CreateToolInput } from './actions'

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

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NewToolPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [category, setCategory] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [authType, setAuthType] = useState('')
  const [secretRef, setSecretRef] = useState('')
  const [docsUrl, setDocsUrl] = useState('')

  // Auto-generate slug from name unless manually edited
  useEffect(() => {
    if (!slugManuallyEdited) {
      setSlug(generateSlug(name))
    }
  }, [name, slugManuallyEdited])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    setIsSubmitting(true)

    try {
      const input: CreateToolInput = {
        name,
        slug,
        category: category as CreateToolInput['category'],
        base_url: baseUrl || '',
        auth_type: authType as CreateToolInput['auth_type'],
        secret_ref: secretRef || '',
        docs_url: docsUrl || '',
      }

      const result = await createTool(input)

      if (!result.success) {
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors)
        }
        if (result.error) {
          setError(result.error)
        }
        return
      }

      router.push('/admin/tools')
    } catch {
      setError('Ein unerwarteter Fehler ist aufgetreten.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/admin/tools"
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          &larr; Zurueck zur Tool-Registry
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900 mt-2">Neues Tool registrieren</h1>
        <p className="text-gray-500 mt-1">
          Registrieren Sie ein externes Tool oder eine Integration fuer Ihre Holding.
        </p>
      </div>

      {/* Global Error */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Form */}
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
            placeholder="Reonic CRM"
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
            onChange={(e) => {
              setSlug(e.target.value)
              setSlugManuallyEdited(true)
            }}
            placeholder="reonic-crm"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Tool-Slug"
          />
          <p className="mt-1 text-xs text-gray-500">
            Wird automatisch aus dem Namen generiert. Kann manuell angepasst werden.
          </p>
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
            aria-label="Tool-Kategorie auswaehlen"
          >
            <option value="">Kategorie auswaehlen...</option>
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
            placeholder="https://api.reonic.com/v1"
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
            aria-label="Authentifizierungstyp auswaehlen"
          >
            <option value="">Auth-Typ auswaehlen...</option>
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

        {/* Secret Ref */}
        <div>
          <label htmlFor="secret_ref" className="block text-sm font-medium text-gray-700 mb-1">
            Secret-Referenz
          </label>
          <input
            id="secret_ref"
            type="text"
            value={secretRef}
            onChange={(e) => setSecretRef(e.target.value)}
            placeholder="REONIC_API_KEY"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Secret-Referenz (Name des Secrets)"
          />
          <p className="mt-1 text-xs text-gray-500">
            Name des Secrets aus der Secret-Verwaltung (z.B. REONIC_API_KEY)
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
            placeholder="https://docs.reonic.com"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Dokumentations-URL"
          />
          {fieldErrors['docs_url'] && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors['docs_url'].join(', ')}</p>
          )}
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
              'Tool registrieren'
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
