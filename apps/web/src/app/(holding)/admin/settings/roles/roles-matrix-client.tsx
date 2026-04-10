'use client'

import { useState, useTransition, useCallback } from 'react'
import {
  updateRolePermissions,
  createCustomRole,
  deleteCustomRole,
  type RoleWithPermissions,
  type PermissionItem,
} from './actions'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  companyId: string
  companyName: string
  initialRoles: RoleWithPermissions[]
  permissions: PermissionItem[]
}

const GROUP_LABELS: Record<string, string> = {
  setter: 'Setter',
  berater: 'Berater',
  leads: 'Leads',
  innendienst: 'Innendienst',
  bau: 'Bau / Montage',
  finance: 'Finanzen',
  reports: 'Berichte',
  ai: 'KI',
  admin: 'Administration',
  finanzplanung: 'Finanzplanung',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RolesMatrixClient({ companyId, companyName, initialRoles, permissions }: Props) {
  const [roles, setRoles] = useState(initialRoles)
  const [matrix, setMatrix] = useState(() => {
    const m = new Map<string, Set<string>>()
    for (const role of initialRoles) {
      m.set(role.id, new Set(role.permissionIds))
    }
    return m
  })
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [showNewRole, setShowNewRole] = useState(false)
  const [newRoleKey, setNewRoleKey] = useState('')
  const [newRoleLabel, setNewRoleLabel] = useState('')
  const [newRoleDesc, setNewRoleDesc] = useState('')
  const [hasChanges, setHasChanges] = useState(false)

  // Group permissions by module
  const groups = new Map<string, PermissionItem[]>()
  for (const perm of permissions) {
    const arr = groups.get(perm.group) ?? []
    arr.push(perm)
    groups.set(perm.group, arr)
  }

  const togglePermission = useCallback((roleId: string, permId: string) => {
    setMatrix((prev) => {
      const next = new Map(prev)
      const perms = new Set(next.get(roleId) ?? [])
      if (perms.has(permId)) perms.delete(permId)
      else perms.add(permId)
      next.set(roleId, perms)
      return next
    })
    setHasChanges(true)
  }, [])

  function saveAll() {
    startTransition(async () => {
      setFeedback(null)
      let errors = 0
      for (const role of roles) {
        if (role.key === 'super_user') continue
        const permIds = [...(matrix.get(role.id) ?? [])]
        const result = await updateRolePermissions(role.id, permIds)
        if (!result.success) errors++
      }
      if (errors === 0) {
        setFeedback({ type: 'success', message: 'Alle Änderungen gespeichert.' })
        setHasChanges(false)
      } else {
        setFeedback({ type: 'error', message: `${errors} Rolle(n) konnten nicht gespeichert werden.` })
      }
    })
  }

  function handleCreateRole() {
    if (!newRoleKey || !newRoleLabel) return
    startTransition(async () => {
      setFeedback(null)
      const result = await createCustomRole(companyId, newRoleKey, newRoleLabel, newRoleDesc, [])
      if (result.success && result.roleId) {
        const newRole: RoleWithPermissions = {
          id: result.roleId,
          key: newRoleKey.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
          label: newRoleLabel,
          description: newRoleDesc || null,
          isSystem: false,
          permissionIds: [],
        }
        setRoles((prev) => [...prev, newRole])
        setMatrix((prev) => { const next = new Map(prev); next.set(newRole.id, new Set()); return next })
        setNewRoleKey('')
        setNewRoleLabel('')
        setNewRoleDesc('')
        setShowNewRole(false)
        setFeedback({ type: 'success', message: `Rolle "${newRoleLabel}" erstellt.` })
      } else {
        setFeedback({ type: 'error', message: result.error ?? 'Fehler beim Erstellen.' })
      }
    })
  }

  function handleDeleteRole(roleId: string) {
    const role = roles.find((r) => r.id === roleId)
    if (!role || role.isSystem) return
    if (!confirm(`Rolle "${role.label}" löschen? Alle Zuweisungen werden entfernt.`)) return

    startTransition(async () => {
      const result = await deleteCustomRole(roleId)
      if (result.success) {
        setRoles((prev) => prev.filter((r) => r.id !== roleId))
        setMatrix((prev) => { const next = new Map(prev); next.delete(roleId); return next })
        setFeedback({ type: 'success', message: `Rolle "${role.label}" gelöscht.` })
      } else {
        setFeedback({ type: 'error', message: result.error ?? 'Fehler.' })
      }
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Berechtigungsmatrix — {companyName}</h2>
          <p className="text-sm text-gray-500">Berechtigungen pro Rolle zuweisen oder entziehen.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowNewRole(true)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            + Neue Rolle
          </button>
          <button
            type="button"
            disabled={isPending || !hasChanges}
            onClick={saveAll}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Wird gespeichert...' : 'Speichern'}
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`mb-4 rounded-lg p-3 text-sm ${
          feedback.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {feedback.message}
        </div>
      )}

      {/* New role form */}
      {showNewRole && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Neue Rolle erstellen</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Schlüssel (key)</label>
              <input
                type="text"
                value={newRoleKey}
                onChange={(e) => setNewRoleKey(e.target.value)}
                placeholder="z.B. projektleiter"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Bezeichnung</label>
              <input
                type="text"
                value={newRoleLabel}
                onChange={(e) => setNewRoleLabel(e.target.value)}
                placeholder="z.B. Projektleiter"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Beschreibung</label>
              <input
                type="text"
                value={newRoleDesc}
                onChange={(e) => setNewRoleDesc(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isPending || !newRoleKey || !newRoleLabel}
              onClick={handleCreateRole}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Erstellen
            </button>
            <button
              type="button"
              onClick={() => setShowNewRole(false)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Permission matrix table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="sticky left-0 bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 min-w-[200px] z-10">
                Berechtigung
              </th>
              {roles.map((role) => (
                <th key={role.id} className="px-3 py-3 text-center text-xs font-semibold text-gray-700 min-w-[100px]">
                  <div className="flex flex-col items-center gap-1">
                    <span>{role.label}</span>
                    {role.key === 'super_user' && (
                      <span className="text-[10px] text-gray-400">Alle Rechte</span>
                    )}
                    {!role.isSystem && (
                      <button
                        type="button"
                        onClick={() => handleDeleteRole(role.id)}
                        className="text-[10px] text-red-500 hover:text-red-700"
                        aria-label={`Rolle ${role.label} löschen`}
                      >
                        Löschen
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {[...groups.entries()].map(([group, perms]) => (
              <>
                {/* Group header */}
                <tr key={`group-${group}`}>
                  <td
                    colSpan={roles.length + 1}
                    className="sticky left-0 bg-gray-100 px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-600"
                  >
                    {GROUP_LABELS[group] ?? group}
                  </td>
                </tr>
                {/* Permission rows */}
                {perms.map((perm) => (
                  <tr key={perm.id} className="hover:bg-gray-50/50">
                    <td className="sticky left-0 bg-white px-4 py-2.5 z-10">
                      <p className="text-sm text-gray-900">{perm.label}</p>
                      <p className="text-xs text-gray-400">{perm.key}</p>
                    </td>
                    {roles.map((role) => {
                      const isSuperUser = role.key === 'super_user'
                      const isChecked = isSuperUser || (matrix.get(role.id)?.has(perm.id) ?? false)

                      return (
                        <td key={`${role.id}-${perm.id}`} className="px-3 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isSuperUser}
                            onChange={() => togglePermission(role.id, perm.id)}
                            className={`h-4 w-4 rounded border-gray-300 transition-colors ${
                              isSuperUser
                                ? 'text-gray-400 cursor-not-allowed'
                                : 'text-blue-600 cursor-pointer'
                            }`}
                            aria-label={`${perm.label} für ${role.label}`}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
