'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveConnectorAction, testConnectorAction } from './actions'

type ConnectorData = {
  id: string
  type: string
  status: string
  config: Record<string, unknown> | null
  credentials: Record<string, unknown> | null
  syncIntervalMinutes: number | null
  lastSyncedAt: string | null
}

type Props = {
  type: string
  existingConnector: ConnectorData | null
}

type FieldDef = {
  key: string
  label: string
  type: 'text' | 'password' | 'textarea' | 'toggle' | 'oauth'
  placeholder?: string
  helpText?: string
}

type TestResult = {
  success: boolean
  error?: string
}

const FIELD_DEFINITIONS: Record<string, ReadonlyArray<FieldDef>> = {
  reonic: [
    {
      key: 'clientId',
      label: 'Client-ID',
      type: 'text',
      placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      helpText: 'Ihre Reonic Client-UUID — zu finden in den Reonic Einstellungen unter API.',
    },
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      placeholder: 'Ihr Reonic API-Schlüssel',
      helpText: 'API-Endpunkt wird automatisch verwendet: api.reonic.de/rest/v2',
    },
  ],
  '3cx': [
    { key: 'apiUrl', label: 'API URL', type: 'text', placeholder: 'https://ihre-instanz.3cx.eu/api' },
    { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'Ihr 3CX API-Schlüssel' },
    { key: 'downloadRecordings', label: 'Aufnahmen herunterladen', type: 'toggle', helpText: 'Gesprächsaufnahmen automatisch in den EU-Speicher herunterladen' },
  ],
  bexio: [
    {
      key: 'access_token',
      label: 'Bexio API Token (PAT)',
      type: 'password',
      placeholder: 'eyJhbGciOiJSUzI1NiIs...',
      helpText: 'Persönlicher Access Token aus Bexio (Profil → API Tokens → Token erstellen). Bearer-JWT, der bis zum eingestellten Ablaufdatum gültig ist.',
    },
  ],
  google_calendar: [
    { key: 'serviceAccountKey', label: 'Service Account Key (JSON)', type: 'textarea', placeholder: '{\n  "type": "service_account",\n  "project_id": "...",\n  ...\n}', helpText: 'Fügen Sie den vollständigen JSON-Schlüssel des Google Service Accounts ein' },
    { key: 'calendarEmails', label: 'Kalender E-Mails', type: 'textarea', placeholder: 'mitarbeiter1@firma.ch\nmitarbeiter2@firma.ch', helpText: 'Eine E-Mail-Adresse pro Zeile. Diese Kalender werden synchronisiert.' },
  ],
  leadnotes: [
    { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'Ihr Leadnotes API-Schlüssel' },
  ],
}

const SYNC_INTERVALS = [
  { value: 15, label: 'Alle 15 Minuten' },
  { value: 30, label: 'Alle 30 Minuten' },
  { value: 60, label: 'Jede Stunde' },
] as const

export function ConnectorForm({ type, existingConnector }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const fields = FIELD_DEFINITIONS[type] ?? []

  // Initialize credentials from existing connector
  const initialCredentials: Record<string, unknown> = {}
  if (existingConnector?.credentials) {
    for (const field of fields) {
      if (field.type !== 'oauth') {
        const existingValue = existingConnector.credentials[field.key]
        // For password fields, show masked placeholder
        initialCredentials[field.key] = field.type === 'password' && existingValue
          ? ''  // Don't populate password fields — user re-enters or leaves blank
          : existingValue ?? ''
      }
    }
  }

  const [credentials, setCredentials] = useState<Record<string, unknown>>(initialCredentials)
  const [syncInterval, setSyncInterval] = useState<number>(
    existingConnector?.syncIntervalMinutes ?? 15
  )
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})

  const updateField = useCallback((key: string, value: unknown) => {
    setCredentials((prev) => ({ ...prev, [key]: value }))
    setTestResult(null)
    setSaveSuccess(false)
    setSaveError(null)
  }, [])

  const togglePasswordVisibility = useCallback((key: string) => {
    setShowPasswords((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const handleTest = useCallback(() => {
    setTestResult(null)
    setSaveError(null)
    setSaveSuccess(false)

    startTransition(async () => {
      const result = await testConnectorAction(type, credentials)
      setTestResult({
        success: Boolean(result.success),
        error: result.error,
      })
    })
  }, [type, credentials])

  const handleSave = useCallback(() => {
    setSaveError(null)
    setSaveSuccess(false)

    startTransition(async () => {
      // Merge with existing credentials for password fields left blank
      const mergedCredentials = { ...credentials }
      if (existingConnector?.credentials) {
        for (const field of fields) {
          if (field.type === 'password' && !mergedCredentials[field.key]) {
            // Keep existing credential if user didn't enter a new one
            mergedCredentials[field.key] = existingConnector.credentials[field.key]
          }
        }
      }

      const result = await saveConnectorAction(type, {
        credentials: mergedCredentials,
        config: {},
        syncIntervalMinutes: syncInterval,
      })

      if (result.error) {
        setSaveError(result.error)
      } else {
        setSaveSuccess(true)
        router.refresh()
      }
    })
  }, [type, credentials, syncInterval, existingConnector, fields, router])

  const isOAuthConnected = existingConnector?.credentials?.['oauthEmail'] as string | undefined

  return (
    <div className="bg-brand-surface rounded-brand border border-gray-200 p-6">
      <h2 className="text-lg font-medium text-brand-text-primary mb-4">Zugangsdaten</h2>

      <div className="space-y-5">
        {fields.map((field) => {
          if (field.type === 'oauth') {
            return (
              <div key={field.key}>
                <label className="block text-sm font-medium text-brand-text-primary mb-1.5">
                  {field.label}
                </label>
                {field.helpText && (
                  <p className="text-xs text-brand-text-secondary mb-2">{field.helpText}</p>
                )}
                {isOAuthConnected ? (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 rounded-brand border border-green-200 bg-green-50 px-4 py-2.5">
                      <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                      </svg>
                      <span className="text-sm text-green-700">
                        Verbunden als: <strong>{isOAuthConnected}</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      className="rounded-brand border border-gray-300 bg-brand-background px-3 py-2 text-sm font-medium text-brand-text-secondary hover:bg-gray-50 transition-colors"
                      aria-label="OAuth-Verbindung trennen"
                    >
                      Trennen
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90"
                    style={{ backgroundColor: 'var(--brand-primary)' }}
                    aria-label={`${field.label} verbinden`}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m9.86-2.03a4.5 4.5 0 0 0-1.242-7.244l-4.5-4.5a4.5 4.5 0 0 0-6.364 6.364L5.25 9.879" />
                    </svg>
                    Mit Bexio verbinden
                  </button>
                )}
              </div>
            )
          }

          if (field.type === 'toggle') {
            const isChecked = Boolean(credentials[field.key])
            return (
              <div key={field.key}>
                <div className="flex items-center justify-between">
                  <div>
                    <label
                      htmlFor={`field-${field.key}`}
                      className="block text-sm font-medium text-brand-text-primary"
                    >
                      {field.label}
                    </label>
                    {field.helpText && (
                      <p className="text-xs text-brand-text-secondary mt-0.5">{field.helpText}</p>
                    )}
                  </div>
                  <button
                    id={`field-${field.key}`}
                    type="button"
                    role="switch"
                    aria-checked={isChecked}
                    onClick={() => updateField(field.key, !isChecked)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      isChecked ? '' : 'bg-gray-200'
                    }`}
                    style={isChecked ? { backgroundColor: 'var(--brand-primary)' } : undefined}
                    aria-label={field.label}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
                        isChecked ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )
          }

          if (field.type === 'textarea') {
            return (
              <div key={field.key}>
                <label
                  htmlFor={`field-${field.key}`}
                  className="block text-sm font-medium text-brand-text-primary mb-1.5"
                >
                  {field.label}
                </label>
                {field.helpText && (
                  <p className="text-xs text-brand-text-secondary mb-2">{field.helpText}</p>
                )}
                <textarea
                  id={`field-${field.key}`}
                  value={(credentials[field.key] as string) ?? ''}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  rows={5}
                  className="w-full rounded-brand border border-gray-300 bg-brand-background px-3 py-2 text-sm text-brand-text-primary placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': 'var(--brand-primary)' } as React.CSSProperties}
                />
              </div>
            )
          }

          // text or password
          const isPassword = field.type === 'password'
          const showPw = showPasswords[field.key] ?? false
          const hasExistingValue = existingConnector?.credentials?.[field.key]

          return (
            <div key={field.key}>
              <label
                htmlFor={`field-${field.key}`}
                className="block text-sm font-medium text-brand-text-primary mb-1.5"
              >
                {field.label}
              </label>
              {field.helpText && (
                <p className="text-xs text-brand-text-secondary mb-2">{field.helpText}</p>
              )}
              <div className="relative">
                <input
                  id={`field-${field.key}`}
                  type={isPassword && !showPw ? 'password' : 'text'}
                  value={(credentials[field.key] as string) ?? ''}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  placeholder={
                    isPassword && hasExistingValue
                      ? 'Gespeichert — leer lassen um beizubehalten'
                      : field.placeholder
                  }
                  className="w-full rounded-brand border border-gray-300 bg-brand-background px-3 py-2 text-sm text-brand-text-primary placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 pr-10"
                  style={{ '--tw-ring-color': 'var(--brand-primary)' } as React.CSSProperties}
                  autoComplete={isPassword ? 'off' : undefined}
                />
                {isPassword && (
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility(field.key)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-brand-text-secondary hover:text-brand-text-primary transition-colors"
                    aria-label={showPw ? 'Passwort verbergen' : 'Passwort anzeigen'}
                  >
                    {showPw ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {/* Sync interval */}
        {type !== 'bexio' && (
          <div>
            <label
              htmlFor="sync-interval"
              className="block text-sm font-medium text-brand-text-primary mb-1.5"
            >
              Synchronisierungsintervall
            </label>
            <select
              id="sync-interval"
              value={syncInterval}
              onChange={(e) => {
                setSyncInterval(Number(e.target.value))
                setSaveSuccess(false)
                setSaveError(null)
              }}
              className="w-full rounded-brand border border-gray-300 bg-brand-background px-3 py-2 text-sm text-brand-text-primary focus:border-transparent focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': 'var(--brand-primary)' } as React.CSSProperties}
            >
              {SYNC_INTERVALS.map((interval) => (
                <option key={interval.value} value={interval.value}>
                  {interval.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* For Bexio (OAuth), also show interval */}
        {type === 'bexio' && (
          <div>
            <label
              htmlFor="sync-interval"
              className="block text-sm font-medium text-brand-text-primary mb-1.5"
            >
              Synchronisierungsintervall
            </label>
            <select
              id="sync-interval"
              value={syncInterval}
              onChange={(e) => {
                setSyncInterval(Number(e.target.value))
                setSaveSuccess(false)
                setSaveError(null)
              }}
              className="w-full rounded-brand border border-gray-300 bg-brand-background px-3 py-2 text-sm text-brand-text-primary focus:border-transparent focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': 'var(--brand-primary)' } as React.CSSProperties}
            >
              {SYNC_INTERVALS.map((interval) => (
                <option key={interval.value} value={interval.value}>
                  {interval.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Test result */}
      {testResult && (
        <div
          className={`mt-4 flex items-center gap-2 rounded-brand border px-4 py-3 text-sm ${
            testResult.success
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
          role="alert"
        >
          {testResult.success ? (
            <svg className="h-4 w-4 flex-shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          ) : (
            <svg className="h-4 w-4 flex-shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          )}
          <span>
            {testResult.success
              ? 'Verbindung erfolgreich hergestellt.'
              : testResult.error ?? 'Verbindungstest fehlgeschlagen.'}
          </span>
        </div>
      )}

      {/* Save result */}
      {saveError && (
        <div
          className="mt-4 flex items-center gap-2 rounded-brand border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <span>{saveError}</span>
        </div>
      )}
      {saveSuccess && (
        <div
          className="mt-4 flex items-center gap-2 rounded-brand border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
          role="alert"
        >
          <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <span>Konfiguration gespeichert.</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={handleTest}
          disabled={isPending}
          className="rounded-brand border border-gray-300 bg-brand-background px-4 py-2 text-sm font-medium text-brand-text-primary hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {isPending && !saveSuccess ? 'Wird getestet...' : 'Verbindung testen'}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
        