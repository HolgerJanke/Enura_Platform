'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { requestDeploymentAction } from './actions'

interface DeployFormProps {
  processId: string
  holdingId: string
  currentVersion: string
  companies: Array<{ id: string; name: string; slug: string }>
  currentCompanyId?: string
}

export function DeployForm({
  processId,
  holdingId,
  currentVersion,
  companies,
  currentCompanyId,
}: DeployFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedCompanyId, setSelectedCompanyId] = useState(
    currentCompanyId ?? '',
  )
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!selectedCompanyId) {
      setError('Bitte wählen Sie ein Zielunternehmen aus.')
      return
    }

    startTransition(async () => {
      const result = await requestDeploymentAction({
        processId,
        holdingId,
        companyId: selectedCompanyId,
        version: currentVersion,
        reason: reason.trim() || undefined,
      })

      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Target company */}
      <div>
        <label
          htmlFor="target-company"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Zielunternehmen
        </label>
        <select
          id="target-company"
          value={selectedCompanyId}
          onChange={(e) => setSelectedCompanyId(e.target.value)}
          className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[var(--brand-primary,#1A56DB)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary,#1A56DB)]"
          aria-label="Zielunternehmen auswählen"
          disabled={isPending}
        >
          <option value="">Unternehmen auswählen...</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.slug})
            </option>
          ))}
        </select>
      </div>

      {/* Version info */}
      <div>
        <p className="text-sm text-gray-500">
          Version <span className="font-mono font-medium">v{currentVersion}</span> wird
          zur Freigabe eingereicht.
        </p>
      </div>

      {/* Reason */}
      <div>
        <label
          htmlFor="deploy-reason"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Grund / Anmerkung (optional)
        </label>
        <textarea
          id="deploy-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[var(--brand-primary,#1A56DB)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary,#1A56DB)]"
          placeholder="Beschreiben Sie den Grund für dieses Deployment..."
          disabled={isPending}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <p className="text-sm text-green-700">
            Deployment-Anfrage wurde erfolgreich erstellt. Ein zweiter Admin
            muss die Freigabe erteilen.
          </p>
        </div>
      )}

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending || success}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-primary,#1A56DB)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Deployment beantragen"
        >
          {isPending ? (
            <>
              <svg
                className="h-4 w-4 animate-spin"
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
              Wird eingereicht...
            </>
          ) : (
            'Deployment beantragen'
          )}
        </button>
      </div>
    </form>
  )
}
