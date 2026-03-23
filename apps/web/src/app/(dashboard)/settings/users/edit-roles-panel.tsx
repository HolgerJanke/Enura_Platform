'use client'

import { useCallback, useState, useTransition, useEffect } from 'react'
import type { ProfileRow, RoleRow } from '@enura/types'
import { updateUserRolesAction } from './actions'

type Props = {
  profile: ProfileRow
  roles: RoleRow[]
  currentRoleIds: string[]
  isCurrentUser: boolean
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function EditRolesPanel({
  profile,
  roles,
  currentRoleIds,
  isCurrentUser,
  open,
  onClose,
  onSuccess,
}: Props) {
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(currentRoleIds)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (open) {
      setSelectedRoleIds(currentRoleIds)
      setError(null)
    }
  }, [open, currentRoleIds])

  const toggleRole = useCallback((roleId: string) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId]
    )
  }, [])

  const handleSave = useCallback(() => {
    setError(null)

    if (selectedRoleIds.length === 0) {
      setError('Mindestens eine Rolle muss zugewiesen sein.')
      return
    }

    startTransition(async () => {
      const result = await updateUserRolesAction(profile.id, selectedRoleIds)

      if (result.error) {
        setError(result.error)
      } else {
        onSuccess()
        onClose()
      }
    })
  }, [profile.id, selectedRoleIds, onSuccess, onClose])

  const hasChanges =
    selectedRoleIds.length !== currentRoleIds.length ||
    selectedRoleIds.some((id) => !currentRoleIds.includes(id))

  if (!open) return null

  const displayName =
    profile.first_name && profile.last_name
      ? `${profile.first_name} ${profile.last_name}`
      : profile.display_name

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={`Rollen bearbeiten fuer ${displayName}`}
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
        aria-label="Panel schliessen"
      />

      {/* Slide-over panel */}
      <div className="relative z-10 flex h-full w-full max-w-md flex-col bg-brand-background shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-brand-text-primary">
              Rollen bearbeiten
            </h2>
            <p className="text-sm text-brand-text-secondary mt-0.5">
              {displayName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-brand p-1.5 text-brand-text-secondary hover:bg-gray-100 transition-colors"
            aria-label="Panel schliessen"
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isCurrentUser && (
            <div
              className="rounded-brand border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700 mb-4"
              role="status"
            >
              Sie koennen Ihre eigenen Rollen nicht aendern.
            </div>
          )}

          <fieldset disabled={isCurrentUser || isPending}>
            <legend className="block text-sm font-medium text-brand-text-primary mb-3">
              Systemrollen
            </legend>
            <div className="space-y-1">
              {roles.map((role) => {
                const isSelected = selectedRoleIds.includes(role.id)

                return (
                  <label
                    key={role.id}
                    className={`flex items-start gap-3 rounded-brand px-3 py-3 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-brand-surface border border-gray-200'
                        : 'hover:bg-gray-50 border border-transparent'
                    } ${isCurrentUser ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRole(role.id)}
                      disabled={isCurrentUser || isPending}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300"
                      style={{ accentColor: 'var(--brand-primary)' }}
                    />
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-brand-text-primary">
                        {role.label}
                      </span>
                      <p className="text-xs text-brand-text-secondary mt-0.5">
                        {role.key}
                      </p>
                      {role.description && (
                        <p className="text-xs text-brand-text-secondary mt-1">
                          {role.description}
                        </p>
                      )}
                    </div>
                  </label>
                )
              })}
            </div>
          </fieldset>

          {error && (
            <div
              className="rounded-brand border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mt-4"
              role="alert"
            >
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-brand border border-gray-300 bg-brand-background px-4 py-2 text-sm font-medium text-brand-text-primary hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Abbrechen
          </button>
          {!isCurrentUser && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending || !hasChanges}
              className="rounded-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              {isPending ? 'Wird gespeichert...' : 'Speichern'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
