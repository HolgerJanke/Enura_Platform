import { requireHoldingAdmin } from '@/lib/permissions'
import { getAllUsers } from './actions'
import { UsersClient } from './users-client'

export default async function HoldingUsersPage() {
  await requireHoldingAdmin()

  const { users, invitations } = await getAllUsers()

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
