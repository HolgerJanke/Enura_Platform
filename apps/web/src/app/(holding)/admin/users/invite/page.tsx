'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { inviteUser } from '../actions'

// ---------------------------------------------------------------------------
// Static role definitions (system roles from CLAUDE.md Section 7)
// ---------------------------------------------------------------------------

const ROLE_OPTIONS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'super_user', label: 'Super User' },
  { key: 'geschaeftsfuehrung', label: 'Geschaeftsfuehrung' },
  { key: 'teamleiter', label: 'Teamleiter' },
  { key: 'setter', label: 'Setter' },
  { key: 'berater', label: 'Berater' },
  { key: 'innendienst', label: 'Innendienst' },
  { key: 'bau', label: 'Bau / Montage' },
  { key: 'buchhaltung', label: 'Buchhaltung' },
  { key: 'leadkontrolle', label: 'Leadkontrolle' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InviteUserPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [roleKey, setRoleKey] = useState('')

  // Company list will be loaded client-side via data attribute or prop
  // For simplicity, we use a hidden fetch approach
  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([])
  const [companiesLoaded, setCompaniesLoaded] = useState(false)

  // Load companies on mount
  if (!companiesLoaded) {
    setCompaniesLoaded(true)
    // We rely on the server action to validate company_id against holding
    // Companies are passed via a data-fetching pattern
    import('../actions').then((mod) => {
      mod.getAllUsers().then((data) => {
        setCompanies(data.companies)
      })
    })
  }

  const selectedRole = ROLE_OPTIONS.find((r) => r.key === roleKey)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!firstName.trim()) {
      setError('Bitte geben Sie den Vornamen ein.')
      return
    }
    if (!lastName.trim()) {
      setError('Bitte geben Sie den Nachnamen ein.')
      return
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Bitte geben Sie eine gueltige E-Mail-Adresse ein.')
      return
    }
    if (!companyId) {
      setError('Bitte waehlen Sie ein Unternehmen aus.')
      return
    }
    if (!roleKey || !selectedRole) {
      setError('Bitte waehlen Sie eine Rolle aus.')
      return
    }

    startTransition(async () => {
      const result = await inviteUser({
        companyId,
        email: email.trim(),
        roleKey,
        roleLabel: selectedRole.label,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      })

      if (result.success) {
        router.push('/admin/users')
      } else {
        setError(result.error ?? 'Ein unbekannter Fehler ist aufgetreten.')
      }
    })
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Zurueck zur Benutzerverwaltung
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Benutzer einladen</h1>
        <p className="text-gray-500 mt-1">
          Laden Sie einen neuen Benutzer zu einem Unternehmen ein.
          Der Benutzer erhaelt eine E-Mail mit einem temporaeren Passwort.
        </p>
      </div>

      <div className="max-w-2xl">
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Company selector */}
          <div>
            <label htmlFor="company" className="block text-sm font-medium text-gray-700">
              Unternehmen
            </label>
            <select
              id="company"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              aria-label="Unternehmen auswaehlen"
            >
              <option value="">Unternehmen waehlen...</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Name fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                Vorname
              </label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Max"
                aria-label="Vorname des Benutzers"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                Nachname
              </label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Muster"
                aria-label="Nachname des Benutzers"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              E-Mail-Adresse
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="max.muster@unternehmen.ch"
              aria-label="E-Mail-Adresse des Benutzers"
            />
          </div>

          {/* Role selector */}
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700">
              Rolle
            </label>
            <select
              id="role"
              value={roleKey}
              onChange={(e) => setRoleKey(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              aria-label="Rolle auswaehlen"
            >
              <option value="">Rolle waehlen...</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <Link
              href="/admin/users"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Abbrechen
            </Link>
            <button
              type="submit"
              disabled={isPending}
              className={`
                inline-flex items-center rounded-lg px-5 py-2 text-sm font-medium text-white transition-colors
                ${isPending ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}
              `}
              aria-label="Einladung senden"
            >
              {isPending ? (
                <>
                  <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Wird eingeladen...
                </>
              ) : (
                'Einladung senden'
              )}
            </button>
          </div>
        </form>

        {/* Info box */}
        <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h2 className="text-sm font-medium text-blue-900 mb-1">Hinweis</h2>
          <p className="text-sm text-blue-700">
            Der Benutzer erhaelt ein temporaeres Passwort und muss bei der ersten
            Anmeldung ein neues Passwort setzen sowie die Zwei-Faktor-Authentifizierung
            einrichten. Alle Einladungen laufen nach 7 Tagen ab.
          </p>
        </div>
      </div>
    </div>
  )
}
