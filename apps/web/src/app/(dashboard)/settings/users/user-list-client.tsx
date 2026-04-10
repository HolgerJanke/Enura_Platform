'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ProfileRow, RoleRow } from '@enura/types'
import { resetUserPasswordAction, toggleUserActiveAction } from './actions'
import { CreateUserModal } from './create-user-modal'
import { EditRolesPanel } from './edit-roles-panel'

type ProfileRoleJoin = {
  profile_id: string
  role_id: string
  roles: { id: string; key: string; label: string } | null
}

type Props = {
  profiles: ProfileRow[]
  roles: RoleRow[]
  profileRoles: ProfileRoleJoin[]
  currentUserId: string
}

type ConfirmAction = {
  type: 'reset_password' | 'toggle_active'
  userId: string
  userName: string
  active?: boolean
}

export function UserListClient({
  profiles,
  roles,
  profileRoles,
  currentUserId,
}: Props) {
  const router = useRouter()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editRolesProfile, setEditRolesProfile] = useState<ProfileRow | null>(
    null
  )
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const getRolesForProfile = useCallback(
    (profileId: string) => {
      return profileRoles
        .filter((pr) => pr.profile_id === profileId && pr.roles !== null)
        .map((pr) => pr.roles!)
    },
    [profileRoles]
  )

  const getRoleIdsForProfile = useCallback(
    (profileId: string) => {
      return profileRoles
        .filter((pr) => pr.profile_id === profileId)
        .map((pr) => pr.role_id)
    },
    [profileRoles]
  )

  const handleConfirmAction = useCallback(() => {
    if (!confirmAction) return
    setActionError(null)

    startTransition(async () => {
      let result: { error?: string; success?: boolean }

      if (confirmAction.type === 'reset_password') {
        result = await resetUserPasswordAction(confirmAction.userId)
      } else {
        result = await toggleUserActiveAction(
          confirmAction.userId,
          confirmAction.active ?? false
        )
      }

      if (result.error) {
        setActionError(result.error)
      } else {
        setConfirmAction(null)
        setActionError(null)
        router.refresh()
      }
    })
  }, [confirmAction, router])

  const handleSuccess = useCallback(() => {
    router.refresh()
  }, [router])

  const getStatusInfo = (
    profile: ProfileRow
  ): { label: string; classes: string } => {
    if (!profile.is_active) {
      return { label: 'Inaktiv', classes: 'bg-gray-100 text-gray-700' }
    }
    if (profile.must_reset_password) {
      return {
        label: 'Passwort ausstehend',
        classes: 'bg-yellow-100 text-yellow-700',
      }
    }
    if (!profile.totp_enabled) {
      return {
        label: '2FA ausstehend',
        classes: 'bg-orange-100 text-orange-700',
      }
    }
    return { label: 'Aktiv', classes: 'bg-green-100 text-green-700' }
  }

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '--'
    try {
      return new Intl.DateTimeFormat('de-CH', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(dateString))
    } catch {
      return '--'
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-brand-text-primary">
            Benutzerverwaltung
          </h1>
          <p className="text-brand-text-secondary mt-1">
            {profiles.length} Benutzer in diesem Unternehmen
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90"
          style={{ backgroundColor: 'var(--brand-primary)' }}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          Neuer Benutzer
        </button>
      </div>

      {/* Table */}
      <div className="bg-brand-surface rounded-brand border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-brand-text-secondary">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-brand-text-secondary">
                  E-Mail
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-brand-text-secondary">
                  Rollen
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-brand-text-secondary">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-brand-text-secondary">
                  Letzter Login
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-brand-text-secondary">
                  Aktionen
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {profiles.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-brand-text-secondary"
                  >
                    Noch keine Benutzer vorhanden.
                  </td>
                </tr>
              )}
              {profiles.map((profile) => {
                const userRoles = getRolesForProfile(profile.id)
                const status = getStatusInfo(profile)
                const isCurrentUser = profile.id === currentUserId
                const initials =
                  (profile.first_name?.charAt(0) ?? '') +
                  (profile.last_name?.charAt(0) ?? '')
                const displayName =
                  profile.first_name && profile.last_name
                    ? `${profile.first_name} ${profile.last_name}`
                    : profile.display_name

                return (
                  <tr
                    key={profile.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    {/* Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium text-white"
                          style={{
                            backgroundColor: profile.is_active
                              ? 'var(--brand-primary)'
                              : '#9CA3AF',
                          }}
                        >
                          {initials || '??'}
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-brand-text-primary block truncate">
                            {displayName}
                          </span>
                          {isCurrentUser && (
                            <span className="text-xs text-brand-text-secondary">
                              (Sie)
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Email — not stored in profiles table, shown as display_name fallback */}
                    <td className="px-4 py-3 text-sm text-brand-text-secondary">
                      {profile.display_name}
                    </td>

                    {/* Roles */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {userRoles.length === 0 && (
                          <span className="text-xs text-brand-text-secondary">
                            Keine Rolle
                          </span>
                        )}
                        {userRoles.map((role) => (
                          <span
                            key={role.id}
                            className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-brand-surface text-brand-text-primary border border-gray-200"
                          >
                            {role.label}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${status.classes}`}
                      >
                        {status.label}
                      </span>
                    </td>

                    {/* Last Login */}
                    <td className="px-4 py-3 text-sm text-brand-text-secondary">
                      {formatDate(profile.last_sign_in_at)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmAction({
                              type: 'reset_password',
                              userId: profile.id,
                              userName: displayName,
                            })
                          }
                          disabled={isPending}
                          className="rounded-brand px-2.5 py-1.5 text-xs font-medium text-brand-text-secondary hover:bg-gray-100 transition-colors disabled:opacity-50"
                          title="Passwort zurücksetzen"
                          aria-label={`Passwort zurücksetzen für ${displayName}`}
                        >
                          Passwort
                        </button>

                        <button
                          type="button"
                          onClick={() => setEditRolesProfile(profile)}
                          disabled={isPending}
                          className="rounded-brand px-2.5 py-1.5 text-xs font-medium text-brand-text-secondary hover:bg-gray-100 transition-colors disabled:opacity-50"
                          title="Rollen bearbeiten"
                          aria-label={`Rollen bearbeiten für ${displayName}`}
                        >
                          Rollen
                        </button>

                        {!isCurrentUser && (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmAction({
                                type: 'toggle_active',
                                userId: profile.id,
                                userName: displayName,
                                active: !profile.is_active,
                              })
                            }
                            disabled={isPending}
                            className={`rounded-brand px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                              profile.is_active
                                ? 'text-red-600 hover:bg-red-50'
                                : 'text-green-600 hover:bg-green-50'
                            }`}
                            title={
                              profile.is_active
                                ? 'Deaktivieren'
                                : 'Aktivieren'
                            }
                            aria-label={`${profile.is_active ? 'Deaktivieren' : 'Aktivieren'}: ${displayName}`}
                          >
                            {profile.is_active
                              ? 'Deaktivieren'
                              : 'Aktivieren'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create user modal */}
      <CreateUserModal
        roles={roles}
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleSuccess}
      />

      {/* Edit roles panel */}
      {editRolesProfile && (
        <EditRolesPanel
          profile={editRolesProfile}
          roles={roles}
          currentRoleIds={getRoleIdsForProfile(editRolesProfile.id)}
          isCurrentUser={editRolesProfile.id === currentUserId}
          open={editRolesProfile !== null}
          onClose={() => setEditRolesProfile(null)}
          onSuccess={handleSuccess}
        />
      )}

      {/* Confirmation dialog */}
      {confirmAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="alertdialog"
          aria-modal="true"
          aria-label="Aktion bestätigen"
        >
          <div
            className="absolute inset-0 bg-black/50 transition-opacity"
            onClick={() => {
              setConfirmAction(null)
              setActionError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setConfirmAction(null)
                setActionError(null)
              }
            }}
            role="button"
            tabIndex={-1}
            aria-label="Dialog schließen"
          />

          <div className="relative z-10 w-full max-w-sm rounded-brand bg-brand-background p-6 shadow-xl mx-4">
            <h3 className="text-lg font-semibold text-brand-text-primary mb-2">
              {confirmAction.type === 'reset_password'
                ? 'Passwort zurücksetzen'
                : confirmAction.active
                  ? 'Benutzer aktivieren'
                  : 'Benutzer deaktivieren'}
            </h3>
            <p className="text-sm text-brand-text-secondary mb-4">
              {confirmAction.type === 'reset_password' ? (
                <>
                  Das Passwort für{' '}
                  <strong className="text-brand-text-primary">
                    {confirmAction.userName}
                  </strong>{' '}
                  wird zurückgesetzt. Der Benutzer erhält ein temporäres
                  Passwort und muss sich erneut anmelden.
                </>
              ) : confirmAction.active ? (
                <>
                  <strong className="text-brand-text-primary">
                    {confirmAction.userName}
                  </strong>{' '}
                  wird wieder aktiviert und kann sich erneut anmelden.
                </>
              ) : (
                <>
                  <strong className="text-brand-text-primary">
                    {confirmAction.userName}
                  </strong>{' '}
                  wird deaktiviert und kann sich nicht mehr anmelden.
                </>
              )}
            </p>

            {actionError && (
              <div
                className="rounded-brand border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4"
                role="alert"
              >
                {actionError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setConfirmAction(null)
                  setActionError(null)
                }}
                disabled={isPending}
                className="rounded-brand border border-gray-300 bg-brand-background px-4 py-2 text-sm font-medium text-brand-text-primary hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={isPending}
                className={`rounded-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50 ${
                  confirmAction.type === 'toggle_active' &&
                  !confirmAction.active
                    ? 'bg-red-600'
                    : ''
                }`}
                style={
                  confirmAction.type === 'reset_password' ||
                  confirmAction.active
                    ? { backgroundColor: 'var(--brand-primary)' }
                    : undefined
                }
              >
                {isPending
                  ? 'Bitte warten...'
                  : confirmAction.type === 'reset_password'
                    ? 'Zurücksetzen'
                    : confirmAction.active
                      ? 'Aktivieren'
                      : 'Deaktivieren'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
