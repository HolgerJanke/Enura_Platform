'use client'

import { useState, useTransition, useRef } from 'react'
import { saveBranding, uploadLogo, type BrandingData } from './actions'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type BrandingEditorClientProps = {
  initialBranding: BrandingData
}

// ---------------------------------------------------------------------------
// Font options
// ---------------------------------------------------------------------------

const FONT_OPTIONS: ReadonlyArray<{ value: string; label: string; url: string | null }> = [
  { value: 'Inter', label: 'Inter', url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap' },
  { value: 'Roboto', label: 'Roboto', url: 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap' },
  { value: 'Open Sans', label: 'Open Sans', url: 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap' },
  { value: 'Poppins', label: 'Poppins', url: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap' },
  { value: 'Source Sans 3', label: 'Source Sans 3', url: 'https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&display=swap' },
  { value: 'DM Sans', label: 'DM Sans', url: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap' },
  { value: 'Lato', label: 'Lato', url: 'https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap' },
]

// ---------------------------------------------------------------------------
// Color picker row
// ---------------------------------------------------------------------------

function ColorField({
  label,
  value,
  onChange,
  id,
}: {
  label: string
  value: string
  onChange: (val: string) => void
  id: string
}) {
  return (
    <div className="flex items-center gap-4">
      <label htmlFor={id} className="w-40 text-sm font-medium text-gray-700 shrink-0">
        {label}
      </label>
      <div className="flex items-center gap-2 flex-1">
        <input
          type="color"
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 cursor-pointer rounded border border-gray-300"
          aria-label={label}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          pattern="^#[0-9A-Fa-f]{6}$"
          aria-label={`${label} Hex-Wert`}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BrandingEditorClient({ initialBranding }: BrandingEditorClientProps) {
  const [branding, setBranding] = useState<BrandingData>(initialBranding)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function update<K extends keyof BrandingData>(key: K, value: BrandingData[K]) {
    setBranding((prev) => ({ ...prev, [key]: value }))
    setHasChanges(true)
    setFeedback(null)
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('logo', file)

    startTransition(async () => {
      const result = await uploadLogo(formData)
      if (result.url) {
        update('logoUrl', result.url)
        setFeedback({ type: 'success', message: 'Logo erfolgreich hochgeladen.' })
      } else {
        setFeedback({ type: 'error', message: result.error ?? 'Logo-Upload fehlgeschlagen.' })
      }
    })
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveBranding(branding)
      if (result.success) {
        setFeedback({ type: 'success', message: 'Branding erfolgreich gespeichert.' })
        setHasChanges(false)
      } else {
        setFeedback({ type: 'error', message: result.error ?? 'Unbekannter Fehler.' })
      }
    })
  }

  // Build CSS variables for live preview
  const previewVars: Record<string, string> = {
    '--preview-primary': branding.primary,
    '--preview-secondary': branding.secondary,
    '--preview-accent': branding.accent,
    '--preview-background': branding.background,
    '--preview-surface': branding.surface,
    '--preview-text-primary': branding.textPrimary,
    '--preview-text-secondary': branding.textSecondary,
    '--preview-font': branding.font,
    '--preview-radius': branding.radius,
  }

  const selectedFont = FONT_OPTIONS.find((f) => f.value === branding.font)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Editor panel */}
      <div>
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

        {/* Logo upload */}
        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Logo</h3>
          <div className="flex items-center gap-4">
            {branding.logoUrl ? (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={branding.logoUrl} alt="Holding-Logo" className="max-h-full max-w-full object-contain" />
              </div>
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50">
                <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 002.25-2.25V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                </svg>
              </div>
            )}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={handleLogoUpload}
                className="hidden"
                aria-label="Logo-Datei auswaehlen"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isPending}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                aria-label="Logo hochladen"
              >
                Logo hochladen
              </button>
              <p className="mt-1 text-xs text-gray-500">PNG, JPEG, SVG oder WebP. Max. 2 MB.</p>
            </div>
          </div>
        </div>

        {/* Colors */}
        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Farben</h3>
          <div className="space-y-4">
            <ColorField id="primary" label="Primaerfarbe" value={branding.primary} onChange={(v) => update('primary', v)} />
            <ColorField id="secondary" label="Sekundaerfarbe" value={branding.secondary} onChange={(v) => update('secondary', v)} />
            <ColorField id="accent" label="Akzentfarbe" value={branding.accent} onChange={(v) => update('accent', v)} />
            <ColorField id="background" label="Hintergrund" value={branding.background} onChange={(v) => update('background', v)} />
            <ColorField id="surface" label="Oberflaeche" value={branding.surface} onChange={(v) => update('surface', v)} />
            <ColorField id="textPrimary" label="Text (primaer)" value={branding.textPrimary} onChange={(v) => update('textPrimary', v)} />
            <ColorField id="textSecondary" label="Text (sekundaer)" value={branding.textSecondary} onChange={(v) => update('textSecondary', v)} />
          </div>
        </div>

        {/* Font & radius */}
        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Typografie & Form</h3>

          {/* Font */}
          <div className="mb-4">
            <label htmlFor="font" className="block text-sm font-medium text-gray-700 mb-1">
              Schriftart
            </label>
            <select
              id="font"
              value={branding.font}
              onChange={(e) => {
                const selected = FONT_OPTIONS.find((f) => f.value === e.target.value)
                update('font', e.target.value)
                update('fontUrl', selected?.url ?? null)
              }}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              aria-label="Schriftart auswaehlen"
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {/* Radius slider */}
          <div className="mb-4">
            <label htmlFor="radius" className="block text-sm font-medium text-gray-700 mb-1">
              Eckenradius: {branding.radius}
            </label>
            <input
              id="radius"
              type="range"
              min={0}
              max={24}
              value={parseInt(branding.radius, 10) || 8}
              onChange={(e) => update('radius', `${e.target.value}px`)}
              className="w-full accent-blue-600"
              aria-label="Eckenradius"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0px</span>
              <span>12px</span>
              <span>24px</span>
            </div>
          </div>

          {/* Dark mode toggle */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-700">Dark Mode</span>
              <p className="text-xs text-gray-500">Erlaubt Benutzern den Wechsel zum dunklen Modus</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={branding.darkModeEnabled}
              aria-label="Dark Mode aktivieren/deaktivieren"
              onClick={() => update('darkModeEnabled', !branding.darkModeEnabled)}
              className={`
                relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                ${branding.darkModeEnabled ? 'bg-blue-600' : 'bg-gray-300'}
              `}
            >
              <span
                className={`
                  inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform
                  ${branding.darkModeEnabled ? 'translate-x-6' : 'translate-x-1'}
                `}
              />
            </button>
          </div>
        </div>

        {/* Save */}
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || !hasChanges}
          className={`
            w-full rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            ${isPending || !hasChanges ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}
          `}
          aria-label="Branding speichern"
        >
          {isPending ? 'Speichern...' : 'Branding speichern'}
        </button>
      </div>

      {/* Live preview panel */}
      <div className="lg:sticky lg:top-6 h-fit">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Vorschau</h3>

          <div
            className="rounded-lg overflow-hidden border border-gray-200"
            style={previewVars as React.CSSProperties}
          >
            {/* Preview header */}
            <div
              className="px-4 py-3 flex items-center gap-3"
              style={{ backgroundColor: 'var(--preview-primary)' }}
            >
              {branding.logoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={branding.logoUrl} alt="Logo-Vorschau" className="h-6 w-6 object-contain rounded" />
              ) : (
                <div className="h-6 w-6 rounded bg-white/20" />
              )}
              <span
                className="text-sm font-semibold text-white"
                style={{ fontFamily: `var(--preview-font), sans-serif` }}
              >
                Holding Dashboard
              </span>
            </div>

            {/* Preview body */}
            <div style={{ backgroundColor: 'var(--preview-background)', padding: '16px' }}>
              <div
                className="mb-3"
                style={{
                  backgroundColor: 'var(--preview-surface)',
                  borderRadius: 'var(--preview-radius)',
                  padding: '12px',
                }}
              >
                <p
                  className="text-sm font-medium"
                  style={{ color: 'var(--preview-text-primary)', fontFamily: `var(--preview-font), sans-serif` }}
                >
                  Uebersicht
                </p>
                <p
                  className="text-xs mt-1"
                  style={{ color: 'var(--preview-text-secondary)', fontFamily: `var(--preview-font), sans-serif` }}
                >
                  Konsolidierte Daten aller Tochtergesellschaften
                </p>
              </div>

              {/* KPI cards preview */}
              <div className="grid grid-cols-3 gap-2">
                {['12 Leads', 'CHF 340k', '85%'].map((value, i) => (
                  <div
                    key={i}
                    style={{
                      backgroundColor: 'var(--preview-surface)',
                      borderRadius: 'var(--preview-radius)',
                      padding: '8px',
                    }}
                  >
                    <p className="text-xs" style={{ color: 'var(--preview-text-secondary)' }}>
                      KPI {i + 1}
                    </p>
                    <p className="text-sm font-semibold" style={{ color: 'var(--preview-text-primary)' }}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Button preview */}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="text-xs text-white px-3 py-1.5 font-medium"
                  style={{
                    backgroundColor: 'var(--preview-primary)',
                    borderRadius: 'var(--preview-radius)',
                  }}
                >
                  Primaer
                </button>
                <button
                  type="button"
                  className="text-xs text-white px-3 py-1.5 font-medium"
                  style={{
                    backgroundColor: 'var(--preview-accent)',
                    borderRadius: 'var(--preview-radius)',
                  }}
                >
                  Akzent
                </button>
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs text-gray-400">
            Echtzeit-Vorschau. Aenderungen werden erst nach dem Speichern wirksam.
          </p>
        </div>
      </div>
    </div>
  )
}
