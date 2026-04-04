'use client'

import { useState, useTransition, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createCompany, sendSuperUserInvitation } from './actions'

type WizardStep = {
  number: number
  label: string
}

type CompanyWizardData = {
  // Step 1: Company Details
  companyName: string
  companySlug: string

  // Step 2: Branding (inherits holding defaults)
  primaryColor: string
  secondaryColor: string
  accentColor: string
  backgroundColor: string
  surfaceColor: string
  textPrimary: string
  textSecondary: string
  fontFamily: string
  borderRadius: string
  inheritBranding: boolean

  // Step 3: Domain
  subdomain: string
  customDomain: string
  useCustomDomain: boolean
  domainVerified: boolean

  // Step 4: Super User invitation
  superUserEmail: string
  superUserFirstName: string
  superUserLastName: string
}

const DEFAULT_DATA: CompanyWizardData = {
  companyName: '',
  companySlug: '',

  primaryColor: '#1A56DB',
  secondaryColor: '#1A1A1A',
  accentColor: '#F3A917',
  backgroundColor: '#FFFFFF',
  surfaceColor: '#F9FAFB',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  fontFamily: 'Inter',
  borderRadius: '8px',
  inheritBranding: true,

  subdomain: '',
  customDomain: '',
  useCustomDomain: false,
  domainVerified: false,

  superUserEmail: '',
  superUserFirstName: '',
  superUserLastName: '',
}

type Props = {
  steps: WizardStep[]
  holdingId: string
}

export function CompanyWizardClient({ steps, holdingId }: Props) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [data, setData] = useState<CompanyWizardData>(DEFAULT_DATA)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())

  const updateField = useCallback(<K extends keyof CompanyWizardData>(field: K, value: CompanyWizardData[K]) => {
    setData((prev) => ({ ...prev, [field]: value }))
  }, [])

  // Auto-generate slug and subdomain from name
  useEffect(() => {
    if (data.companyName) {
      const slug = data.companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
      updateField('companySlug', slug)
      if (!data.useCustomDomain) {
        updateField('subdomain', slug)
      }
    }
  }, [data.companyName, data.useCustomDomain, updateField])

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1:
        return data.companyName.length >= 2 && data.companySlug.length >= 3
      case 2:
        return true // branding can use defaults
      case 3:
        return data.useCustomDomain ? data.customDomain.length > 0 : data.subdomain.length >= 3
      case 4:
        return data.superUserEmail.includes('@') && data.superUserFirstName.length >= 1 && data.superUserLastName.length >= 1
      default:
        return false
    }
  }

  const handleNext = () => {
    if (!canProceed()) return
    setError(null)
    setCompletedSteps((prev) => new Set([...prev, currentStep]))
    setCurrentStep(currentStep + 1)
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
      setError(null)
    }
  }

  const handleVerifyDomain = () => {
    if (!data.customDomain) return
    startTransition(async () => {
      // Domain verification placeholder
      updateField('domainVerified', true)
    })
  }

  const handleComplete = () => {
    setError(null)
    startTransition(async () => {
      // 1. Create company
      const companyResult = await createCompany({
        name: data.companyName,
        slug: data.companySlug,
      })

      if (!companyResult.success) {
        setError(companyResult.error ?? 'Unternehmen konnte nicht erstellt werden')
        return
      }

      // 2. Send super user invitation
      const invResult = await sendSuperUserInvitation({
        companyId: companyResult.companyId ?? '',
        email: data.superUserEmail,
        firstName: data.superUserFirstName,
        lastName: data.superUserLastName,
      })

      if (!invResult.success) {
        setError(invResult.error ?? 'Einladung konnte nicht gesendet werden')
        return
      }

      router.push('/admin')
    })
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Step indicator */}
      <nav className="mb-8" aria-label="Fortschritt">
        <ol className="flex items-center gap-3">
          {steps.map((step, idx) => {
            const isCompleted = completedSteps.has(step.number)
            const isCurrent = step.number === currentStep
            return (
              <li key={step.number} className="flex items-center gap-3">
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
                  <div className={`h-px w-6 sm:w-10 ${isCompleted ? 'bg-green-400' : 'bg-gray-300'}`} />
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
        {currentStep === 1 && <StepCompanyDetails data={data} updateField={updateField} />}
        {currentStep === 2 && <StepBranding data={data} updateField={updateField} />}
        {currentStep === 3 && <StepDomain data={data} updateField={updateField} onVerify={handleVerifyDomain} isPending={isPending} />}
        {currentStep === 4 && <StepSuperUser data={data} updateField={updateField} />}
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

        {currentStep < 4 ? (
          <button
            type="button"
            onClick={handleNext}
            disabled={!canProceed() || isPending}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            aria-label="Weiter"
          >
            Weiter
          </button>
        ) : (
          <button
            type="button"
            onClick={handleComplete}
            disabled={!canProceed() || isPending}
            className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
            aria-label="Unternehmen erstellen"
          >
            {isPending ? 'Erstellen...' : 'Unternehmen erstellen'}
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 1: Company Details
// ---------------------------------------------------------------------------
function StepCompanyDetails({
  data,
  updateField,
}: {
  data: CompanyWizardData
  updateField: <K extends keyof CompanyWizardData>(field: K, value: CompanyWizardData[K]) => void
}) {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-gray-900">Unternehmen-Details</h2>

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
// Step 2: Branding
// ---------------------------------------------------------------------------
function StepBranding({
  data,
  updateField,
}: {
  data: CompanyWizardData
  updateField: <K extends keyof CompanyWizardData>(field: K, value: CompanyWizardData[K]) => void
}) {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-gray-900">Branding</h2>

      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={data.inheritBranding}
          onChange={(e) => updateField('inheritBranding', e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-700">Holding-Branding uebernehmen</span>
      </label>

      {!data.inheritBranding && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <ColorField label="Primaerfarbe" value={data.primaryColor} onChange={(v) => updateField('primaryColor', v)} />
            <ColorField label="Sekundaerfarbe" value={data.secondaryColor} onChange={(v) => updateField('secondaryColor', v)} />
            <ColorField label="Akzentfarbe" value={data.accentColor} onChange={(v) => updateField('accentColor', v)} />
            <ColorField label="Hintergrund" value={data.backgroundColor} onChange={(v) => updateField('backgroundColor', v)} />
            <ColorField label="Oberflaeche" value={data.surfaceColor} onChange={(v) => updateField('surfaceColor', v)} />
            <ColorField label="Text Primaer" value={data.textPrimary} onChange={(v) => updateField('textPrimary', v)} />
            <ColorField label="Text Sekundaer" value={data.textSecondary} onChange={(v) => updateField('textSecondary', v)} />
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
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
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
// Step 3: Domain
// ---------------------------------------------------------------------------
function StepDomain({
  data,
  updateField,
  onVerify,
  isPending,
}: {
  data: CompanyWizardData
  updateField: <K extends keyof CompanyWizardData>(field: K, value: CompanyWizardData[K]) => void
  onVerify: () => void
  isPending: boolean
}) {
  const rootDomain = process.env.NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN ?? 'platform.enura.ch'

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-gray-900">Domain-Konfiguration</h2>

      {/* Subdomain (auto-generated) */}
      <div>
        <label htmlFor="subdomain" className="block text-sm font-medium text-gray-700">
          Subdomain (automatisch)
        </label>
        <div className="mt-1 flex items-center">
          <input
            id="subdomain"
            type="text"
            value={data.subdomain}
            onChange={(e) => updateField('subdomain', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            disabled={data.useCustomDomain}
            className="block w-full rounded-l-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
          />
          <span className="inline-flex items-center rounded-r-md border border-l-0 border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">
            .{rootDomain}
          </span>
        </div>
      </div>

      {/* Custom domain toggle */}
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={data.useCustomDomain}
          onChange={(e) => {
            updateField('useCustomDomain', e.target.checked)
            updateField('domainVerified', false)
          }}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-700">Eigene Domain verwenden</span>
      </label>

      {data.useCustomDomain && (
        <>
          <div>
            <label htmlFor="customDomain" className="block text-sm font-medium text-gray-700">
              Eigene Domain
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                id="customDomain"
                type="text"
                value={data.customDomain}
                onChange={(e) => {
                  updateField('customDomain', e.target.value)
                  updateField('domainVerified', false)
                }}
                placeholder="bi.ihr-unternehmen.ch"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={onVerify}
                disabled={isPending || !data.customDomain}
                className="whitespace-nowrap rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                aria-label="Domain verifizieren"
              >
                {isPending ? 'Pruefen...' : 'Verifizieren'}
              </button>
            </div>
          </div>

          {/* CNAME instructions */}
          <div className="rounded-lg bg-blue-50 p-4">
            <h3 className="text-sm font-semibold text-blue-900">DNS-Konfiguration</h3>
            <p className="mt-1 text-sm text-blue-800">
              Erstellen Sie einen CNAME-Eintrag bei Ihrem DNS-Provider:
            </p>
            <div className="mt-3 overflow-x-auto rounded-md bg-white p-3 font-mono text-xs text-gray-800">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="pb-1 pr-4">Typ</th>
                    <th className="pb-1 pr-4">Name</th>
                    <th className="pb-1">Wert</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="pr-4">CNAME</td>
                    <td className="pr-4">{data.customDomain || 'bi.ihr-unternehmen.ch'}</td>
                    <td>cname.{rootDomain}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {data.domainVerified && (
              <p className="mt-3 flex items-center gap-1 text-sm font-medium text-green-700">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Domain verifiziert
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 4: Super User Invitation
// ---------------------------------------------------------------------------
function StepSuperUser({
  data,
  updateField,
}: {
  data: CompanyWizardData
  updateField: <K extends keyof CompanyWizardData>(field: K, value: CompanyWizardData[K]) => void
}) {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-gray-900">Super-User Einladung</h2>
      <p className="text-sm text-gray-500">
        Der Super-User ist der erste Administrator des Unternehmens. Er erhaelt eine Einladung per E-Mail.
      </p>

      <div>
        <label htmlFor="superUserEmail" className="block text-sm font-medium text-gray-700">
          E-Mail-Adresse *
        </label>
        <input
          id="superUserEmail"
          type="email"
          value={data.superUserEmail}
          onChange={(e) => updateField('superUserEmail', e.target.value)}
          placeholder="admin@unternehmen.ch"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="superUserFirstName" className="block text-sm font-medium text-gray-700">
            Vorname *
          </label>
          <input
            id="superUserFirstName"
            type="text"
            value={data.superUserFirstName}
            onChange={(e) => updateField('superUserFirstName', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="superUserLastName" className="block text-sm font-medium text-gray-700">
            Nachname *
          </label>
          <input
            id="superUserLastName"
            type="text"
            value={data.superUserLastName}
            onChange={(e) => updateField('superUserLastName', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  )
}
