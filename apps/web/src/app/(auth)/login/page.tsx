'use client'

import { useState } from 'react'
import { loginAction } from './actions'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  async function handleSubmit(formData: FormData) {
    setError(null)
    setIsPending(true)

    const result = await loginAction(formData)

    // If we reach here, redirect() didn't fire — there was an error
    if ('error' in result) {
      setError(result.error)
    }
    setIsPending(false)
  }

  return (
    <div className="bg-brand-surface rounded-brand p-8 shadow-sm border border-gray-200">
      <h2 className="text-xl font-semibold text-brand-text-primary mb-6 text-center">
        Anmelden
      </h2>

      {error && (
        <div className="mb-4 rounded-brand border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      <form action={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-brand-text-primary mb-1.5">
            E-Mail-Adresse
          </label>
          <input
            id="email" name="email" type="email" required autoComplete="email"
            className="w-full rounded-brand border border-gray-300 px-3 py-2.5 text-sm text-brand-text-primary bg-brand-background placeholder:text-brand-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
            placeholder="name@firma.ch"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-brand-text-primary mb-1.5">
            Passwort
          </label>
          <input
            id="password" name="password" type="password" required autoComplete="current-password"
            className="w-full rounded-brand border border-gray-300 px-3 py-2.5 text-sm text-brand-text-primary bg-brand-background placeholder:text-brand-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit" disabled={isPending}
          className="w-full rounded-brand bg-brand-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {isPending ? 'Wird angemeldet...' : 'Anmelden'}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-brand-text-secondary">
        Passwort vergessen? Bitte wenden Sie sich an Ihren Administrator.
      </p>
    </div>
  )
}
