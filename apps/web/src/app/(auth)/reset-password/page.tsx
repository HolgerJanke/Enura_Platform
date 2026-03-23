'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { useState, useMemo, useCallback } from 'react'
import { resetPasswordAction } from './actions'

type PasswordRequirement = {
  label: string
  test: (value: string) => boolean
}

const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  { label: 'Mindestens 12 Zeichen', test: (v) => v.length >= 12 },
  { label: 'Mindestens 1 Grossbuchstabe', test: (v) => /[A-Z]/.test(v) },
  { label: 'Mindestens 1 Zahl', test: (v) => /[0-9]/.test(v) },
  { label: 'Mindestens 1 Sonderzeichen', test: (v) => /[^A-Za-z0-9]/.test(v) },
]

type StrengthLevel = {
  label: string
  color: string
  width: string
}

const STRENGTH_LEVELS: StrengthLevel[] = [
  { label: 'Sehr schwach', color: 'bg-red-500', width: 'w-1/4' },
  { label: 'Schwach', color: 'bg-orange-500', width: 'w-2/4' },
  { label: 'Gut', color: 'bg-yellow-500', width: 'w-3/4' },
  { label: 'Stark', color: 'bg-green-500', width: 'w-full' },
]

function getStrengthLevel(password: string): number {
  const metCount = PASSWORD_REQUIREMENTS.filter((req) => req.test(password)).length

  if (metCount <= 1) return 0
  if (metCount === 2) return 1
  if (metCount === 3) return 2
  // All 4 met + length >= 16
  if (metCount === 4 && password.length >= 16) return 3
  return 2 // All 4 met but length < 16
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="Passwort aendern"
      className="w-full rounded-brand bg-brand-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
    >
      {pending ? (
        <span className="flex items-center justify-center gap-2">
          <svg
            className="animate-spin h-4 w-4 text-white"
            xmlns="http://www.w3.org/2000/svg"
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
          Wird gespeichert...
        </span>
      ) : (
        'Passwort aendern'
      )}
    </button>
  )
}

export default function ResetPasswordPage() {
  const [state, formAction] = useFormState(resetPasswordAction, { error: null })
  const [passwordValue, setPasswordValue] = useState('')

  const requirementsMet = useMemo(
    () =>
      PASSWORD_REQUIREMENTS.map((req) => ({
        ...req,
        met: req.test(passwordValue),
      })),
    [passwordValue]
  )

  const strengthIndex = useMemo(() => getStrengthLevel(passwordValue), [passwordValue])
  const strength = STRENGTH_LEVELS[strengthIndex]

  const handlePasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPasswordValue(e.target.value)
    },
    []
  )

  return (
    <div className="bg-brand-surface rounded-brand p-8 shadow-sm border border-gray-200">
      <h2 className="text-xl font-semibold text-brand-text-primary mb-2 text-center">
        Passwort zuruecksetzen
      </h2>
      <p className="text-sm text-brand-text-secondary mb-6 text-center">
        Bitte setzen Sie ein neues Passwort, um fortzufahren.
      </p>

      {state.error && (
        <div
          className="mb-4 rounded-brand border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {state.error}
        </div>
      )}

      <form action={formAction} className="space-y-5">
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-brand-text-primary mb-1.5"
          >
            Neues Passwort
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            aria-label="Neues Passwort"
            className="w-full rounded-brand border border-gray-300 px-3 py-2.5 text-sm text-brand-text-primary bg-brand-background placeholder:text-brand-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
            placeholder="Neues Passwort eingeben"
            onChange={handlePasswordChange}
          />
        </div>

        {/* Password strength indicator */}
        {passwordValue.length > 0 && (
          <div className="space-y-1.5">
            <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${strength?.color ?? 'bg-gray-200'} ${strength?.width ?? 'w-0'}`}
              />
            </div>
            <p className="text-xs text-brand-text-secondary">
              Passwortstaerke: <span className="font-medium">{strength?.label ?? ''}</span>
            </p>
          </div>
        )}

        {/* Password requirements checklist */}
        <ul className="space-y-1.5" aria-label="Passwort-Anforderungen">
          {requirementsMet.map((req) => (
            <li
              key={req.label}
              className={`flex items-center gap-2 text-sm transition-colors ${
                req.met ? 'text-green-600' : 'text-brand-text-secondary'
              }`}
            >
              {req.met ? (
                <svg
                  className="h-4 w-4 shrink-0"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  className="h-4 w-4 shrink-0"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <circle cx="10" cy="10" r="4" />
                </svg>
              )}
              {req.label}
            </li>
          ))}
        </ul>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-brand-text-primary mb-1.5"
          >
            Passwort bestaetigen
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            aria-label="Passwort bestaetigen"
            className="w-full rounded-brand border border-gray-300 px-3 py-2.5 text-sm text-brand-text-primary bg-brand-background placeholder:text-brand-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
            placeholder="Passwort erneut eingeben"
          />
        </div>

        <SubmitButton />
      </form>
    </div>
  )
}
