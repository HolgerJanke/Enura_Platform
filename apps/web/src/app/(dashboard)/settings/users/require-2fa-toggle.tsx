'use client'

import { useState, useTransition } from 'react'
import { toggleRequire2faAction } from './actions'

interface Props {
  initialValue: boolean
}

export function Require2faToggle({ initialValue }: Props) {
  const [enabled, setEnabled] = useState(initialValue)
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    const newValue = !enabled
    setEnabled(newValue)
    startTransition(async () => {
      const result = await toggleRequire2faAction(newValue)
      if (!result.success) {
        setEnabled(!newValue) // revert on error
      }
    })
  }

  return (
    <div className={`mb-6 rounded-lg border p-4 flex items-center justify-between ${
      enabled ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'
    }`}>
      <div>
        <p className="text-sm font-medium text-gray-900">Zwei-Faktor-Authentifizierung (2FA)</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {enabled
            ? 'Alle Benutzer muessen TOTP einrichten, bevor sie auf das Dashboard zugreifen koennen.'
            : '2FA ist optional. Benutzer koennen TOTP freiwillig einrichten.'}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={isPending}
        onClick={handleToggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
          enabled ? 'bg-blue-600' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}
