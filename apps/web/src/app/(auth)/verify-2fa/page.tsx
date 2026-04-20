
'use client'

import { useState, useCallback, useRef } from 'react'
import { verify2faAction } from './actions'

export default function VerifyTwoFactorPage() {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6)
      setCode(value)
    },
    []
  )

  const handleSubmit = useCallback(
    async (submittedCode?: string) => {
      const codeToVerify = submittedCode ?? code
      if (codeToVerify.length !== 6) return
      setError(null)
      setVerifying(true)
      const result = await verify2faAction(codeToVerify)
      if (result.error) {
        setError(result.error)
        setCode('')
        inputRef.current?.focus()
      }
      setVerifying(false)
    },
    [code]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        void handleSubmit()
      }
    },
    [handleSubmit]
  )

  // Auto-submit when 6 digits entered
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6)
      setCode(value)
      if (value.length === 6) {
        void handleSubmit(value)
      }
    },
    [handleSubmit]
  )

  return (
    <div className="bg-brand-surface rounded-brand p-8 shadow-sm border border-gray-200">
      <h2 className="text-xl font-semibold text-brand-text-primary mb-2 text-center">
        Zwei-Faktor-Verifizierung
      </h2>
      <p className="text-sm text-brand-text-secondary mb-6 text-center">
        Geben Sie den 6-stelligen Code aus Ihrer Authenticator-App ein, um sich
        anzumelden.
      </p>

      {error && (
        <div
          className="mb-4 rounded-brand border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="space-y-5">
        <div>
          <label
            htmlFor="totp-code"
            className="block text-sm font-medium text-brand-text-primary mb-1.5"
          >
            Verifizierungscode
          </label>
          <input
            ref={inputRef}
            id="totp-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            value={code}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={verifying}
            aria-label="6-stelliger Verifizierungscode"
            className="w-full rounded-brand border border-gray-300 px-3 py-2.5 text-sm text-brand-text-primary bg-brand-background placeholder:text-brand-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent text-center tracking-[0.5em] font-mono text-lg disabled:opacity-50"
            placeholder="000000"
          />
        </div>

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={verifying || code.length !== 6}
          aria-label="Verifizieren"
          className="w-full rounded-brand bg-brand-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {verifying ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Wird verifiziert...
            </span>
          ) : (
            'Verifizieren'
          )}
        </button>
      </div>

      <p className="mt-4 text-xs text-brand-text-secondary text-center">
        Probleme mit der Anmeldung? Bitte wenden Sie sich an Ihren Administrator.
      </p>
    </div>
  )
}
