'use client'

import { useMemo, useState, useTransition } from 'react'
import { inviteUserToCompany, setUserCompanyAndRoles } from './actions'

interface Company {
  id: string
  name: string
}

interface Role {
  id: string
  company_id: string
  key: string
  label: string
}

interface User {
  id: string
  first_name: string | null
  last_name: string | null
  display_name: string
  company_id: string | null
  roleIds: string[]
}

interface Props {
  holdingId: string
  companies: Company[]
  users: User[]
  roles: Role[]
}

type Feedback = { type: 'success' | 'error'; message: string } | null
type TempPassword = { email: string; password: string } | null

function userName(u: User): string {
  return `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.display_name
}

export function HoldingUsersManager({ holdingId, companies, users, roles }: Props) {
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [tempPassword, setTempPassword] = useState<TempPassword>(null)

  // roles grouped by company for the row/invite selectors
  const rolesByCompany = useMemo(() => {
    const map = new Map<string, Role[]>()
    for (const r of roles) {
      const arr = map.get(r.company_id) ?? []
      arr.push(r)
      map.set(r.company_id, arr)
    }
    return map
  }, [roles])

  const companyName = useMemo(
    () => new Map(companies.map((c) => [c.id, c.name])),
    [companies],
  )

  // ---- Per-user editable state (company + roles) --------------------------
  const [edits, setEdits] = useState<Record<string, { companyId: string; roleIds: string[] }>>(
    () =>
      Object.fromEntries(
        users.map((u) => [u.id, { companyId: u.company_id ?? '', roleIds: [...u.roleIds] }]),
      ),
  )

  const original = useMemo(
    () =>
      Object.fromEntries(
        users.map((u) => [u.id, { companyId: u.company_id ?? '', roleIds: [...u.roleIds].sort() }]),
      ),
    [users],
  )

  function isDirty(userId: string): boolean {
    const e = edits[userId]
    const o = original[userId]
    if (!e || !o) return false
    if (e.companyId !== o.companyId) return true
    const a = [...e.roleIds].sort()
    return a.length !== o.roleIds.length || a.some((id, i) => id !== o.roleIds[i])
  }

  function setUserCompany(userId: string, companyId: string) {
    setEdits((prev) => {
      // When the company changes, drop roles that don't belong to the new company
      const valid = new Set((rolesByCompany.get(companyId) ?? []).map((r) => r.id))
      const keptRoles = (prev[userId]?.roleIds ?? []).filter((id) => valid.has(id))
      return { ...prev, [userId]: { companyId, roleIds: keptRoles } }
    })
  }

  function toggleUserRole(userId: string, roleId: string) {
    setEdits((prev) => {
      const cur = prev[userId] ?? { companyId: '', roleIds: [] }
      const has = cur.roleIds.includes(roleId)
      return {
        ...prev,
        [userId]: {
          ...cur,
          roleIds: has ? cur.roleIds.filter((id) => id !== roleId) : [...cur.roleIds, roleId],
        },
      }
    })
  }

  function saveUser(user: User) {
    const e = edits[user.id]
    if (!e || !e.companyId) {
      setFeedback({ type: 'error', message: 'Bitte ein Unternehmen wählen.' })
      return
    }
    startTransition(async () => {
      setFeedback(null)
      const result = await setUserCompanyAndRoles({
        holdingId,
        profileId: user.id,
        companyId: e.companyId,
        roleIds: e.roleIds,
      })
      setFeedback(
        result.success
          ? { type: 'success', message: `${userName(user)} aktualisiert.` }
          : { type: 'error', message: result.error ?? 'Fehler.' },
      )
    })
  }

  // ---- Invite form --------------------------------------------------------
  const [invite, setInvite] = useState({
    companyId: companies[0]?.id ?? '',
    firstName: '',
    lastName: '',
    email: '',
    roleId: '',
  })

  const inviteRoles = rolesByCompany.get(invite.companyId) ?? []

  const canInvite =
    invite.companyId.length > 0 &&
    invite.firstName.trim().length > 0 &&
    invite.lastName.trim().length > 0 &&
    invite.email.includes('@')

  function submitInvite() {
    if (!canInvite) return
    const invitedEmail = invite.email.trim().toLowerCase()
    startTransition(async () => {
      setFeedback(null)
      const result = await inviteUserToCompany({
        holdingId,
        companyId: invite.companyId,
        firstName: invite.firstName,
        lastName: invite.lastName,
        email: invite.email,
        roleId: invite.roleId || null,
      })
      if (result.success) {
        setFeedback({ type: 'success', message: `${invitedEmail} eingeladen. Seite neu laden, um den Benutzer zu sehen.` })
        setInvite((prev) => ({ ...prev, firstName: '', lastName: '', email: '', roleId: '' }))
        setTempPassword(result.tempPassword ? { email: invitedEmail, password: result.tempPassword } : null)
      } else {
        setFeedback({ type: 'error', message: result.error ?? 'Fehler.' })
      }
    })
  }

  const noCompanies = companies.length === 0

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-1 text-lg font-semibold text-gray-900">Benutzer &amp; Rollen</h2>
      <p className="mb-6 text-sm text-gray-500">
        Benutzer einem Unternehmen dieser Holding zuweisen und ihre Rollen festlegen.
      </p>

      {noCompanies ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            Diese Holding hat noch keine Unternehmen. Legen Sie zuerst ein Unternehmen an.
          </p>
        </div>
      ) : (
        <>
          {/* Invite new user */}
          <div className="mb-6 rounded-lg border border-gray-200 p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Benutzer einladen</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Unternehmen</label>
                <select
                  value={invite.companyId}
                  onChange={(e) => setInvite((prev) => ({ ...prev, companyId: e.target.value, roleId: '' }))}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  aria-label="Unternehmen"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Rolle</label>
                <select
                  value={invite.roleId}
                  onChange={(e) => setInvite((prev) => ({ ...prev, roleId: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  aria-label="Rolle"
                >
                  <option value="">Ohne Rolle</option>
                  {inviteRoles.map((r) => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Vorname</label>
                <input
                  type="text"
                  value={invite.firstName}
                  onChange={(e) => setInvite((prev) => ({ ...prev, firstName: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  aria-label="Vorname"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Nachname</label>
                <input
                  type="text"
                  value={invite.lastName}
                  onChange={(e) => setInvite((prev) => ({ ...prev, lastName: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  aria-label="Nachname"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-700">E-Mail</label>
                <input
                  type="email"
                  value={invite.email}
                  onChange={(e) => setInvite((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="benutzer@beispiel.ch"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  aria-label="E-Mail"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={isPending || !canInvite}
                onClick={submitInvite}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
              >
                {isPending ? 'Wird eingeladen...' : 'Einladen'}
              </button>
            </div>

            {tempPassword && (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">Temporäres Passwort</p>
                <p className="mt-1 text-xs text-amber-800">
                  Es wird noch keine E-Mail versendet. Geben Sie diese Zugangsdaten sicher an{' '}
                  <span className="font-medium">{tempPassword.email}</span> weiter — sie werden nur einmal angezeigt.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 rounded border border-amber-300 bg-white px-3 py-2 font-mono text-sm text-gray-900">
                    {tempPassword.password}
                  </code>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(tempPassword.password)}
                    className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-medium text-amber-800 hover:bg-amber-100"
                  >
                    Kopieren
                  </button>
                  <button
                    type="button"
                    onClick={() => setTempPassword(null)}
                    className="rounded-lg px-2 py-2 text-xs font-medium text-amber-700 hover:text-amber-900"
                    aria-label="Ausblenden"
                  >
                    Ausblenden
                  </button>
                </div>
                <p className="mt-2 text-xs text-amber-700">
                  Der Benutzer muss das Passwort beim ersten Login ändern und 2FA einrichten.
                </p>
              </div>
            )}
          </div>

          {/* Existing users */}
          {users.length === 0 ? (
            <p className="text-sm text-gray-500">Noch keine Benutzer in dieser Holding.</p>
          ) : (
            <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
              {users.map((user) => {
                const e = edits[user.id] ?? { companyId: '', roleIds: [] }
                const rowRoles = rolesByCompany.get(e.companyId) ?? []
                return (
                  <div key={user.id} className="px-4 py-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{userName(user)}</p>
                        <p className="text-xs text-gray-500">{user.display_name}</p>
                      </div>
                      <button
                        type="button"
                        disabled={isPending || !isDirty(user.id)}
                        onClick={() => saveUser(user)}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                      >
                        Speichern
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-700">Unternehmen</label>
                        <select
                          value={e.companyId}
                          onChange={(ev) => setUserCompany(user.id, ev.target.value)}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                          aria-label={`Unternehmen von ${userName(user)}`}
                        >
                          <option value="">Unternehmen wählen...</option>
                          {companies.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <span className="mb-1 block text-xs font-medium text-gray-700">Rollen</span>
                        {rowRoles.length === 0 ? (
                          <p className="text-xs text-gray-400">
                            {e.companyId ? 'Keine Rollen für dieses Unternehmen.' : 'Zuerst Unternehmen wählen.'}
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            {rowRoles.map((r) => (
                              <label key={r.id} className="flex items-center gap-1.5 text-sm text-gray-700">
                                <input
                                  type="checkbox"
                                  checked={e.roleIds.includes(r.id)}
                                  onChange={() => toggleUserRole(user.id, r.id)}
                                  className="h-4 w-4 rounded border-gray-300"
                                />
                                {r.label}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {user.company_id && user.company_id !== e.companyId && (
                      <p className="mt-2 text-xs text-amber-600">
                        Wird von {companyName.get(user.company_id) ?? 'einem anderen Unternehmen'} verschoben — bestehende Rollen werden ersetzt.
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {feedback && (
        <div
          className={`mt-4 rounded-lg p-3 text-sm ${
            feedback.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
          role="status"
        >
          {feedback.message}
        </div>
      )}
    </div>
  )
}
