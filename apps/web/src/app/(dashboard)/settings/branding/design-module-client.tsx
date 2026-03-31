'use client'

import { useState, useCallback, useRef, type DragEvent, type ChangeEvent } from 'react'
import {
  type ExtendedBrandTokens,
  type BrandTokens,
  defaultExtendedTokens,
} from '@enura/types'
import {
  saveExtendedTokens,
  uploadCustomCSS,
  deleteCustomCSS,
  type CompanyDesignData,
} from './actions'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DesignModuleClientProps {
  initialData: CompanyDesignData
  hasHoldingAccess: boolean
  supabaseUrl: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TABS = [
  { id: 'markenfarben', label: 'Markenfarben' },
  { id: 'erweitert', label: 'Erweiterte Designwerte' },
  { id: 'css', label: 'Benutzerdefiniertes CSS' },
  { id: 'vorschau', label: 'Vorschau' },
] as const

type TabId = (typeof TABS)[number]['id']

const CORE_TOKEN_LABELS: ReadonlyArray<{
  key: keyof BrandTokens
  label: string
  description: string
  isColor: boolean
}> = [
  { key: 'primary', label: 'Primaerfarbe', description: 'Hauptaktionsfarbe fuer Buttons und aktive Elemente', isColor: true },
  { key: 'secondary', label: 'Sekundaerfarbe', description: 'Texte und Ueberschriften', isColor: true },
  { key: 'accent', label: 'Akzentfarbe', description: 'Hervorhebungen und Badges', isColor: true },
  { key: 'background', label: 'Hintergrundfarbe', description: 'Seitenhintergrund', isColor: true },
  { key: 'surface', label: 'Oberflaechenfarbe', description: 'Karten- und Panel-Hintergrund', isColor: true },
  { key: 'textPrimary', label: 'Primaerer Text', description: 'Haupttextfarbe', isColor: true },
  { key: 'textSecondary', label: 'Sekundaerer Text', description: 'Gedaempfte Textfarbe', isColor: true },
  { key: 'font', label: 'Schriftart', description: 'Schriftfamilie', isColor: false },
  { key: 'radius', label: 'Eckenradius', description: 'Basis-Eckenradius fuer alle Elemente', isColor: false },
]

type ExtendedTokenConfig = {
  key: keyof ExtendedBrandTokens
  label: string
  type: 'text' | 'slider' | 'dropdown'
  min?: number
  max?: number
  step?: number
  unit?: string
  options?: ReadonlyArray<{ value: string; label: string }>
}

const EXTENDED_TOKEN_CONFIGS: ReadonlyArray<ExtendedTokenConfig> = [
  { key: 'shadowSm', label: 'Schatten (klein)', type: 'text' },
  { key: 'shadowMd', label: 'Schatten (mittel)', type: 'text' },
  { key: 'shadowLg', label: 'Schatten (gross)', type: 'text' },
  { key: 'spacingBase', label: 'Abstand Basis', type: 'slider', min: 2, max: 8, step: 1, unit: 'px' },
  { key: 'fontSizeBase', label: 'Schriftgroesse Basis', type: 'slider', min: 14, max: 20, step: 1, unit: 'px' },
  {
    key: 'fontWeightNormal', label: 'Schriftstärke (normal)', type: 'dropdown',
    options: [
      { value: '300', label: '300 (Leicht)' },
      { value: '400', label: '400 (Normal)' },
      { value: '500', label: '500 (Mittel)' },
    ],
  },
  {
    key: 'fontWeightSemibold', label: 'Schriftstärke (halbfett)', type: 'dropdown',
    options: [
      { value: '500', label: '500 (Mittel)' },
      { value: '600', label: '600 (Halbfett)' },
      { value: '700', label: '700 (Fett)' },
    ],
  },
  { key: 'letterSpacing', label: 'Zeichenabstand', type: 'slider', min: -0.05, max: 0.1, step: 0.005, unit: 'em' },
  { key: 'lineHeight', label: 'Zeilenhoehe', type: 'slider', min: 1.2, max: 2.0, step: 0.05, unit: '' },
  { key: 'borderWidth', label: 'Rahmenbreite', type: 'slider', min: 0, max: 3, step: 0.5, unit: 'px' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DesignModuleClient({
  initialData,
  hasHoldingAccess,
  supabaseUrl,
}: DesignModuleClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>('markenfarben')
  const [data, setData] = useState(initialData)

  return (
    <div>
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex gap-4" aria-label="Design-Module Tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
                  : 'border-transparent text-[var(--brand-text-secondary)] hover:border-gray-300 hover:text-[var(--brand-text-primary)]'
              }`}
              aria-selected={activeTab === tab.id}
              role="tab"
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Panels */}
      {activeTab === 'markenfarben' && (
        <MarkenfarbenTab
          companyTokens={data.companyBranding.tokens}
          holdingTokens={data.holdingBranding.tokens}
          hasHoldingAccess={hasHoldingAccess}
        />
      )}
      {activeTab === 'erweitert' && (
        <ErweitertTab
          companyExtended={data.companyBranding.extendedTokens}
          holdingExtended={data.holdingBranding.extendedTokens}
          onSaved={(tokens) =>
            setData((prev) => ({
              ...prev,
              companyBranding: {
                ...prev.companyBranding,
                extendedTokens: tokens,
              },
            }))
          }
        />
      )}
      {activeTab === 'css' && (
        <CustomCSSTab
          customCSSPath={data.companyBranding.customCSSPath}
          supabaseUrl={supabaseUrl}
          onUpdated={(path) =>
            setData((prev) => ({
              ...prev,
              companyBranding: { ...prev.companyBranding, customCSSPath: path },
            }))
          }
        />
      )}
      {activeTab === 'vorschau' && (
        <VorschauTab
          companyTokens={data.companyBranding.tokens}
          extendedTokens={data.companyBranding.extendedTokens}
          customCSSPath={data.companyBranding.customCSSPath}
          supabaseUrl={supabaseUrl}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab 1: Markenfarben (read-only)
// ---------------------------------------------------------------------------

function MarkenfarbenTab({
  companyTokens,
  holdingTokens,
  hasHoldingAccess,
}: {
  companyTokens: BrandTokens
  holdingTokens: BrandTokens
  hasHoldingAccess: boolean
}) {
  return (
    <div className="space-y-6">
      <div className="bg-[var(--brand-surface)] rounded-[var(--brand-radius)] p-6 border border-gray-200">
        <h2 className="text-lg font-medium text-[var(--brand-text-primary)] mb-2">
          Markenfarben und Grundwerte
        </h2>
        <p className="text-sm text-[var(--brand-text-secondary)] mb-6">
          Diese Werte werden von der Holding-Konfiguration vererbt. Aenderungen koennen nur
          ueber den Holding-Administrator vorgenommen werden.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CORE_TOKEN_LABELS.map((token) => {
            const companyVal = companyTokens[token.key]
            const holdingVal = holdingTokens[token.key]
            const isOverridden = companyVal !== holdingVal

            return (
              <div
                key={token.key}
                className="rounded-[var(--brand-radius)] border border-gray-200 bg-[var(--brand-background)] p-4"
              >
                <div className="flex items-start gap-3">
                  {token.isColor ? (
                    <div
                      className="h-10 w-10 flex-shrink-0 rounded-[var(--brand-radius)] border border-gray-300"
                      style={{ backgroundColor: String(companyVal) }}
                    />
                  ) : (
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[var(--brand-radius)] border border-gray-300 bg-gray-100">
                      <span className="text-xs text-[var(--brand-text-secondary)]">Aa</span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--brand-text-primary)]">
                      {token.label}
                    </p>
                    <p className="text-xs text-[var(--brand-text-secondary)] mt-0.5">
                      {token.description}
                    </p>
                    <p className="text-xs font-mono text-[var(--brand-text-secondary)] mt-1">
                      {String(companyVal)}
                    </p>
                    {isOverridden && (
                      <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                        Ueberschrieben (Holding: {String(holdingVal)})
                      </span>
                    )}
                    {!isOverridden && (
                      <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        Von Holding geerbt
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-[var(--brand-surface)] rounded-[var(--brand-radius)] p-4 border border-gray-200">
        {hasHoldingAccess ? (
          <p className="text-sm text-[var(--brand-text-secondary)]">
            <a
              href="/admin/branding"
              className="text-[var(--brand-primary)] underline hover:no-underline"
            >
              Zum Holding-Brand-Editor
            </a>{' '}
            um die Grundwerte zu bearbeiten.
          </p>
        ) : (
          <p className="text-sm text-[var(--brand-text-secondary)]">
            Kontaktieren Sie Ihren Holding-Administrator, um Aenderungen an den
            Markenfarben vorzunehmen.
          </p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab 2: Erweiterte Designwerte (editable)
// ---------------------------------------------------------------------------

function ErweitertTab({
  companyExtended,
  holdingExtended,
  onSaved,
}: {
  companyExtended: Partial<ExtendedBrandTokens> | null
  holdingExtended: Partial<ExtendedBrandTokens>
  onSaved: (tokens: Partial<ExtendedBrandTokens>) => void
}) {
  const merged: ExtendedBrandTokens = { ...defaultExtendedTokens, ...holdingExtended }
  const [overrides, setOverrides] = useState<Partial<ExtendedBrandTokens>>(
    companyExtended ?? {},
  )
  const [enabledKeys, setEnabledKeys] = useState<Set<keyof ExtendedBrandTokens>>(
    new Set(
      companyExtended ? (Object.keys(companyExtended) as Array<keyof ExtendedBrandTokens>) : [],
    ),
  )
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const toggleKey = useCallback(
    (key: keyof ExtendedBrandTokens) => {
      setEnabledKeys((prev) => {
        const next = new Set(prev)
        if (next.has(key)) {
          next.delete(key)
          setOverrides((o) => {
            const copy = { ...o }
            delete copy[key]
            return copy
          })
        } else {
          next.add(key)
          setOverrides((o) => ({
            ...o,
            [key]: merged[key],
          }))
        }
        return next
      })
    },
    [merged],
  )

  const updateValue = useCallback(
    (key: keyof ExtendedBrandTokens, value: string) => {
      setOverrides((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  const handleSave = async () => {
    setSaving(true)
    setFeedback(null)
    const result = await saveExtendedTokens(overrides)
    setSaving(false)
    if (result.error) {
      setFeedback(result.error)
    } else {
      setFeedback('Erweiterte Designwerte erfolgreich gespeichert.')
      onSaved(overrides)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-[var(--brand-surface)] rounded-[var(--brand-radius)] p-6 border border-gray-200">
        <h2 className="text-lg font-medium text-[var(--brand-text-primary)] mb-2">
          Erweiterte Designwerte
        </h2>
        <p className="text-sm text-[var(--brand-text-secondary)] mb-6">
          Aktivieren Sie den Schalter, um den Holding-Standardwert mit einem
          firmenspezifischen Wert zu ueberschreiben.
        </p>

        <div className="space-y-4">
          {EXTENDED_TOKEN_CONFIGS.map((config) => {
            const isEnabled = enabledKeys.has(config.key)
            const holdingValue = String(merged[config.key])
            const currentValue = isEnabled
              ? String(overrides[config.key] ?? holdingValue)
              : holdingValue

            return (
              <div
                key={config.key}
                className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-[var(--brand-radius)] border border-gray-200 bg-[var(--brand-background)] p-4"
              >
                {/* Label + holding value */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--brand-text-primary)]">
                    {config.label}
                  </p>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">
                    Holding: {holdingValue}
                  </p>
                </div>

                {/* Toggle */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={isEnabled}
                  aria-label={`${config.label} ueberschreiben`}
                  onClick={() => toggleKey(config.key)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    isEnabled ? 'bg-[var(--brand-primary)]' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                      isEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>

                {/* Value input */}
                <div className="w-full sm:w-56 flex-shrink-0">
                  {config.type === 'text' && (
                    <input
                      type="text"
                      value={currentValue}
                      disabled={!isEnabled}
                      onChange={(e) => updateValue(config.key, e.target.value)}
                      className={`w-full rounded-[var(--brand-radius)] border border-gray-300 px-3 py-1.5 text-sm font-mono ${
                        isEnabled
                          ? 'bg-white text-[var(--brand-text-primary)]'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                      aria-label={config.label}
                    />
                  )}
                  {config.type === 'slider' && (
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={config.min}
                        max={config.max}
                        step={config.step}
                        value={parseFloat(currentValue)}
                        disabled={!isEnabled}
                        onChange={(e) =>
                          updateValue(
                            config.key,
                            `${e.target.value}${config.unit ?? ''}`,
                          )
                        }
                        className="flex-1"
                        aria-label={config.label}
                      />
                      <span
                        className={`text-xs font-mono w-16 text-right ${
                          isEnabled ? 'text-[var(--brand-text-primary)]' : 'text-gray-400'
                        }`}
                      >
                        {currentValue}
                      </span>
                    </div>
                  )}
                  {config.type === 'dropdown' && config.options && (
                    <select
                      value={currentValue}
                      disabled={!isEnabled}
                      onChange={(e) => updateValue(config.key, e.target.value)}
                      className={`w-full rounded-[var(--brand-radius)] border border-gray-300 px-3 py-1.5 text-sm ${
                        isEnabled
                          ? 'bg-white text-[var(--brand-text-primary)]'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                      aria-label={config.label}
                    >
                      {config.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Save button + feedback */}
        <div className="mt-6 flex items-center gap-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-[var(--brand-radius)] bg-[var(--brand-primary)] px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            aria-label="Erweiterte Designwerte speichern"
          >
            {saving ? 'Speichern...' : 'Speichern'}
          </button>
          {feedback && (
            <p
              className={`text-sm ${
                feedback.includes('erfolgreich')
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}
            >
              {feedback}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab 3: Benutzerdefiniertes CSS
// ---------------------------------------------------------------------------

function CustomCSSTab({
  customCSSPath,
  supabaseUrl,
  onUpdated,
}: {
  customCSSPath: string | null
  supabaseUrl: string
  onUpdated: (path: string | null) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [cssPreview, setCssPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fullUrl = customCSSPath
    ? `${supabaseUrl}/storage/v1/object/public/corporate-assets/${customCSSPath}`
    : null

  const handleFile = useCallback(async (file: File) => {
    setFeedback(null)
    setErrors([])

    if (!file.name.endsWith('.css')) {
      setErrors(['Nur .css-Dateien sind erlaubt.'])
      return
    }

    if (file.size > 100 * 1024) {
      setErrors(['CSS-Datei ueberschreitet die maximale Groesse von 100 KB.'])
      return
    }

    // Preview file contents
    const text = await file.text()
    setCssPreview(text)

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    const result = await uploadCustomCSS(formData)
    setUploading(false)

    if (result.error) {
      setFeedback(result.error)
      if (result.errors) setErrors(result.errors)
    } else {
      setFeedback('CSS erfolgreich hochgeladen.')
      // Refresh page to apply new CSS
      onUpdated(customCSSPath) // The actual path changed server-side
      window.location.reload()
    }
  }, [customCSSPath, onUpdated])

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const handleFileInput = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }

    setDeleting(true)
    setFeedback(null)
    const result = await deleteCustomCSS()
    setDeleting(false)
    setConfirmDelete(false)

    if (result.error) {
      setFeedback(result.error)
    } else {
      setFeedback('CSS erfolgreich entfernt.')
      setCssPreview(null)
      onUpdated(null)
      window.location.reload()
    }
  }

  return (
    <div className="space-y-6">
      {/* Current CSS preview */}
      <div className="bg-[var(--brand-surface)] rounded-[var(--brand-radius)] p-6 border border-gray-200">
        <h2 className="text-lg font-medium text-[var(--brand-text-primary)] mb-2">
          Aktuelles benutzerdefiniertes CSS
        </h2>

        {fullUrl ? (
          <div className="mt-3">
            <p className="text-sm text-[var(--brand-text-secondary)] mb-2">
              Aktive Datei:{' '}
              <code className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                {customCSSPath}
              </code>
            </p>
            <textarea
              readOnly
              value={cssPreview ?? '(Vorschau wird beim naechsten Upload angezeigt)'}
              className="w-full h-[300px] max-h-[300px] overflow-auto rounded-[var(--brand-radius)] border border-gray-300 bg-gray-50 p-3 text-xs font-mono text-[var(--brand-text-primary)] resize-none"
              aria-label="CSS-Vorschau"
            />
          </div>
        ) : (
          <p className="text-sm text-[var(--brand-text-secondary)]">
            Kein benutzerdefiniertes CSS aktiv.
          </p>
        )}
      </div>

      {/* Upload zone */}
      <div className="bg-[var(--brand-surface)] rounded-[var(--brand-radius)] p-6 border border-gray-200">
        <h2 className="text-lg font-medium text-[var(--brand-text-primary)] mb-4">
          CSS hochladen
        </h2>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              fileInputRef.current?.click()
            }
          }}
          aria-label="CSS-Datei per Drag-and-Drop oder Klick hochladen"
          className={`flex flex-col items-center justify-center rounded-[var(--brand-radius)] border-2 border-dashed p-8 cursor-pointer transition-colors ${
            dragOver
              ? 'border-[var(--brand-primary)] bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <svg
            className="h-10 w-10 text-gray-400 mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 0 1-.88-7.903A5 5 0 1 1 15.9 6h.1a5 5 0 0 1 1 9.9M15 13l-3-3m0 0-3 3m3-3v12"
            />
          </svg>
          <p className="text-sm text-[var(--brand-text-secondary)]">
            CSS-Datei hierher ziehen oder <span className="text-[var(--brand-primary)] underline">klicken</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">Nur .css-Dateien, max. 100 KB</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".css"
            onChange={handleFileInput}
            className="hidden"
            aria-hidden="true"
          />
        </div>

        {/* Validation errors */}
        {errors.length > 0 && (
          <div className="mt-4 rounded-[var(--brand-radius)] border border-red-200 bg-red-50 p-3">
            <p className="text-sm font-medium text-red-800 mb-1">Validierungsfehler:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {errors.map((err, i) => (
                <li key={i} className="text-sm text-red-700">
                  {err}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Feedback */}
        {feedback && errors.length === 0 && (
          <p
            className={`mt-4 text-sm ${
              feedback.includes('erfolgreich') ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {feedback}
          </p>
        )}

        {uploading && (
          <p className="mt-4 text-sm text-[var(--brand-text-secondary)]">
            Wird hochgeladen...
          </p>
        )}

        {/* Action buttons */}
        <div className="mt-4 flex gap-3">
          {customCSSPath && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className={`rounded-[var(--brand-radius)] px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50 ${
                confirmDelete
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-red-100 text-red-700 hover:bg-red-200'
              }`}
              aria-label="Benutzerdefiniertes CSS entfernen"
            >
              {deleting
                ? 'Wird entfernt...'
                : confirmDelete
                  ? 'Wirklich entfernen?'
                  : 'CSS entfernen'}
            </button>
          )}
        </div>

        {/* Help text */}
        <p className="mt-4 text-xs text-gray-400">
          Erlaubt: CSS-Klassen und -Regeln fuer Ihr Corporate Design. Nicht erlaubt: @import,
          JavaScript, externe URLs.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab 4: Vorschau
// ---------------------------------------------------------------------------

function VorschauTab({
  companyTokens,
  extendedTokens,
  customCSSPath,
  supabaseUrl,
}: {
  companyTokens: BrandTokens
  extendedTokens: Partial<ExtendedBrandTokens> | null
  customCSSPath: string | null
  supabaseUrl: string
}) {
  const merged = { ...defaultExtendedTokens, ...extendedTokens }

  const previewStyle: Record<string, string> = {
    '--preview-primary': companyTokens.primary,
    '--preview-secondary': companyTokens.secondary,
    '--preview-accent': companyTokens.accent,
    '--preview-background': companyTokens.background,
    '--preview-surface': companyTokens.surface,
    '--preview-text-primary': companyTokens.textPrimary,
    '--preview-text-secondary': companyTokens.textSecondary,
    '--preview-font': companyTokens.font,
    '--preview-radius': companyTokens.radius,
    '--preview-shadow-sm': merged.shadowSm,
    '--preview-shadow-md': merged.shadowMd,
    '--preview-line-height': merged.lineHeight,
    '--preview-font-size-base': merged.fontSizeBase,
    '--preview-border-width': merged.borderWidth,
    '--preview-letter-spacing': merged.letterSpacing,
  }

  return (
    <div className="space-y-6">
      <div className="bg-[var(--brand-surface)] rounded-[var(--brand-radius)] p-6 border border-gray-200">
        <h2 className="text-lg font-medium text-[var(--brand-text-primary)] mb-2">
          Live-Vorschau
        </h2>
        <p className="text-sm text-[var(--brand-text-secondary)] mb-6">
          Zeigt eine Vorschau mit den aktuellen Markenfarben, erweiterten Designwerten und
          benutzerdefiniertem CSS.
        </p>

        {/* Preview area */}
        <div
          className="rounded-lg border border-gray-200 p-6"
          style={{
            ...previewStyle,
            backgroundColor: companyTokens.background,
            fontFamily: companyTokens.font,
            fontSize: merged.fontSizeBase,
            lineHeight: merged.lineHeight,
            letterSpacing: merged.letterSpacing,
          } as React.CSSProperties}
        >
          {/* Heading */}
          <h3
            className="text-xl font-semibold mb-3"
            style={{ color: companyTokens.secondary }}
          >
            Beispiel-Ueberschrift
          </h3>

          {/* Body text */}
          <p
            className="mb-4"
            style={{
              color: companyTokens.textPrimary,
              borderWidth: merged.borderWidth,
            }}
          >
            Dies ist ein Beispieltext, der zeigt, wie der Inhalt mit den aktuellen
            Designwerten aussieht. Die Schriftgroesse, der Zeilenabstand und die Farben
            spiegeln die konfigurierten Werte wider.
          </p>

          {/* Card */}
          <div
            className="p-4 mb-4"
            style={{
              backgroundColor: companyTokens.surface,
              borderRadius: companyTokens.radius,
              boxShadow: merged.shadowMd,
              border: `${merged.borderWidth} solid #e5e7eb`,
            }}
          >
            <h4
              className="text-sm font-medium mb-1"
              style={{ color: companyTokens.textPrimary }}
            >
              Beispielkarte
            </h4>
            <p
              className="text-xs"
              style={{ color: companyTokens.textSecondary }}
            >
              Eine typische Karte mit Schatten, Rahmen und Oberflaechenfarbe.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex flex-wrap gap-3 mb-4">
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-white"
              style={{
                backgroundColor: companyTokens.primary,
                borderRadius: companyTokens.radius,
                boxShadow: merged.shadowSm,
              }}
            >
              Primaer-Button
            </button>
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium"
              style={{
                backgroundColor: companyTokens.background,
                color: companyTokens.textPrimary,
                borderRadius: companyTokens.radius,
                border: `${merged.borderWidth} solid #d1d5db`,
              }}
            >
              Sekundaer-Button
            </button>
            <span
              className="inline-flex items-center px-3 py-1 text-xs font-medium text-white"
              style={{
                backgroundColor: companyTokens.accent,
                borderRadius: '9999px',
              }}
            >
              Akzent-Badge
            </span>
          </div>

          {/* Input field */}
          <div className="mb-4">
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: companyTokens.textPrimary }}
            >
              Beispiel-Eingabefeld
            </label>
            <input
              type="text"
              placeholder="Platzhaltertext..."
              readOnly
              className="w-full px-3 py-2 text-sm"
              style={{
                borderRadius: companyTokens.radius,
                border: `${merged.borderWidth} solid #d1d5db`,
                backgroundColor: companyTokens.background,
                color: companyTokens.textPrimary,
              }}
              aria-label="Beispiel-Eingabefeld"
            />
          </div>

          {/* Custom CSS indicator */}
          {customCSSPath && (
            <p className="text-xs text-gray-400 mt-4">
              Benutzerdefiniertes CSS aktiv: Die tatsaechliche Darstellung kann von
              dieser Vorschau abweichen.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
