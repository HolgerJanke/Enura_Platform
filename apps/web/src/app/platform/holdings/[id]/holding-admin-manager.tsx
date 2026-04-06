'use client'

import { useState, useTransition } from 'react'
import { promoteToHoldingAdmin, removeHoldingAdmin } from './actions'

interface User {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  display_name: string
  company_id: string | null
}

interface Props {
  holdingId: string
  users: User[]
  adminProfileIds: string[]
}

export function HoldingAdminManager({ holdingId, users, adminProfileIds }: Props) {
  const [admins, setAdmins] = useState<Set<string>>(new Set(adminProfileIds))
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [selectedUserId, setSelectedUserId] = useState('')

  const adminUsers = users.filter((u) => admins.has(u.id))
  const nonAdminUsers = users.filter((u) => !admins.has(u.id))

  function handlePromote() {
    if (!selectedUserId) return
    const user = users.find((u) => u.id === selectedUserId)
    const userName = user ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.display_name : ''

    startTransition(async () => {
      setFeedback(null)
      const result = await promoteToHoldingAdmin(holdingId, selectedUserId)
      if (result.success) {
        setAdmins((prev) => new Set([...prev, selectedUserId]))
        setSelectedUserId('')
        setFeedback({ type: 'success', message: `${userName} zum Holding Admin ernannt.` })
      } else {
        setFeedback({ type: 'error', message: result.error ?? 'Fehler.' })
      }
    })
  }

  function handleRemove(profileId: string) {
    const user = users.find((u) => u.id === profileId)
    const userName = user ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.display_name : ''

    if (!confirm(`${userName} als Holding Admin entfernen?`)) return

    startTransition(async () => {
      setFeedback(null)
      const result = await removeHoldingAdmin(holdingId, profileId)
      if (result.success) {
        setAdmins((prev) => { const next = new Set(prev); next.delete(profileId); return next })
        setFeedback({ type: 'success', message: `${userName} als Holding Admin entfernt.` })
      } else {
        setFeedback({ type: 'error', message: result.error ?? 'Fehler.' })
      }
    })
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Holding-Administratoren</h2>
      <p className="text-sm text-gray-500 mb-6">
        Holding Admins koennen Unternehmen, Benutzer, Prozesse und Module innerhalb dieser Holding verwalten.
      </p>

      {/* Current admins */}
      {adminUsers.length === 0 ? (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 mb-6">
          <p className="text-sm text-amber-800">
            Kein Holding Admin zugewiesen. Ernennen Sie einen Benutzer unten.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 mb-6">
          {adminUsers.map((user) => (
            <div key={user.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {user.first_name ?? ''} {user.last_name ?? ''}
                  {!user.first_name && !user.last_name && user.display_name}
                </p>
                <p className="text-xs text-gray-500">{user.email ?? '—'}</p>
              </div>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleRemove(user.id)}
                className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                Entfernen
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Promote new admin */}
      {nonAdminUsers.length > 0 && (
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Benutzer zum Holding Admin ernennen
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Benutzer auswaehlen...</option>
              {nonAdminUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.first_name ?? ''} {user.last_name ?? ''} ({user.email ?? '—'})
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={isPending || !selectedUserId}
            onClick={handlePromote}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Wird ernannt...' : 'Ernennen'}
          </button>
        </div>
      )}

      {feedback && (
        <div className={`mt-4 rounded-lg p-3 text-sm ${
          feedback.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {feedback.message}
        </div>
      )}
    </div>
  )
}
