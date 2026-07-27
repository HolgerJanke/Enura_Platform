'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { inviteUserToCompany, setUserCompanyAndRoles } from './actions'

export interface HoldingCompany {
  id: string
  name: string
}

export interface HoldingRole {
  id: string
  label: string
  companyId: string
}

export interface HoldingUser {
  id: string
  name: string
  companyId: string | null
  roleIds: string[]
}

interface Props {
  holdingId: string
  companies: HoldingCompany[]
  roles: HoldingRole[]
  users: HoldingUser[]
}

export function HoldingUsersManager({ holdingId, companies, roles, users }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  // Invite form state
  const [inviteCompanyId, setInviteCompanyId] = useState(companies[0]?.id ?? '')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteFirst, setInviteFirst] = useState('')
  const [inviteLast, setInviteLast] = useState('')
  const [inviteRoleId, setInviteRoleId] = useState('')

  const rolesFor = (companyId: string) => roles.filter((r) => r.companyId === companyId)
  const companyName = (id: string | null) => companies.find((c) => c.id === id)?.name ?? '—'

  function handleInvite() {
    setMessage(null)
    if (!inviteCompanyId || !inviteEmail || !inviteRoleId) {
      setMessage({ kind: 'error', text: 'Unternehmen, E-Mail und Rolle sind erforderlich.' })
      return
    }
    startTransition(async () => {
      const res = await inviteUserToCompany({
        holdingId,
        companyId: inviteCompanyId,
        email: inviteEmail.trim(),
        firstName: inviteFirst.trim(),
        lastName: inviteLast.trim(),
        roleId: inviteRoleId,
      })
      if (!res.success) {
        setMessage({ kind: 'error', text: res.error ?? 'Einladung fehlgeschlagen.' })
        return
      }
      setInviteEmail(''); setInviteFirst(''); setInviteLast(''); setInviteRoleId('')
      setMessage({
        kind: 'info',
        text: res.tempPassword
          ? `Benutzer erstellt. E-Mail nicht versendet — temporäres Passwort: ${res.tempPassword}`
          : 'Benutzer eingeladen — Zugangsdaten wurden per E-Mail versendet.',
      })
      router.refresh()
    })
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-900">Benutzer &amp; Rollen</h2>
      <p className="mt-1 text-sm text-gray-500">
        Laden Sie Benutzer in ein Unternehmen dieser Holding ein oder weisen Sie Unternehmen und
        Rollen neu zu.
      </p>

      {message && (
        <div
          className={`mt-4 rounded-lg border p-3 text-sm ${
            message.kind === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Invite */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <select
          aria-label="Unternehmen"
          value={inviteCompanyId}
          onChange={(e) => { setInviteCompanyId(e.target.value); setInviteRoleId('') }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <input
          aria-label="E-Mail" type="email" placeholder="E-Mail"
          value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          aria-label="Vorname" placeholder="Vorname"
          value={inviteFirst} onChange={(e) => setInviteFirst(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          aria-label="Nachname" placeholder="Nachname"
          value={inviteLast} onChange={(e) => setInviteLast(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          aria-label="Rolle"
          value={inviteRoleId}
          onChange={(e) => setInviteRoleId(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Rolle wählen…</option>
          {rolesFor(inviteCompanyId).map((r) => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleInvite}
          disabled={isPending}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Einladen
        </button>
      </div>

      {/* Existing users */}
      <div className="mt-8 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="py-2 pr-4 font-medium">Benutzer</th>
              <th className="py-2 pr-4 font-medium">Unternehmen</th>
              <th className="py-2 pr-4 font-medium">Rollen neu zuweisen</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                holdingId={holdingId}
                companies={companies}
                rolesFor={rolesFor}
                companyName={companyName}
                onError={(text) => setMessage({ kind: 'error', text })}
              />
            ))}
            {users.length === 0 && (
              <tr><td colSpan={3} className="py-4 text-center text-gray-400">Noch keine Benutzer.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function UserRow({
  user, holdingId, companies, rolesFor, companyName, onError,
}: {
  user: HoldingUser
  holdingId: string
  companies: HoldingCompany[]
  rolesFor: (companyId: string) => HoldingRole[]
  companyName: (id: string | null) => string
  onError: (text: string) => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [companyId, setCompanyId] = useState(user.companyId ?? companies[0]?.id ?? '')
  const [roleIds, setRoleIds] = useState<string[]>(user.roleIds)

  function toggleRole(id: string) {
    setRoleIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]))
  }

  function save() {
    startTransition(async () => {
      const res = await setUserCompanyAndRoles({ holdingId, profileId: user.id, companyId, roleIds })
      if (!res.success) { onError(res.error ?? 'Speichern fehlgeschlagen.'); return }
      router.refresh()
    })
  }

  const dirty = companyId !== (user.companyId ?? '') || roleIds.slice().sort().join() !== user.roleIds.slice().sort().join()

  return (
    <tr className="border-b border-gray-100 align-top">
      <td className="py-3 pr-4 font-medium text-gray-900">{user.name}</td>
      <td className="py-3 pr-4 text-gray-500">{companyName(user.companyId)}</td>
      <td className="py-3 pr-4">
        <select
          aria-label={`Unternehmen für ${user.name}`}
          value={companyId}
          onChange={(e) => { setCompanyId(e.target.value); setRoleIds([]) }}
          className="mb-2 block rounded-lg border border-gray-300 px-2 py-1 text-sm"
        >
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex flex-wrap gap-2">
          {rolesFor(companyId).map((r) => (
            <label key={r.id} className="inline-flex items-center gap-1 text-xs text-gray-700">
              <input type="checkbox" checked={roleIds.includes(r.id)} onChange={() => toggleRole(r.id)} />
              {r.label}
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={save}
          disabled={isPending || !dirty}
          className="mt-2 rounded-md bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-40"
        >
          Speichern
        </button>
      </td>
    </tr>
  )
}
