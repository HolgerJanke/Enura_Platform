'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createTenantAction } from './actions'

type Step = 1 | 2 | 3 | 4

type FormData = {
  name: string
  slug: string
  branding: {
    primary: string
    secondary: string
    accent: string
    font: string
    radius: string
  }
  superUser: {
    firstName: string
    lastName: string
    email: string
  }
  confirmed: boolean
}

const INITIAL_FORM: FormData = {
  name: '',
  slug: '',
  branding: {
    primary: '#1A56DB',
    secondary: '#1A1A1A',
    accent: '#F3A917',
    font: 'Inter',
    radius: '8px',
  },
  superUser: {
    firstName: '',
    lastName: '',
    email: '',
  },
  confirmed: false,
}

const SLUG_REGEX = /^[a-z0-9-]+$/

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae')
    .replace(/[öÖ]/g, 'oe')
    .replace(/[üÜ]/g, 'ue')
    .replace(/[ß]/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function StepIndicator({ current, total }: { current: Step; total: number }) {
  const steps = [
    'Unternehmensdaten',
    'Branding',
    'Super User',
    'Bestaetigung',
  ]

  return (
    <nav aria-label="Fortschritt" className="mb-8">
      <ol className="flex items-center gap-2">
        {steps.slice(0, total).map((label, i) => {
          const stepNum = (i + 1) as Step
          const isActive = stepNum === current
          const isCompleted = stepNum < current
          return (
            <li key={label} className="flex items-center gap-2">
              {i > 0 && (
                <div
                  className={`h-px w-8 ${
                    isCompleted ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                />
              )}
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : isCompleted
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {isCompleted ? (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    stepNum
                  )}
                </div>
                <span
                  className={`text-sm ${
                    isActive ? 'font-medium text-gray-900' : 'text-gray-500'
                  }`}
                >
                  {label}
                </span>
              </div>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export default function NewTenantPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState<FormData>(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)

  const updateName = useCallback((name: string) => {
    setForm((prev) => ({
      ...prev,
      name,
      slug: slugManuallyEdited ? prev.slug : slugify(name),
    }))
  }, [slugManuallyEdited])

  const updateSlug = useCallback((slug: string) => {
    setSlugManuallyEdited(true)
    setForm((prev) => ({ ...prev, slug }))
  }, [])

  const canProceedStep1 = form.name.length >= 2 && form.slug.length >= 2 && SLUG_REGEX.test(form.slug)
  const canProceedStep2 = true
  const canProceedStep3 =
    form.superUser.firstName.length >= 1 &&
    form.superUser.lastName.length >= 1 &&
    form.superUser.email.includes('@')
  const canSubmit = form.confirmed

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)

    const result = await createTenantAction({
      name: form.name,
      slug: form.slug,
      branding: form.branding,
      superUser: form.superUser,
    })

    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
    }
    // On success, the action redirects via next/navigation
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Zurück zur Übersicht
        </Link>
      </div>

      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Neues Unternehmen erstellen</h1>
      <p className="text-gray-500 mb-6">
        Erstellen Sie ein neues Unternehmen in der Enura-Plattform.
      </p>

      <StepIndicator current={step} total={4} />

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="max-w-2xl">
        {/* Step 1: Unternehmensdaten */}
        {step === 1 && (
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Unternehmensdaten</h2>
            <div className="space-y-5">
              <div>
                <label htmlFor="company-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Unternehmensname *
                </label>
                <input
                  type="text"
                  id="company-name"
                  value={form.name}
                  onChange={(e) => updateName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Alpen Energie GmbH"
                />
              </div>
              <div>
                <label htmlFor="company-slug" className="block text-sm font-medium text-gray-700 mb-1">
                  Slug (Subdomain) *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    id="company-slug"
                    value={form.slug}
                    onChange={(e) => updateSlug(e.target.value)}
                    className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                      form.slug.length > 0 && !SLUG_REGEX.test(form.slug)
                        ? 'border-red-300 focus:border-red-500'
                        : 'border-gray-300 focus:border-blue-500'
                    }`}
                    placeholder="alpen-energie"
                  />
                  <span className="flex-shrink-0 text-sm text-gray-500">.platform.com</span>
                </div>
                {form.slug.length > 0 && !SLUG_REGEX.test(form.slug) && (
                  <p className="mt-1 text-xs text-red-600">
                    Nur Kleinbuchstaben, Zahlen und Bindestriche erlaubt.
                  </p>
                )}
                {form.slug.length > 0 && SLUG_REGEX.test(form.slug) && (
                  <p className="mt-1 text-xs text-gray-500">
                    Vorschau: <span className="font-mono font-medium">{form.slug}.platform.com</span>
                  </p>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                disabled={!canProceedStep1}
                onClick={() => setStep(2)}
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Weiter
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Branding */}
        {step === 2 && (
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Branding</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="brand-primary" className="block text-sm font-medium text-gray-700 mb-1">
                    Primärfarbe
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      id="brand-primary"
                      value={form.branding.primary}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          branding: { ...prev.branding, primary: e.target.value },
                        }))
                      }
                      className="h-10 w-10 rounded border border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={form.branding.primary}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          branding: { ...prev.branding, primary: e.target.value },
                        }))
                      }
                      className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      aria-label="Primärfarbe Hex-Wert"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="brand-secondary" className="block text-sm font-medium text-gray-700 mb-1">
                    Sekundärfarbe
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      id="brand-secondary"
                      value={form.branding.secondary}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          branding: { ...prev.branding, secondary: e.target.value },
                        }))
                      }
                      className="h-10 w-10 rounded border border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={form.branding.secondary}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          branding: { ...prev.branding, secondary: e.target.value },
                        }))
                      }
                      className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      aria-label="Sekundärfarbe Hex-Wert"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="brand-accent" className="block text-sm font-medium text-gray-700 mb-1">
                    Akzentfarbe
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      id="brand-accent"
                      value={form.branding.accent}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          branding: { ...prev.branding, accent: e.target.value },
                        }))
                      }
                      className="h-10 w-10 rounded border border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={form.branding.accent}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          branding: { ...prev.branding, accent: e.target.value },
                        }))
                      }
                      className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      aria-label="Akzentfarbe Hex-Wert"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="brand-font" className="block text-sm font-medium text-gray-700 mb-1">
                    Schriftart
                  </label>
                  <input
                    type="text"
                    id="brand-font"
                    value={form.branding.font}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        branding: { ...prev.branding, font: e.target.value },
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="Inter"
                  />
                </div>
                <div>
                  <label htmlFor="brand-radius" className="block text-sm font-medium text-gray-700 mb-1">
                    Eckenradius
                  </label>
                  <input
                    type="text"
                    id="brand-radius"
                    value={form.branding.radius}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        branding: { ...prev.branding, radius: e.target.value },
                      }))
                    }
                    className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="8px"
                  />
                </div>
              </div>

              {/* Live preview */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">Vorschau</p>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
                  <div
                    className="rounded-lg p-4 text-white"
                    style={{
                      backgroundColor: form.branding.primary,
                      borderRadius: form.branding.radius,
                      fontFamily: form.branding.font,
                    }}
                  >
                    <p className="text-sm font-medium">Primär-Karte</p>
                    <p className="text-xs opacity-80 mt-1">Beispielinhalt in der Primärfarbe</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="px-3 py-1.5 text-xs font-medium text-white"
                      style={{
                        backgroundColor: form.branding.primary,
                        borderRadius: form.branding.radius,
                      }}
                    >
                      Primär-Button
                    </button>
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium text-white rounded-full"
                      style={{ backgroundColor: form.branding.accent }}
                    >
                      Akzent-Badge
                    </span>
                  </div>
                  <div
                    className="rounded-lg border border-gray-200 bg-white p-3"
                    style={{
                      borderRadius: form.branding.radius,
                      fontFamily: form.branding.font,
                    }}
                  >
                    <p className="text-sm font-medium" style={{ color: form.branding.secondary }}>
                      Sekundärtext
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Schrift: {form.branding.font} | Radius: {form.branding.radius}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Zurück
              </button>
              <button
                type="button"
                disabled={!canProceedStep2}
                onClick={() => setStep(3)}
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Weiter
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Super User */}
        {step === 3 && (
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Super User erstellen</h2>
            <p className="text-sm text-gray-500 mb-4">
              Der Super User ist der Hauptadministrator des Unternehmens. Er erhält eine
              Einladungs-E-Mail mit einem temporären Passwort.
            </p>
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="su-first-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Vorname *
                  </label>
                  <input
                    type="text"
                    id="su-first-name"
                    value={form.superUser.firstName}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        superUser: { ...prev.superUser, firstName: e.target.value },
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="Max"
                  />
                </div>
                <div>
                  <label htmlFor="su-last-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Nachname *
                  </label>
                  <input
                    type="text"
                    id="su-last-name"
                    value={form.superUser.lastName}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        superUser: { ...prev.superUser, lastName: e.target.value },
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="Mustermann"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="su-email" className="block text-sm font-medium text-gray-700 mb-1">
                  E-Mail-Adresse *
                </label>
                <input
                  type="email"
                  id="su-email"
                  value={form.superUser.email}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      superUser: { ...prev.superUser, email: e.target.value },
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="admin@firma.ch"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Zurück
              </button>
              <button
                type="button"
                disabled={!canProceedStep3}
                onClick={() => setStep(4)}
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Weiter
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Bestaetigung */}
        {step === 4 && (
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Zusammenfassung</h2>

            <div className="space-y-6">
              {/* Company info */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Unternehmen
                </h3>
                <dl className="space-y-2 rounded-lg bg-gray-50 p-4">
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Name</dt>
                    <dd className="text-sm font-medium text-gray-900">{form.name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Subdomain</dt>
                    <dd className="text-sm font-mono text-gray-900">{form.slug}.platform.com</dd>
                  </div>
                </dl>
              </div>

              {/* Branding */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Branding
                </h3>
                <div className="flex items-center gap-4 rounded-lg bg-gray-50 p-4">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-8 w-8 rounded border border-gray-300"
                      style={{ backgroundColor: form.branding.primary }}
                    />
                    <span className="text-xs font-mono text-gray-500">{form.branding.primary}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-8 w-8 rounded border border-gray-300"
                      style={{ backgroundColor: form.branding.secondary }}
                    />
                    <span className="text-xs font-mono text-gray-500">{form.branding.secondary}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-8 w-8 rounded border border-gray-300"
                      style={{ backgroundColor: form.branding.accent }}
                    />
                    <span className="text-xs font-mono text-gray-500">{form.branding.accent}</span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {form.branding.font} | {form.branding.radius}
                  </span>
                </div>
              </div>

              {/* Super User */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Super User
                </h3>
                <dl className="space-y-2 rounded-lg bg-gray-50 p-4">
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Name</dt>
                    <dd className="text-sm font-medium text-gray-900">
                      {form.superUser.firstName} {form.superUser.lastName}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">E-Mail</dt>
                    <dd className="text-sm text-gray-900">{form.superUser.email}</dd>
                  </div>
                </dl>
              </div>

              {/* Confirmation checkbox */}
              <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <input
                  type="checkbox"
                  id="confirm-checkbox"
                  checked={form.confirmed}
                  onChange={(e) => setForm((prev) => ({ ...prev, confirmed: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="confirm-checkbox" className="text-sm text-blue-800">
                  Ich bestaetige, dass die obenstehenden Daten korrekt sind und
                  dass <strong>{form.superUser.firstName} {form.superUser.lastName}</strong> der
                  Unternehmensadministrator ist.
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Zurück
              </button>
              <button
                type="button"
                disabled={!canSubmit || submitting}
                onClick={handleSubmit}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Wird erstellt...
                  </span>
                ) : (
                  'Unternehmen erstellen'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
