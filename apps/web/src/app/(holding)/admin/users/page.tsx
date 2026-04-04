import { requireHoldingAdmin } from '@/lib/permissions'
import { getAllUsers } from './actions'
import { UsersClient } from './users-client'

export default async function HoldingUsersPage() {
  const isAdmin = await requireHoldingAdmin()
  if (!isAdmin) return (<div className="p-8 text-center"><p className="text-gray-500">Kein Zugriff.</p><a href="/login" className="text-blue-600 underline">Zur Anmeldung</a></div>)

  let users: Awaited<ReturnType<typeof getAllUsers>>['users'] = []
  let invitations: Awaited<ReturnType<typeof getAllUsers>>['invitations'] = []
  try {
    const data = await getAllUsers()
    users = data.users
    invitations = data.invitations
  } catch {
    return (<div className="p-8 text-center"><p className="text-gray-500">Daten konnten nicht geladen werden.</p><a href="/admin" className="text-blue-600 underline">Zurueck</a></div>)
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Benutzerverwaltung</h1>
        <p className="text-gray-500 mt-1">
          Alle Benutzer ueber saemtliche Tochtergesellschaften hinweg verwalten.
          Einladungen versenden, Rollen zuweisen und 2FA zuruecksetzen.
        </p>
      </div>

      <UsersClient
        initialUsers={users}
        initialInvitations={invitations}
      />
    </div>
  )
}
