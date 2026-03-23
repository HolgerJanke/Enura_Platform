'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { loginAction } from './actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="Anmelden"
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
          Wird angemeldet...
        </span>
      ) : (
        'Anmelden'
      )}
    </button>
  )
}

export default function LoginPage() {
  const [state, formAction] = useFormState(loginAction, { error: null })

  return (
    <div className="bg-brand-surface rounded-brand p-8 shadow-sm border border-gray-200">
      <h2 className="text-xl font-semibold text-brand-text-primary mb-6 text-center">
        Anmelden
      </h2>

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
            htmlFor="email"
            className="block text-sm font-medium text-brand-text-primary mb-1.5"
          >
            E-Mail-Adresse
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            aria-label="E-Mail-Adresse"
            className="w-full rounded-brand border border-gray-300 px-3 py-2.5 text-sm text-brand-text-primary bg-brand-background placeholder:text-brand-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
            placeholder="name@firma.ch"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-brand-text-primary mb-1.5"
          >
            Passwort
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            aria-label="Passwort"
            className="w-full rounded-brand border border-gray-300 px-3 py-2.5 text-sm text-brand-text-primary bg-brand-background placeholder:text-brand-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
            placeholder="Passwort eingeben"
          />
        </div>

        <SubmitButton />
      </form>

      <p className="mt-4 text-xs text-brand-text-secondary text-center">
        Passwort vergessen? Bitte wenden Sie sich an Ihren Administrator.
      </p>
    </div>
  )
}
