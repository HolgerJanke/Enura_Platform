'use client'

import { useState, useTransition } from 'react'
import { toggleHoldingFinanzplanung } from './actions'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HoldingFlag {
  id: string
  name: string
  finanzplanung_enabled: boolean
}

// ---------------------------------------------------------------------------
// Enura Admin View: toggle per holding (finding C5 — moved from
// `(holding)/admin/settings/addons/addons-client.tsx`)
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
                aria-label={`Finanzplanung für ${holding.name}`}
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
