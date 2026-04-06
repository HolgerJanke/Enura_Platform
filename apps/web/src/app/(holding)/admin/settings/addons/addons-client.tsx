'use client'

import { useState, useTransition } from 'react'
import { toggleHoldingFinanzplanung, toggleCompanyFinanzplanung } from './actions'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HoldingFlag {
  id: string
  name: string
  finanzplanung_enabled: boolean
}

interface CompanyFlag {
  id: string
  name: string
  slug: string
  finanzplanung_enabled: boolean
}

// ---------------------------------------------------------------------------
// Enura Admin View: toggle per holding
// ---------------------------------------------------------------------------

export function EnuraAddonsClient({ holdings }: { holdings: HoldingFlag[] }) {
  const [flags, setFlags] = useState(holdings)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  function handleToggle(holdingId: string, enabled: boolean) {
    const holdingName = flags.find((h) => h.id === holdingId)?.name ?? 'Holding'
    startTransition(async () => {
      setFeedback(null)
      const result = await toggleHoldingFinanzplanung(holdingId, enabled)
      if (result.success) {
        setFlags((prev) =>
          prev.map((h) => (h.id === holdingId ? { ...h, finanzplanung_enabled: enabled } : h)),
        )
        setFeedback({ type: 'success', message: `${holdingName}: Finanzplanung ${enabled ? 'aktiviert' : 'deaktiviert'}.` })
      } else {
        setFeedback({ type: 'error', message: result.error ?? 'Fehler beim Speichern.' })
      }
    })
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Finanzplanung-Modul</h2>
        <p className="text-sm text-gray-500 mb-6">
          Rechnungsverarbeitung, Validierungs-Workflow und Cash-out-Planung.
          Aktivieren Sie das Modul pro Holding.
        </p>

        <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
          {flags.map((holding) => (
            <div key={holding.id} className="flex items-center justify-between px-4 py-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">{holding.name}</p>
                <p className="text-xs text-gray-500">
                  {holding.finanzplanung_enabled ? 'Lizenziert' : 'Nicht lizenziert'}
                </p>
              </div>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleToggle(holding.id, !holding.finanzplanung_enabled)}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                  ${holding.finanzplanung_enabled ? 'bg-green-500' : 'bg-gray-300'}
                  ${isPending ? 'opacity-50' : ''}
                `}
                role="switch"
                aria-checked={holding.finanzplanung_enabled}
                aria-label={`Finanzplanung fuer ${holding.name}`}
              >
                <span
                  className={`
                    inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
                    ${holding.finanzplanung_enabled ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>
          ))}
        </div>

        {feedback && (
          <div className={`mt-4 rounded-lg p-3 text-sm ${
            feedback.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {feedback.message}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Holding Admin View: toggle per company
// ---------------------------------------------------------------------------

export function HoldingAddonsClient({
  holdingEnabled,
  companies,
}: {
  holdingEnabled: boolean
  companies: CompanyFlag[]
}) {
  const [flags, setFlags] = useState(companies)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  function handleToggle(companyId: string, enabled: boolean) {
    const companyName = flags.find((c) => c.id === companyId)?.name ?? 'Unternehmen'
    startTransition(async () => {
      setFeedback(null)
      const result = await toggleCompanyFinanzplanung(companyId, enabled)
      if (result.success) {
        setFlags((prev) =>
          prev.map((c) => (c.id === companyId ? { ...c, finanzplanung_enabled: enabled } : c)),
        )
        setFeedback({ type: 'success', message: `${companyName}: Finanzplanung ${enabled ? 'aktiviert' : 'deaktiviert'}.` })
      } else {
        setFeedback({ type: 'error', message: result.error ?? 'Fehler beim Speichern.' })
      }
    })
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Finanzplanung-Modul</h2>
            <p className="text-sm text-gray-500 mt-1">
              Rechnungsverarbeitung, Validierungs-Workflow und Cash-out-Planung.
            </p>
          </div>
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
              holdingEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {holdingEnabled ? 'Lizenziert' : 'Nicht lizenziert'}
          </span>
        </div>

        {!holdingEnabled ? (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
            <p className="text-sm text-amber-800">
              Das Finanzplanung-Modul ist fuer Ihre Holding noch nicht aktiviert.
              Wenden Sie sich an Ihren Enura-Ansprechpartner, um das Modul zu lizenzieren.
            </p>
          </div>
        ) : (
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">
              Aktivierung pro Unternehmen
            </h3>
            <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
              {flags.map((company) => (
                <div key={company.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{company.name}</p>
                    <p className="text-xs text-gray-500 font-mono">{company.slug}</p>
                  </div>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleToggle(company.id, !company.finanzplanung_enabled)}
                    className={`
                      relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                      ${company.finanzplanung_enabled ? 'bg-green-500' : 'bg-gray-300'}
                      ${isPending ? 'opacity-50' : ''}
                    `}
                    role="switch"
                    aria-checked={company.finanzplanung_enabled}
                    aria-label={`Finanzplanung fuer ${company.name}`}
                  >
                    <span
                      className={`
                        inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
                        ${company.finanzplanung_enabled ? 'translate-x-6' : 'translate-x-1'}
                      `}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {feedback && (
          <div className={`mt-4 rounded-lg p-3 text-sm ${
            feedback.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {feedback.message}
          </div>
        )}
      </div>
    </div>
  )
}
