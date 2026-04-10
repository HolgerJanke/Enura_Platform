'use client'

import { useCallback, useState, useTransition, useRef, useEffect } from 'react'
import type { RoleRow } from '@enura/types'
import { createUserAction } from './actions'

type Props = {
  roles: RoleRow[]
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CreateUserModal({ roles, open, onClose, onSuccess }: Props) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const firstInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      // Reset form when opening
      setFirstName('')
      setLastName('')
      setEmail('')
      setSelectedRoleIds([])
      setError(null)
      // Focus first input after render
      setTimeout(() => firstInputRef.current?.focus(), 50)
    }
  }, [open])

  const toggleRole = useCallback((roleId: string) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId]
    )
  }, [])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)

      if (!firstName.trim() || !lastName.trim() || !email.trim()) {
        setError('Bitte alle Pflichtfelder ausfüllen.')
        return
      }

      if (selectedRoleIds.length === 0) {
        setError('Bitte mindestens eine Rolle auswählen.')
        return
      }

      startTransition(async () => {
        const result = await createUserAction({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          roleIds: selectedRoleIds,
        })

        if (result.error) {
          setError(result.error)
        } else {
          onSuccess()
          onClose()
        }
      })
    },
    [firstName, lastName, email, selectedRoleIds, onSuccess, onClose]
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Neuen Benutzer erstellen"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
        }}
        role="button"
        tabIndex={-1}
        aria-label="Dialog schließen"
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg rounded-brand bg-brand-background p-6 shadow-xl mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-brand-text-primary">
            Neuer Benutzer
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-brand p-1.5 text-brand-text-secondary hover:bg-gray-100 transition-colors"
            aria-label="Dialog schließen"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="create-first-name"
                className="block text-sm font-medium text-brand-text-primary mb-1"
              >
                Vorname
              </label>
              <input
                ref={firstInputRef}
                id="create-first-name"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-brand border border-gray-300 bg-brand-background px-3 py-2 text-sm text-brand-text-primary placeholder:text-brand-text-secondary focus:outline-none focus:ring-2 focus:ring-offset-0"
                style={
                  {
                    '--tw-ring-color': 'var(--brand-primary)',
                  } as React.CSSProperties
                }
                placeholder="Max"
                required
                disabled={isPending}
              />
            </div>
            <div>
              <label
                htmlFor="create-last-name"
                className="block text-sm font-medium text-brand-text-primary mb-1"
              >
                Nachname
              </label>
              <input
                id="create-last-name"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-brand border border-gray-300 bg-brand-background px-3 py-2 text-sm text-brand-text-primary placeholder:text-brand-text-secondary focus:outline-none focus:ring-2 focus:ring-offset-0"
                style={
                  {
                    '--tw-ring-color': 'var(--brand-primary)',
                  } as React.CSSProperties
                }
                placeholder="Mustermann"
                required
                disabled={isPending}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="create-email"
              className="block text-sm font-medium text-brand-text-primary mb-1"
            >
              E-Mail-Adresse
            </label>
            <input
              id="create-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-brand border border-gray-300 bg-brand-background px-3 py-2 text-sm text-brand-text-primary placeholder:text-brand-text-secondary focus:outline-none focus:ring-2 focus:ring-offset-0"
              style={
                {
                  '--tw-ring-color': 'var(--brand-primary)',
                } as React.CSSProperties
              }
              placeholder="max.mustermann@firma.ch"
              required
              disabled={isPending}
            />
          </div>

          <fieldset>
            <legend className="block text-sm font-medium text-brand-text-primary mb-2">
              Rollen zuweisen
            </legend>
            <div className="space-y-2 max-h-48 overflow-y-auto rounded-brand border border-gray-200 p-3">
              {roles.length === 0 && (
                <p className="text-sm text-brand-text-secondary">
                  Keine Rollen verfügbar.
                </p>
              )}
              {roles.map((role) => (
                <label
                  key={role.id}
                  className="flex items-center gap-3 rounded-brand px-2 py-1.5 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedRoleIds.includes(role.id)}
                    onChange={() => toggleRole(role.id)}
                    disabled={isPending}
                    className="h-4 w-4 rounded border-gray-300"
                    style={{ accentColor: 'var(--brand-primary)' }}
                  />
                  <div>
                    <span className="text-sm font-medium text-brand-text-primary">
                      {role.label}
                    </span>
                    {role.description && (
                      <p className="text-xs text-brand-text-secondary">
                        {role.description}
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </fieldset>

          {error && (
            <div
              className="rounded-brand border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-brand border border-gray-300 bg-brand-background px-4 py-2 text-sm font-medium text-brand-text-primary hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              {isPending ? 'Wird erstellt...' : 'Benutzer erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
