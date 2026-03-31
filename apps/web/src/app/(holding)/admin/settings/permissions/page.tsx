import { requireHoldingAdmin } from '@/lib/permissions'
import { getPermissionMatrix } from './actions'
import { PermissionMatrixClient } from './permission-matrix-client'

export default async function PermissionsPage() {
  await requireHoldingAdmin()

  const matrix = await getPermissionMatrix()

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Berechtigungsmatrix</h1>
        <p className="text-gray-500 mt-1">
          Steuern Sie, welche Aktionen der Super User in Tochtergesellschaften
          ausfuehren darf. Plattform-Pflichtberechtigungen sind gesperrt.
        </p>
      </div>

      <PermissionMatrixClient initialMatrix={matrix} />
    </div>
  )
}
