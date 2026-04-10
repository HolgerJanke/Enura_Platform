'use client'

import { useState, useTransition } from 'react'
import { acceptInvitation } from './actions'

type InviteFormClientProps = {
  token: string
  email: string
  firstName: string
  lastName: string
}

export function InviteFormClient({
  token,
  email,
  firstName: initialFirstName,
  lastName: initialLastName,
}: InviteFormClientProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [firstName, setFirstName] = useState(initialFirstName)
  const [lastName, setLastName] = useState(initialLastName)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    // Client-side validation
    if (!firstName.trim()) {
      setError('Bitte geben Sie Ihren Vornamen ein.')
      return
    }
    if (!lastName.trim()) {
      setError('Bitte geben Sie Ihren Nachnamen ein.')
      return
    }
    if (password.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen lang sein.')
      return
    }
    if (password !== confirmPassword) {
      setError('Die Passwoerter stimmen nicht ueberein.')
      return
    }

    startTransition(async () => {
      const result = await acceptInvitation({
        token,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        password,
      })

      if (!result.success) {
        setError(result.error ?? 'Ein unbekannter Fehler ist aufgetreten.')
      }
      // On success, the server action redirects to /login
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* E-Mail (readonly) */}
      <div>
        <label htmlFor="invite-email" className="block text-sm font-medium text-gray-700 mb-1.5">
          E-Mail-Adresse
        </label>
        <input
          id="invite-email"
          type="email"
          value={email}
          readOnly
          className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm text-gray-500 cursor-not-allowed"
          aria-label="E-Mail-Adresse (nicht aenderbar)"
        />
      </div>

      {/* First name */}
      <div>
        <label htmlFor="invite-first-name" className="block text-sm font-medium text-gray-700 mb-1.5">
          Vorname
        </label>
        <input
          id="invite-first-name"
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          placeholder="Vorname"
          aria-label="Vorname"
        />
      </div>

      {/* Last name */}
      <div>
        <label htmlFor="invite-last-name" className="block text-sm font-medium text-gray-700 mb-1.5">
          Nachname
        </label>
        <input
          id="invite-last-name"
          type="text"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          placeholder="Nachname"
          aria-label="Nachname"
        />
      </div>

      {/* Password */}
      <div>
        <label htmlFor="invite-password" className="block text-sm font-medium text-gray-700 mb-1.5">
          Passwort
        </label>
        <input
          id="invite-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          placeholder="Mindestens 8 Zeichen"
          aria-label="Passwort"
        />
      </div>

      {/* Confirm password */}
      <div>
        <label htmlFor="invite-confirm-password" className="block text-sm font-medium text-gray-700 mb-1.5">
          Passwort bestaetigen
        </label>
        <input
          id="invite-confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          placeholder="Passwort wiederholen"
          aria-label="Passwort bestaetigen"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Einladung annehmen"
      >
        {isPending ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Wird erstellt...
          </span>
        ) : (
          'Konto erstellen und beitreten'
        )}
      </button>
    </form>
  )
}
