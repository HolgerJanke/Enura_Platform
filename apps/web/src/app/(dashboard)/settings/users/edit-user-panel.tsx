'use client'

import { useCallback, useState, useTransition, useEffect } from 'react'
import type { ProfileRow } from '@enura/types'
import { updateUserProfileAction } from './actions'

type Props = {
  profile: ProfileRow
  email: string | null
  isCurrentUser: boolean
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function EditUserPanel({
  profile,
  email,
  isCurrentUser,
  open,
  onClose,
  onSuccess,
}: Props) {
  const [firstName, setFirstName] = useState(profile.first_name ?? '')
  const [lastName, setLastName] = useState(profile.last_name ?? '')
  const [phone, setPhone] = useState(profile.phone ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (open) {
      setFirstName(profile.first_name ?? '')
      setLastName(profile.last_name ?? '')
      setPhone(profile.phone ?? '')
      setError(null)
    }
  }, [open, profile])

  const handleSave = useCallback(() => {
    if (!firstName.trim() || !lastName.trim()) {
      setError('Vor- und Nachname sind Pflichtfelder.')
      return
    }

    startTransition(async () => {
      setError(null)
      const result = await updateUserProfileAction(profile.id, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || null,
      })
      if (result.error) {
        setError(result.error)
      } else {
        onSuccess()
        onClose()
      }
    })
  }, [profile.id, firstName, lastName, phone, onSuccess, onClose])

  if (!open) return null

  const displayName = profile.display_name || `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`Benutzer bearbeiten: ${displayName}`}>
      <div
        className="absolute inset-0 bg-black/30 transition-opacity"
        onClick={onClose}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
        role="button"
        tabIndex={-1}
        aria-label="Panel schliessen"
      />

      <div className="relative z-10 w-full max-w-md bg-brand-background shadow-xl flex flex-col h-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-brand-text-primary">Benutzer bearbeiten</h2>
          <button type="button" onClick={onClose} className="text-brand-text-secondary hover:text-brand-text-primary" aria-label="Schliessen">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-600">
              {(profile.first_name?.[0] ?? '').toUpperCase()}{(profile.last_name?.[0] ?? '').toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-brand-text-primary">{displayName}</p>
              <p className="text-xs text-brand-text-secondary">{email ?? '—'}</p>
            </div>
          </div>

          {error && (
            <div className="rounded-brand border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4" role="alert">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="edit-firstName" className="block text-sm font-medium text-brand-text-primary mb-1">
                Vorname <span className="text-red-500">*</span>
              </label>
              <input
                id="edit-firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-brand border border-gray-300 px-3 py-2 text-sm text-brand-text-primary bg-brand-background focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="edit-lastName" className="block text-sm font-medium text-brand-text-primary mb-1">
                Nachname <span className="text-red-500">*</span>
              </label>
              <input
                id="edit-lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-brand border border-gray-300 px-3 py-2 text-sm text-brand-text-primary bg-brand-background focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="edit-email" className="block text-sm font-medium text-brand-text-primary mb-1">
                E-Mail
              </label>
              <input
                id="edit-email"
                type="email"
                value={email ?? ''}
                disabled
                className="w-full rounded-brand border border-gray-200 px-3 py-2 text-sm text-brand-text-secondary bg-gray-50 cursor-not-allowed"
              />
              <p className="text-xs text-brand-text-secondary mt-1">E-Mail kann nicht geaendert werden.</p>
            </div>

            <div>
              <label htmlFor="edit-phone" className="block text-sm font-medium text-brand-text-primary mb-1">
                Telefon
              </label>
              <input
                id="edit-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+41 79 123 45 67"
                className="w-full rounded-brand border border-gray-300 px-3 py-2 text-sm text-brand-text-primary bg-brand-background focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 p-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-brand border border-gray-300 bg-brand-background px-4 py-2 text-sm font-medium text-brand-text-primary hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="rounded-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: 'var(--brand-primary)' }}
          >
            {isPending ? 'Wird gespeichert...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}
