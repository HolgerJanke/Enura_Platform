'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  initiateEnrolmentAction,
  verifyEnrolmentAction,
  type EnrolmentResult,
} from './actions'

type Step = 1 | 2

export default function EnrolTwoFactorPage() {
  const [step, setStep] = useState<Step>(1)
  const [enrolmentData, setEnrolmentData] = useState<EnrolmentResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [code, setCode] = useState('')
  const codeInputRef = useRef<HTMLInputElement>(null)

  // Initiate enrolment on mount
  useEffect(() => {
    let cancelled = false
    async function initiate() {
      const result = await initiateEnrolmentAction()
      if (cancelled) return
      setEnrolmentData(result)
      setLoading(false)
      if (result.error) {
        setError(result.error)
      }
    }
    void initiate()
    return () => {
      cancelled = true
    }
  }, [])

  const copySecret = useCallback(async () => {
    if (!enrolmentData?.secret) return
    try {
      await navigator.clipboard.writeText(enrolmentData.secret)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API may not be available
    }
  }, [enrolmentData?.secret])

  const handleCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6)
      setCode(value)
    },
    []
  )

  const handleVerify = useCallback(async () => {
    if (!enrolmentData?.factorId || code.length !== 6) return
    setError(null)
    setVerifying(true)
    const result = await verifyEnrolmentAction(enrolmentData.factorId, code)
    if (result.error) {
      setError(result.error)
      setCode('')
      codeInputRef.current?.focus()
    }
    setVerifying(false)
  }, [enrolmentData?.factorId, code])

  const handleAdvanceToStep2 = useCallback(() => {
    setStep(2)
    // Focus the code input after transition
    setTimeout(() => codeInputRef.current?.focus(), 100)
  }, [])

  if (loading) {
    return (
      <div className="bg-brand-surface rounded-brand p-8 shadow-sm border border-gray-200">
        <div className="flex items-center justify-center py-12">
          <svg
            className="animate-spin h-8 w-8 text-brand-primary"
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
          <span className="ml-3 text-sm text-brand-text-secondary">
            2FA wird eingerichtet...
          </span>
        </div>
      </div>
    )
  }

  if (enrolmentData?.error) {
    return (
      <div className="bg-brand-surface rounded-brand p-8 shadow-sm border border-gray-200">
        <div
          className="rounded-brand border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {enrolmentData.error}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-brand-surface rounded-brand p-8 shadow-sm border border-gray-200">
      <h2 className="text-xl font-semibold text-brand-text-primary mb-2 text-center">
        Zwei-Faktor-Authentifizierung einrichten
      </h2>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-3 mb-6">
        <div
          className={`flex items-center gap-1.5 text-sm ${
            step === 1
              ? 'text-brand-primary font-medium'
              : 'text-brand-text-secondary'
          }`}
        >
          <span
            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
              step === 1
                ? 'bg-brand-primary text-white'
                : 'bg-green-500 text-white'
            }`}
          >
            {step > 1 ? (
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              '1'
            )}
          </span>
          QR-Code scannen
        </div>
        <div className="w-8 h-px bg-gray-300" />
        <div
          className={`flex items-center gap-1.5 text-sm ${
            step === 2
              ? 'text-brand-primary font-medium'
              : 'text-brand-text-secondary'
          }`}
        >
          <span
            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
              step === 2
                ? 'bg-brand-primary text-white'
                : 'bg-gray-200 text-brand-text-secondary'
            }`}
          >
            2
          </span>
          Verifizieren
        </div>
      </div>

      {step === 1 && enrolmentData?.qrCode && (
        <>
          <p className="text-sm text-brand-text-secondary mb-4 text-center">
            Scannen Sie den QR-Code mit einer Authenticator-App (z.B. Google
            Authenticator, Authy oder Microsoft Authenticator).
          </p>

          {/* QR Code from Supabase */}
          <div className="flex justify-center mb-6">
            <div
              className="bg-white p-4 rounded-brand border border-gray-200"
              dangerouslySetInnerHTML={{ __html: enrolmentData.qrCode }}
              aria-label="QR-Code für Authenticator-App"
            />
          </div>

          {/* Secret key display */}
          <div className="mb-6">
            <p className="text-sm text-brand-text-secondary mb-2 text-center">
              Oder geben Sie diesen Schlüssel manuell ein:
            </p>
            <div className="flex items-center justify-center gap-2">
              <code className="bg-gray-100 px-3 py-2 rounded-brand text-sm font-mono text-brand-text-primary tracking-wider select-all">
                {enrolmentData.secret}
              </code>
              <button
                type="button"
                onClick={copySecret}
                aria-label="Schlüssel kopieren"
                className="shrink-0 rounded-brand border border-gray-300 bg-brand-background px-3 py-2 text-sm text-brand-text-secondary hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-primary transition-colors"
              >
                {copied ? 'Kopiert' : 'Kopieren'}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAdvanceToStep2}
            className="w-full rounded-brand bg-brand-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 transition-opacity"
          >
            Weiter
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <p className="text-sm text-brand-text-secondary mb-6 text-center">
            Geben Sie den 6-stelligen Code aus Ihrer Authenticator-App ein.
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
                htmlFor="code"
                className="block text-sm font-medium text-brand-text-primary mb-1.5"
              >
                Verifizierungscode
              </label>
              <input
                ref={codeInputRef}
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={handleCodeChange}
                aria-label="6-stelliger Verifizierungscode"
                className="w-full rounded-brand border border-gray-300 px-3 py-2.5 text-sm text-brand-text-primary bg-brand-background placeholder:text-brand-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent text-center tracking-[0.5em] font-mono text-lg"
                placeholder="000000"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep(1)
                  setError(null)
                  setCode('')
                }}
                className="flex-1 rounded-brand border border-gray-300 bg-brand-background px-4 py-2.5 text-sm font-medium text-brand-text-primary hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 transition-colors"
              >
                Zurück
              </button>
              <button
                type="button"
                onClick={handleVerify}
                disabled={verifying || code.length !== 6}
                aria-label="Verifizieren"
                className="flex-1 rounded-brand bg-brand-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
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
          </div>
        </>
      )}

      <p className="mt-6 text-xs text-brand-text-secondary text-center">
        Sie benoetigen eine Authenticator-App auf Ihrem Smartphone. Empfohlene
        Apps: Google Authenticator, Authy oder Microsoft Authenticator.
      </p>
    </div>
  )
}
