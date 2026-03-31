'use client'

import { useState, useTransition, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { checkSlugAvailability, saveWizardStep, completeWizard } from './actions'

type WizardStep = {
  number: number
  label: string
}

type WizardData = {
  // Step 1: Holding Details
  holdingName: string
  holdingSlug: string
  slugAvailable: boolean | null
  slugChecking: boolean

  // Step 2: Branding
  primaryColor: string
  secondaryColor: string
  accentColor: string
  backgroundColor: string
  surfaceColor: string
  textPrimary: string
  textSecondary: string
  fontFamily: string
  fontUrl: string
  borderRadius: string
  logoFile: File | null

  // Step 3: Language & Region
  language: string
  locale: string
  currency: string
  dateFormat: string

  // Step 4: First Company
  companyName: string
  companySlug: string

  // Step 5: Admin Invitation
  adminEmail: string
  adminFirstName: string
  adminLastName: string
}

const DEFAULT_DATA: WizardData = {
  holdingName: '',
  holdingSlug: '',
  slugAvailable: null,
  slugChecking: false,

  primaryColor: '#1A56DB',
  secondaryColor: '#1A1A1A',
  accentColor: '#F3A917',
  backgroundColor: '#FFFFFF',
  surfaceColor: '#F9FAFB',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  fontFamily: 'Inter',
  fontUrl: 'https://fonts.googleapis.com/css2?family=Inter',
  borderRadius: '8px',
  logoFile: null,

  language: 'de',
  locale: 'de-CH',
  currency: 'CHF',
  dateFormat: 'dd.MM.yyyy',

  companyName: '',
  companySlug: '',

  adminEmail: '',
  adminFirstName: '',
  adminLastName: '',
}

type Props = {
  steps: WizardStep[]
}

export function WizardClient({ steps }: Props) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [data, setData] = useState<WizardData>(DEFAULT_DATA)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())

  const updateField = useCallback(<K extends keyof WizardData>(field: K, value: WizardData[K]) => {
    setData((prev) => ({ ...prev, [field]: value }))
  }, [])

  // Slug auto-generation from name
  useEffect(() => {
    if (data.holdingName && !completedSteps.has(1)) {
      const slug = data.holdingName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
      updateField('holdingSlug', slug)
    }
  }, [data.holdingName, completedSteps, updateField])

  // Company slug auto-generation
  useEffect(() => {
    if (data.companyName) {
      const slug = data.companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
      updateField('companySlug', slug)
    }
  }, [data.companyName, updateField])

  // Live slug uniqueness check
  useEffect(() => {
    if (!data.holdingSlug || data.holdingSlug.length < 3) {
      updateField('slugAvailable', null)
      return
    }

    updateField('slugChecking', true)
    const timeout = setTimeout(async () => {
      const result = await checkSlugAvailability(data.holdingSlug)
      updateField('slugAvailable', result.available)
      updateField('slugChecking', false)
    }, 500)

    return () => clearTimeout(timeout)
  }, [data.holdingSlug, updateField])

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1:
        return data.holdingName.length >= 2 && data.holdingSlug.length >= 3 && data.slugAvailable === true
      case 2:
        return data.primaryColor.length > 0
      case 3:
        return data.language.length > 0 && data.locale.length > 0
      case 4:
        return data.companyName.length >= 2 && data.companySlug.length >= 3
      case 5:
        return data.adminEmail.includes('@') && data.adminFirstName.length >= 1 && data.adminLastName.length >= 1
      case 6:
        return true
      default:
        return false
    }
  }

  const handleNext = () => {
    if (!canProceed()) return
    setError(null)

    startTransition(async () => {
      const stepData = getStepData(currentStep)
      const result = await saveWizardStep(currentStep, stepData)
      if (!result.success) {
        setError(result.error ?? 'Unbekannter Fehler')
        return
      }
      setCompletedSteps((prev) => new Set([...prev, currentStep]))
      if (currentStep < 6) {
        setCurrentStep(currentStep + 1)
      }
    })
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
      setError(null)
    }
  }

  const handleComplete = () => {
    setError(null)
    startTransition(async () => {
      const result = await completeWizard({
        holdingName: data.holdingName,
        holdingSlug: data.holdingSlug,
        branding: {
          primary: data.primaryColor,
          secondary: data.secondaryColor,
          accent: data.accentColor,
          background: data.backgroundColor,
          surface: data.surfaceColor,
          textPrimary: data.textPrimary,
          textSecondary: data.textSecondary,
          font: data.fontFamily,
          fontUrl: data.fontUrl,
          radius: data.borderRadius,
        },
        language: data.language,
        locale: data.locale,
        currency: data.currency,
        dateFormat: data.dateFormat,
        companyName: data.companyName,
        companySlug: data.companySlug,
        adminEmail: data.adminEmail,
        adminFirstName: data.adminFirstName,
        adminLastName: data.adminLastName,
      })

      if (!result.success) {
        setError(result.error ?? 'Holding konnte nicht erstellt werden')
        return
      }

      router.push(`/platform/holdings/${result.holdingId}`)
    })
  }

  const getStepData = (step: number): Record<string, string> => {
    switch (step) {
      case 1:
        return { holdingName: data.holdingName, holdingSlug: data.holdingSlug }
      case 2:
        return {
          primaryColor: data.primaryColor,
          secondaryColor: data.secondaryColor,
          accentColor: data.accentColor,
          backgroundColor: data.backgroundColor,
          surfaceColor: data.surfaceColor,
          textPrimary: data.textPrimary,
          textSecondary: data.textSecondary,
          fontFamily: data.fontFamily,
          fontUrl: data.fontUrl,
          borderRadius: data.borderRadius,
        }
      case 3:
        return { language: data.language, locale: data.locale, currency: data.currency, dateFormat: data.dateFormat }
      case 4:
        return { companyName: data.companyName, companySlug: data.companySlug }
      case 5:
        return { adminEmail: data.adminEmail, adminFirstName: data.adminFirstName, adminLastName: data.adminLastName }
      default:
        return {}
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Step indicator */}
      <nav className="mb-8" aria-label="Fortschritt">
        <ol className="flex items-center gap-2">
          {steps.map((step, idx) => {
            const isCompleted = completedSteps.has(step.number)
            const isCurrent = step.number === currentStep
            return (
              <li key={step.number} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (isCompleted || step.number < currentStep) {
                      setCurrentStep(step.number)
                    }
                  }}
                  disabled={!isCompleted && step.number > currentStep}
                  className={`
                    flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors
                    ${
                      isCurrent
                        ? 'bg-blue-600 text-white'
                        : isCompleted
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-200 text-gray-500'
                    }
                  `}
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-label={`Schritt ${step.number}: ${step.label}`}
                >
                  {isCompleted ? (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step.number
                  )}
                </button>
                <span className={`hidden text-xs font-medium sm:inline ${isCurrent ? 'text-blue-600' : 'text-gray-500'}`}>
                  {step.label}
                </span>
                {idx < steps.length - 1 && (
                  <div className={`h-px w-4 sm:w-8 ${isCompleted ? 'bg-green-400' : 'bg-gray-300'}`} />
                )}
              </li>
            )
          })}
        </ol>
      </nav>

      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}

      {/* Step content */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        {currentStep === 1 && (
          <StepHoldingDetails data={data} updateField={updateField} />
        )}
        {currentStep === 2 && (
          <StepBranding data={data} updateField={updateField} />
        )}
        {currentStep === 3 && (
          <StepLanguageRegion data={data} updateField={updateField} />
        )}
        {currentStep === 4 && (
          <StepFirstCompany data={data} updateField={updateField} />
        )}
        {currentStep === 5 && (
          <StepAdminInvitation data={data} updateField={updateField} />
        )}
        {currentStep === 6 && (
          <StepConfirmation data={data} />
        )}
      </div>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={handleBack}
          disabled={currentStep === 1 || isPending}
          className="rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          aria-label="Zurueck"
        >
          Zurueck
        </button>

        {currentStep < 6 ? (
          <button
            type="button"
            onClick={handleNext}
            disabled={!canProceed() || isPending}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            aria-label="Weiter"
          >
            {isPending ? 'Speichern...' : 'Weiter'}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleComplete}
            disabled={isPending}
            className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
            aria-label="Holding erstellen"
          >
            {isPending ? 'Erstellen...' : 'Holding erstellen'}
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 1: Holding Details
// ---------------------------------------------------------------------------
function StepHoldingDetails({
  data,
  updateField,
}: {
  data: WizardData
  updateField: <K extends keyof WizardData>(field: K, value: WizardData[K]) => void
}) {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-gray-900">Holding-Details</h2>

      <div>
        <label htmlFor="holdingName" className="block text-sm font-medium text-gray-700">
          Holding-Name *
        </label>
        <input
          id="holdingName"
          type="text"
          value={data.holdingName}
          onChange={(e) => updateField('holdingName', e.target.value)}
          placeholder="z.B. Alpen Energie Gruppe"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="holdingSlug" className="block text-sm font-medium text-gray-700">
          Slug (URL-Pfad) *
        </label>
        <div className="relative mt-1">
          <input
            id="holdingSlug"
            type="text"
            value={data.holdingSlug}
            onChange={(e) => updateField('holdingSlug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            placeholder="alpen-energie"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {/* Availability indicator */}
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            {data.slugChecking && (
              <span className="text-xs text-gray-400">Pruefen...</span>
            )}
            {!data.slugChecking && data.slugAvailable === true && (
              <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {!data.slugChecking && data.slugAvailable === false && (
              <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
        </div>
        {!data.slugChecking && data.slugAvailable === false && (
          <p className="mt-1 text-xs text-red-600">Dieser Slug ist bereits vergeben.</p>
        )}
        {!data.slugChecking && data.slugAvailable === true && (
          <p className="mt-1 text-xs text-green-600">Slug ist verfuegbar.</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 2: Branding
// ---------------------------------------------------------------------------
function StepBranding({
  data,
  updateField,
}: {
  data: WizardData
  updateField: <K extends keyof WizardData>(field: K, value: WizardData[K]) => void
}) {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-gray-900">Branding</h2>

      <div className="grid grid-cols-2 gap-4">
        <ColorPicker label="Primaerfarbe" value={data.primaryColor} onChange={(v) => updateField('primaryColor', v)} />
        <ColorPicker label="Sekundaerfarbe" value={data.secondaryColor} onChange={(v) => updateField('secondaryColor', v)} />
        <ColorPicker label="Akzentfarbe" value={data.accentColor} onChange={(v) => updateField('accentColor', v)} />
        <ColorPicker label="Hintergrund" value={data.backgroundColor} onChange={(v) => updateField('backgroundColor', v)} />
        <ColorPicker label="Oberflaeche" value={data.surfaceColor} onChange={(v) => updateField('surfaceColor', v)} />
        <ColorPicker label="Text Primaer" value={data.textPrimary} onChange={(v) => updateField('textPrimary', v)} />
        <ColorPicker label="Text Sekundaer" value={data.textSecondary} onChange={(v) => updateField('textSecondary', v)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="fontFamily" className="block text-sm font-medium text-gray-700">Schriftart</label>
          <input
            id="fontFamily"
            type="text"
            value={data.fontFamily}
            onChange={(e) => updateField('fontFamily', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="borderRadius" className="block text-sm font-medium text-gray-700">Eckenradius</label>
          <input
            id="borderRadius"
            type="text"
            value={data.borderRadius}
            onChange={(e) => updateField('borderRadius', e.target.value)}
            placeholder="8px"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label htmlFor="fontUrl" className="block text-sm font-medium text-gray-700">Schriftart-URL (Google Fonts)</label>
        <input
          id="fontUrl"
          type="url"
          value={data.fontUrl}
          onChange={(e) => updateField('fontUrl', e.target.value)}
          placeholder="https://fonts.googleapis.com/css2?family=..."
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="logoUpload" className="block text-sm font-medium text-gray-700">Logo hochladen</label>
        <input
          id="logoUpload"
          type="file"
          accept="image/*"
          onChange={(e) => updateField('logoFile', e.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>

      {/* Live preview */}
      <div className="mt-4 rounded-lg border border-gray-200 p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-500">Vorschau</p>
        <div
          className="rounded-lg p-6"
          style={{ backgroundColor: data.backgroundColor, fontFamily: data.fontFamily }}
        >
          <div
            className="mb-3 inline-block rounded-md px-4 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: data.primaryColor, borderRadius: data.borderRadius }}
          >
            Primaer-Button
          </div>
          <div
            className="rounded-lg p-4"
            style={{ backgroundColor: data.surfaceColor, borderRadius: data.borderRadius }}
          >
            <p style={{ color: data.textPrimary }} className="text-sm font-medium">Beispiel-Ueberschrift</p>
            <p style={{ color: data.textSecondary }} className="mt-1 text-xs">Sekundaerer Hilfetext</p>
            <span
              className="mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: data.accentColor }}
            >
              Akzent-Badge
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-8 cursor-pointer rounded border border-gray-300"
          aria-label={label}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 3: Language & Region
// ---------------------------------------------------------------------------
function StepLanguageRegion({
  data,
  updateField,
}: {
  data: WizardData
  updateField: <K extends keyof WizardData>(field: K, value: WizardData[K]) => void
}) {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-gray-900">Sprache & Region</h2>

      <div>
        <label htmlFor="language" className="block text-sm font-medium text-gray-700">Sprache</label>
        <select
          id="language"
          value={data.language}
          onChange={(e) => updateField('language', e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="de">Deutsch</option>
          <option value="fr">Franzoesisch</option>
          <option value="it">Italienisch</option>
          <option value="en">Englisch</option>
        </select>
      </div>

      <div>
        <label htmlFor="locale" className="block text-sm font-medium text-gray-700">Gebietsschema</label>
        <select
          id="locale"
          value={data.locale}
          onChange={(e) => updateField('locale', e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="de-CH">Deutsch (Schweiz)</option>
          <option value="de-DE">Deutsch (Deutschland)</option>
          <option value="de-AT">Deutsch (Oesterreich)</option>
          <option value="fr-CH">Franzoesisch (Schweiz)</option>
          <option value="it-CH">Italienisch (Schweiz)</option>
          <option value="en-GB">Englisch (UK)</option>
        </select>
      </div>

      <div>
        <label htmlFor="currency" className="block text-sm font-medium text-gray-700">Waehrung</label>
        <select
          id="currency"
          value={data.currency}
          onChange={(e) => updateField('currency', e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="CHF">CHF (Schweizer Franken)</option>
          <option value="EUR">EUR (Euro)</option>
          <option value="GBP">GBP (Britisches Pfund)</option>
          <option value="USD">USD (US-Dollar)</option>
        </select>
      </div>

      <div>
        <label htmlFor="dateFormat" className="block text-sm font-medium text-gray-700">Datumsformat</label>
        <select
          id="dateFormat"
          value={data.dateFormat}
          onChange={(e) => updateField('dateFormat', e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="dd.MM.yyyy">dd.MM.yyyy (31.12.2026)</option>
          <option value="dd/MM/yyyy">dd/MM/yyyy (31/12/2026)</option>
          <option value="yyyy-MM-dd">yyyy-MM-dd (2026-12-31)</option>
          <option value="MM/dd/yyyy">MM/dd/yyyy (12/31/2026)</option>
        </select>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 4: First Company
// ---------------------------------------------------------------------------
function StepFirstCompany({
  data,
  updateField,
}: {
  data: WizardData
  updateField: <K extends keyof WizardData>(field: K, value: WizardData[K]) => void
}) {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-gray-900">Erstes Unternehmen</h2>
      <p className="text-sm text-gray-500">
        Erstellen Sie das erste Unternehmen innerhalb dieses Holdings.
      </p>

      <div>
        <label htmlFor="companyName" className="block text-sm font-medium text-gray-700">
          Unternehmensname *
        </label>
        <input
          id="companyName"
          type="text"
          value={data.companyName}
          onChange={(e) => updateField('companyName', e.target.value)}
          placeholder="z.B. Alpen Energie GmbH"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="companySlug" className="block text-sm font-medium text-gray-700">
          Slug *
        </label>
        <input
          id="companySlug"
          type="text"
          value={data.companySlug}
          onChange={(e) => updateField('companySlug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
          placeholder="alpen-energie"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 5: Admin Invitation
// ---------------------------------------------------------------------------
function StepAdminInvitation({
  data,
  updateField,
}: {
  data: WizardData
  updateField: <K extends keyof WizardData>(field: K, value: WizardData[K]) => void
}) {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-gray-900">Admin-Einladung</h2>
      <p className="text-sm text-gray-500">
        Laden Sie den ersten Holding-Administrator ein. Dieser Benutzer erhaelt eine E-Mail mit einem Einladungslink.
      </p>

      <div>
        <label htmlFor="adminEmail" className="block text-sm font-medium text-gray-700">
          E-Mail-Adresse *
        </label>
        <input
          id="adminEmail"
          type="email"
          value={data.adminEmail}
          onChange={(e) => updateField('adminEmail', e.target.value)}
          placeholder="admin@beispiel.ch"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="adminFirstName" className="block text-sm font-medium text-gray-700">
            Vorname *
          </label>
          <input
            id="adminFirstName"
            type="text"
            value={data.adminFirstName}
            onChange={(e) => updateField('adminFirstName', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="adminLastName" className="block text-sm font-medium text-gray-700">
            Nachname *
          </label>
          <input
            id="adminLastName"
            type="text"
            value={data.adminLastName}
            onChange={(e) => updateField('adminLastName', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 6: Confirmation
// ---------------------------------------------------------------------------
function StepConfirmation({ data }: { data: WizardData }) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Zusammenfassung</h2>
      <p className="text-sm text-gray-500">
        Pruefen Sie alle Angaben, bevor Sie das Holding erstellen.
      </p>

      <div className="space-y-4">
        <SummarySection title="Holding">
          <SummaryRow label="Name" value={data.holdingName} />
          <SummaryRow label="Slug" value={data.holdingSlug} />
        </SummarySection>

        <SummarySection title="Branding">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Farben:</span>
            <span className="inline-block h-5 w-5 rounded" style={{ backgroundColor: data.primaryColor }} />
            <span className="inline-block h-5 w-5 rounded" style={{ backgroundColor: data.secondaryColor }} />
            <span className="inline-block h-5 w-5 rounded" style={{ backgroundColor: data.accentColor }} />
          </div>
          <SummaryRow label="Schriftart" value={data.fontFamily} />
          <SummaryRow label="Eckenradius" value={data.borderRadius} />
        </SummarySection>

        <SummarySection title="Sprache & Region">
          <SummaryRow label="Sprache" value={data.language} />
          <SummaryRow label="Gebietsschema" value={data.locale} />
          <SummaryRow label="Waehrung" value={data.currency} />
          <SummaryRow label="Datumsformat" value={data.dateFormat} />
        </SummarySection>

        <SummarySection title="Erstes Unternehmen">
          <SummaryRow label="Name" value={data.companyName} />
          <SummaryRow label="Slug" value={data.companySlug} />
        </SummarySection>

        <SummarySection title="Administrator">
          <SummaryRow label="Name" value={`${data.adminFirstName} ${data.adminLastName}`} />
          <SummaryRow label="E-Mail" value={data.adminEmail} />
        </SummarySection>
      </div>
    </div>
  )
}

function SummarySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-gray-50 p-4">
      <h3 className="mb-2 text-sm font-semibold text-gray-900">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  )
}
