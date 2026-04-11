'use client'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  getCompanyBranding,
  saveCompanyBrandingOverrides,
  type BrandingData,
} from '../../../settings/branding/actions'

// ---------------------------------------------------------------------------
// Brand token keys
// ---------------------------------------------------------------------------

const BRAND_KEYS: ReadonlyArray<{
  key: keyof BrandingData
  label: string
  isColor: boolean
}> = [
  { key: 'primary', label: 'Primärfarbe', isColor: true },
  { key: 'secondary', label: 'Sekundärfarbe', isColor: true },
  { key: 'accent', label: 'Akzentfarbe', isColor: true },
  { key: 'background', label: 'Hintergrund', isColor: true },
  { key: 'surface', label: 'Oberfläche', isColor: true },
  { key: 'textPrimary', label: 'Text (primär)', isColor: true },
  { key: 'textSecondary', label: 'Text (sekundär)', isColor: true },
  { key: 'font', label: 'Schriftart', isColor: false },
  { key: 'radius', label: 'Eckenradius', isColor: false },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CompanyBrandingPage() {
  const params = useParams<{ id: string }>()
  const companyId = params.id

  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [loading, setLoading] = useState(true)

  const [companyName, setCompanyName] = useState('')
  const [holdingBranding, setHoldingBranding] = useState<BrandingData | null>(null)
  const [overrides, setOverrides] = useState<Record<string, string | boolean | null>>({})
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    startTransition(async () => {
      const data = await getCompanyBranding(companyId)
      if (data) {
        setCompanyName(data.companyName)
        setHoldingBranding(data.holdingBranding)
        setOverrides(data.companyOverrides as Record<string, string | boolean | null>)
      }
      setLoading(false)
    })
  }, [companyId])

  function toggleOverride(key: string) {
    setOverrides((prev) => {
      const next = { ...prev }
      if (key in next) {
        delete next[key]
      } else {
        // Initialize override with holding value
        if (holdingBranding) {
          next[key] = holdingBranding[key as keyof BrandingData] as string
        }
      }
      return next
    })
    setHasChanges(true)
    setFeedback(null)
  }

  function updateOverride(key: string, value: string) {
    setOverrides((prev) => ({ ...prev, [key]: value }))
    setHasChanges(true)
    setFeedback(null)
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveCompanyBrandingOverrides(companyId, overrides)
      if (result.success) {
        setFeedback({ type: 'success', message: 'Branding-Überschreibungen erfolgreich gespeichert.' })
        setHasChanges(false)
      } else {
        setFeedback({ type: 'error', message: result.error ?? 'Unbekannter Fehler.' })
      }
    })
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <svg className="h-6 w-6 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="ml-2 text-sm text-gray-500">Lade Branding-Daten...</span>
        </div>
      </div>
    )
  }

  if (!holdingBranding) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">Unternehmen nicht gefunden oder kein Zugriff.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link
          href={`/admin/companies/${companyId}`}
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Zurück zur Firma
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">
          Branding: {companyName}
        </h1>
        <p className="text-gray-500 mt-1">
          Überschreiben Sie einzelne Branding-Werte für dieses Unternehmen.
          Nicht überschriebene Werte werden vom Holding-Standard geerbt.
        </p>
      </div>

      {feedback && (
        <div
          className={`mb-6 rounded-lg border p-4 ${
            feedback.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          <p className="text-sm">{feedback.message}</p>
        </div>
      )}

      {/* Side-by-side comparison */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="grid grid-cols-[1fr,200px,200px,80px] gap-0 border-b border-gray-200 bg-gray-50 px-6 py-3">
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Eigenschaft</span>
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Holding-Standard</span>
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Unternehmen</span>
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500 text-center">Aktiv</span>
        </div>

        <div className="divide-y divide-gray-100">
          {BRAND_KEYS.map(({ key, label, isColor }) => {
            const holdingValue = holdingBranding[key] as string
            const isOverridden = key in overrides
            const currentValue = isOverridden ? (overrides[key] as string) : holdingValue

            return (
              <div
                key={key}
                className={`grid grid-cols-[1fr,200px,200px,80px] gap-0 items-center px-6 py-3 ${
                  isOverridden ? 'bg-blue-50/30' : ''
                }`}
              >
                <span className="text-sm font-medium text-gray-900">{label}</span>

                {/* Holding value */}
                <div className="flex items-center gap-2">
                  {isColor && (
                    <div
                      className="h-6 w-6 rounded border border-gray-200"
                      style={{ backgroundColor: holdingValue }}
                    />
                  )}
                  <span className="text-sm text-gray-500 font-mono">{holdingValue}</span>
                </div>

                {/* Company override */}
                <div className="flex items-center gap-2">
                  {isOverridden ? (
                    isColor ? (
                      <>
                        <input
                          type="color"
                          value={currentValue}
                          onChange={(e) => updateOverride(key, e.target.value)}
                          className="h-6 w-6 cursor-pointer rounded border border-gray-300"
                          aria-label={`${label} Unternehmensfarbe`}
                        />
                        <input
                          type="text"
                          value={currentValue}
                          onChange={(e) => updateOverride(key, e.target.value)}
                          className="w-24 rounded border border-gray-300 px-2 py-1 text-xs font-mono focus:border-blue-500 focus:outline-none"
                          aria-label={`${label} Hex-Wert`}
                        />
                      </>
                    ) : (
                      <input
                        type="text"
                        value={currentValue}
                        onChange={(e) => updateOverride(key, e.target.value)}
                        className="w-36 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                        aria-label={`${label} Unternehmenswert`}
                      />
                    )
                  ) : (
                    <span className="text-sm text-gray-400 italic">Geerbt</span>
                  )}
                </div>

                {/* Toggle */}
                <div className="flex justify-center">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isOverridden}
                    aria-label={`${label} überschreiben`}
                    onClick={() => toggleOverride(key)}
                    className={`
                      relative inline-flex h-5 w-9 items-center rounded-full transition-colors
                      ${isOverridden ? 'bg-blue-600' : 'bg-gray-300'}
                    `}
                  >
                    <span
                      className={`
                        inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform
                        ${isOverridden ? 'translate-x-4.5' : 'translate-x-0.5'}
                      `}
                      style={{ transform: isOverridden ? 'translateX(18px)' : 'translateX(2px)' }}
                    />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Save */}
      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || !hasChanges}
          className={`
            rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors
            ${isPending || !hasChanges ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}
          `}
          aria-label="Überschreibungen speichern"
        >
          {isPending ? 'Speichern...' : 'Überschreibungen speichern'}
        </button>
      </div>

      {/* Info */}
      <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h2 className="text-sm font-medium text-blue-900 mb-1">Hinweis</h2>
        <p className="text-sm text-blue-700">
          Nur aktivierte Überschreibungen werden gespeichert. Alle anderen Werte
          werden automatisch vom Holding-Standard geerbt. Beim Deaktivieren einer
          Überschreibung wird der Wert auf den Holding-Standard zurückgesetzt.
        </p>
      </div>
    </div>
  )
}
