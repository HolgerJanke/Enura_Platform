
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createSecret, type CreateSecretInput } from './actions'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SECRET_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'api_key', label: 'API Key' },
  { value: 'oauth2_token', label: 'OAuth 2.0 Token' },
  { value: 'service_account', label: 'Service Account' },
  { value: 'certificate', label: 'Zertifikat' },
  { value: 'password', label: 'Passwort' },
  { value: 'webhook_secret', label: 'Webhook Secret' },
]

const SCREAMING_SNAKE_REGEX = /^[A-Z][A-Z0-9_]*$/

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NewSecretPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  const [name, setName] = useState('')
  const [secretType, setSecretType] = useState('')
  const [scope, setScope] = useState('global')
  const [description, setDescription] = useState('')
  const [rotationDays, setRotationDays] = useState('')
  const [value, setValue] = useState('')

  const nameValid = name === '' || SCREAMING_SNAKE_REGEX.test(name)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    setIsSubmitting(true)

    try {
      const input: CreateSecretInput = {
        name,
        secret_type: secretType as CreateSecretInput['secret_type'],
        scope,
        description: description || undefined,
        rotation_interval_days: rotationDays ? parseInt(rotationDays, 10) : null,
        value,
      }

      const result = await createSecret(input)

      if (!result.success) {
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors)
        }
        if (result.error) {
          setError(result.error)
        }
        return
      }

      router.push('/admin/secrets')
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
          href="/admin/secrets"
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          &larr; Zurück zur Secret-Verwaltung
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900 mt-2">Neues Secret anlegen</h1>
        <p className="text-gray-500 mt-1">
          Erstellen Sie ein neues Secret für Ihre Holding. Der Wert wird sicher im Vault gespeichert.
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
            onChange={(e) => setName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
            placeholder="REONIC_API_KEY"
            required
            className={`w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              !nameValid ? 'border-red-300 bg-red-50' : 'border-gray-300'
            }`}
            aria-label="Secret-Name in SCREAMING_SNAKE_CASE"
          />
          {!nameValid && (
            <p className="mt-1 text-xs text-red-600">
              Name muss SCREAMING_SNAKE_CASE sein (z.B. REONIC_API_KEY)
            </p>
          )}
          {fieldErrors['name'] && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors['name'].join(', ')}</p>
          )}
        </div>

        {/* Secret Type */}
        <div>
          <label htmlFor="secret_type" className="block text-sm font-medium text-gray-700 mb-1">
            Secret-Typ <span className="text-red-500">*</span>
          </label>
          <select
            id="secret_type"
            value={secretType}
            onChange={(e) => setSecretType(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Secret-Typ auswählen"
          >
            <option value="">Typ auswählen...</option>
            {SECRET_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {fieldErrors['secret_type'] && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors['secret_type'].join(', ')}</p>
          )}
        </div>

        {/* Scope */}
        <div>
          <label htmlFor="scope" className="block text-sm font-medium text-gray-700 mb-1">
            Scope <span className="text-red-500">*</span>
          </label>
          <input
            id="scope"
            type="text"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            placeholder="global"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Secret-Scope"
          />
          <p className="mt-1 text-xs text-gray-500">
            z.B. &quot;global&quot;, &quot;production&quot;, &quot;staging&quot; oder ein spezifischer Unternehmensname
          </p>
          {fieldErrors['scope'] && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors['scope'].join(', ')}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Beschreibung
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Wofuer wird dieses Secret verwendet?"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Beschreibung des Secrets"
          />
          {fieldErrors['description'] && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors['description'].join(', ')}</p>
          )}
        </div>

        {/* Rotation Interval */}
        <div>
          <label htmlFor="rotation_days" className="block text-sm font-medium text-gray-700 mb-1">
            Rotationsintervall (Tage)
          </label>
          <input
            id="rotation_days"
            type="number"
            value={rotationDays}
            onChange={(e) => setRotationDays(e.target.value)}
            min={1}
            max={365}
            placeholder="90"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Rotationsintervall in Tagen"
          />
          <p className="mt-1 text-xs text-gray-500">
            Leer lassen, wenn keine automatische Rotationserinnerung gewünscht ist.
          </p>
          {fieldErrors['rotation_interval_days'] && (
            <p className="mt-1 text-xs text-red-600">
              {fieldErrors['rotation_interval_days'].join(', ')}
            </p>
          )}
        </div>

        {/* Secret Value */}
        <div>
          <label htmlFor="value" className="block text-sm font-medium text-gray-700 mb-1">
            Secret-Wert <span className="text-red-500">*</span>
          </label>
          <input
            id="value"
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
            autoComplete="new-password"
            placeholder="Geheimer Wert eingeben..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Geheimer Wert"
          />
          <p className="mt-1 text-xs text-gray-500">
            Der Wert wird sicher im Vault gespeichert und kann nach dem Speichern nicht mehr angezeigt werden.
          </p>
          {fieldErrors['value'] && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors['value'].join(', ')}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
          <button
            type="submit"
            disabled={isSubmitting || !nameValid}
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
              'Secret speichern'
            )}
          </button>
          <Link
            href="/admin/secrets"
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Abbrechen
          </Link>
        </div>
      </form>
    </div>
  )
}
