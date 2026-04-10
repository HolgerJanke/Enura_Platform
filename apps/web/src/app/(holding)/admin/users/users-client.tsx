'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  deactivateUser,
  reactivateUser,
  resetUser2fa,
  resendInvitation,
  revokeInvitation,
  updateUserRolesFromHolding,
  getCompanyRoles,
  type UserWithCompany,
  type PendingInvitation,
} from './actions'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type UsersClientProps = {
  initialUsers: UserWithCompany[]
  initialInvitations: PendingInvitation[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UsersClient({ initialUsers, initialInvitations }: UsersClientProps) {
  const [users] = useState(initialUsers)
  const [invitations] = useState(initialInvitations)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [confirmAction, setConfirmAction] = useState<{
    type: 'deactivate' | 'reactivate' | '2fa_reset' | 'revoke'
    id: string
    label: string
  } | null>(null)

  // Role editing state
  const [roleEditUser, setRoleEditUser] = useState<UserWithCompany | null>(null)
  const [availableRoles, setAvailableRoles] = useState<Array<{ id: string; key: string; label: string; description: string | null }>>([])
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set())
  const [roleEditLoading, setRoleEditLoading] = useState(false)

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase()
    if (!q) return true
    const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ').toLowerCase()
    return (
      fullName.includes(q) ||
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.companyName ?? '').toLowerCase().includes(q) ||
      u.roles.some((r) => r.toLowerCase().includes(q))
    )
  })

  function runAction(action: () => Promise<{ success: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action()
      if (result.success) {
        setFeedback({ type: 'success', message: 'Aktion erfolgreich ausgeführt.' })
      } else {
        setFeedback({ type: 'error', message: result.error ?? 'Unbekannter Fehler.' })
      }
      setConfirmAction(null)
    })
  }

  function handleConfirm() {
    if (!confirmAction) return
    switch (confirmAction.type) {
      case 'deactivate':
        runAction(() => deactivateUser(confirmAction.id))
        break
      case 'reactivate':
        runAction(() => reactivateUser(confirmAction.id))
        break
      case '2fa_reset':
        runAction(() => resetUser2fa(confirmAction.id))
        break
      case 'revoke':
        runAction(() => revokeInvitation(confirmAction.id))
        break
    }
  }

  async function openRoleEditor(user: UserWithCompany) {
    if (!user.companyId) return
    setRoleEditUser(user)
    setRoleEditLoading(true)
    try {
      const roles = await getCompanyRoles(user.companyId)
      setAvailableRoles(roles)
      // Set current roles by matching role labels to role IDs
      const currentIds = new Set(
        roles.filter((r) => user.roles.includes(r.label) || user.roles.includes(r.key)).map((r) => r.id),
      )
      setSelectedRoleIds(currentIds)
    } catch {
      setFeedback({ type: 'error', message: 'Rollen konnten nicht geladen werden.' })
      setRoleEditUser(null)
    }
    setRoleEditLoading(false)
  }

  function toggleRole(roleId: string) {
    setSelectedRoleIds((prev) => {
      const next = new Set(prev)
      if (next.has(roleId)) next.delete(roleId)
      else next.add(roleId)
      return next
    })
  }

  function saveRoles() {
    if (!roleEditUser?.companyId) return
    const userId = roleEditUser.id
    const companyId = roleEditUser.companyId
    startTransition(async () => {
      const result = await updateUserRolesFromHolding(userId, companyId, [...selectedRoleIds])
      if (result.success) {
        setFeedback({ type: 'success', message: `Rollen für ${roleEditUser.displayName} aktualisiert.` })
      } else {
        setFeedback({ type: 'error', message: result.error ?? 'Fehler beim Speichern.' })
      }
      setRoleEditUser(null)
    })
  }

  return (
    <div>
      {/* Feedback */}
      {feedback && (
        <div
          className={`mb-6 rounded-lg border p-4 ${
            feedback.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          <p className="text-sm">{feedback.message}</p>
        </div>
      )}

      {/* Confirm dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Bestätigung</h3>
            <p className="mt-2 text-sm text-gray-600">
              Sind Sie sicher, dass Sie diese Aktion ausführen möchten?
              <br />
              <span className="font-medium">{confirmAction.label}</span>
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                aria-label="Abbrechen"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:bg-gray-300"
                aria-label="Bestätigen"
              >
                {isPending ? 'Wird ausgeführt...' : 'Bestätigen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search & invite button */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Suche nach Name, E-Mail, Unternehmen oder Rolle..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            aria-label="Benutzer suchen"
          />
        </div>
        <Link
          href="/admin/users/invite"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Benutzer einladen
        </Link>
      </div>

      {/* Users table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            Alle Benutzer ({filteredUsers.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">E-Mail</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Unternehmen</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Rollen</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Letzter Login</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    {searchQuery ? 'Keine Benutzer gefunden.' : 'Keine Benutzer vorhanden.'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const initials = [user.firstName, user.lastName]
                    .filter(Boolean)
                    .map((n) => n!.charAt(0).toUpperCase())
                    .join('')

                  return (
                    <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700">
                            {initials || 'U'}
                          </div>
                          <span className="font-medium text-gray-900">
                            {user.firstName && user.lastName
                              ? `${user.firstName} ${user.lastName}`
                              : user.displayName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{user.email}</td>
                      <td className="px-4 py-3 text-gray-500">{user.companyName ?? '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {user.roles.length > 0 ? (
                            user.roles.map((role) => (
                              <span
                                key={role}
                                className="inline-flex rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700"
                              >
                                {role}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400">Keine Rolle</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            user.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {user.isActive ? 'Aktiv' : 'Deaktiviert'}
                        </span>
                        {!user.totpEnabled && user.isActive && (
                          <span className="ml-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            Kein 2FA
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {user.lastSignInAt ? formatDate(user.lastSignInAt) : 'Noch nie'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {user.companyId && (
                            <button
                              type="button"
                              onClick={() => openRoleEditor(user)}
                              className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                              aria-label={`Rollen für ${user.displayName} bearbeiten`}
                            >
                              Rollen
                            </button>
                          )}
                          {user.isActive ? (
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmAction({
                                  type: 'deactivate',
                                  id: user.id,
                                  label: `Benutzer "${user.displayName}" deaktivieren`,
                                })
                              }
                              className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                              aria-label={`${user.displayName} deaktivieren`}
                            >
                              Deaktivieren
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmAction({
                                  type: 'reactivate',
                                  id: user.id,
                                  label: `Benutzer "${user.displayName}" reaktivieren`,
                                })
                              }
                              className="rounded px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-50 transition-colors"
                              aria-label={`${user.displayName} reaktivieren`}
                            >
                              Reaktivieren
                            </button>
                          )}
                          {user.totpEnabled && (
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmAction({
                                  type: '2fa_reset',
                                  id: user.id,
                                  label: `2FA für "${user.displayName}" zurücksetzen`,
                                })
                              }
                              className="rounded px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50 transition-colors"
                              aria-label={`2FA für ${user.displayName} zurücksetzen`}
                            >
                              2FA Reset
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div className="mt-8">
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">
                Ausstehende Einladungen ({invitations.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-left font-medium text-gray-500">E-Mail</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Unternehmen</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Rolle</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Eingeladen am</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Läuft ab</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Eingeladen von</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invitations.map((inv) => {
                    const isExpired = new Date(inv.expiresAt) < new Date()

                    return (
                      <tr key={inv.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-medium text-gray-900">{inv.email}</td>
                        <td className="px-4 py-3 text-gray-500">{inv.companyName}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                            {inv.roleLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{formatDate(inv.invitedAt)}</td>
                        <td className="px-4 py-3">
                          <span className={isExpired ? 'text-red-600 font-medium' : 'text-gray-500'}>
                            {formatDate(inv.expiresAt)}
                            {isExpired && ' (abgelaufen)'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{inv.invitedByName}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                startTransition(async () => {
                                  const result = await resendInvitation(inv.id)
                                  setFeedback(
                                    result.success
                                      ? { type: 'success', message: 'Einladung erneut gesendet.' }
                                      : { type: 'error', message: result.error ?? 'Fehler.' },
                                  )
                                })
                              }}
                              disabled={isPending}
                              className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                              aria-label={`Einladung für ${inv.email} erneut senden`}
                            >
                              Erneut senden
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmAction({
                                  type: 'revoke',
                                  id: inv.id,
                                  label: `Einladung für "${inv.email}" widerrufen`,
                                })
                              }
                              className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                              aria-label={`Einladung für ${inv.email} widerrufen`}
                            >
                              Widerrufen
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Role edit modal */}
      {roleEditUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              Rollen bearbeiten
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {roleEditUser.firstName} {roleEditUser.lastName} — {roleEditUser.companyName}
            </p>

            {roleEditLoading ? (
              <p className="text-sm text-gray-500 py-4">Rollen werden geladen...</p>
            ) : (
              <fieldset className="space-y-2 max-h-80 overflow-y-auto">
                {availableRoles.map((role) => (
                  <label
                    key={role.id}
                    className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRoleIds.has(role.id)}
                      onChange={() => toggleRole(role.id)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{role.label}</p>
                      <p className="text-xs text-gray-500">{role.key}</p>
                      {role.description && (
                        <p className="text-xs text-gray-400 mt-0.5">{role.description}</p>
                      )}
                    </div>
                  </label>
                ))}
              </fieldset>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setRoleEditUser(null)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={isPending || selectedRoleIds.size === 0}
                onClick={saveRoles}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isPending ? 'Wird gespeichert...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
