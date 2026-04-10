import { requireHoldingAdmin } from '@/lib/permissions'
import { getPermissionMatrix } from './actions'
import { PermissionMatrixClient } from './permission-matrix-client'

export default async function PermissionsPage() {
  const isAdmin = await requireHoldingAdmin()
  if (!isAdmin) return (<div className="p-8 text-center"><p className="text-gray-500">Kein Zugriff.</p><a href="/login" className="text-blue-600 underline">Zur Anmeldung</a></div>)

  let matrix: Awaited<ReturnType<typeof getPermissionMatrix>> | null = null
  try {
    matrix = await getPermissionMatrix()
  } catch {
    return (<div className="p-8 text-center"><p className="text-gray-500">Berechtigungen konnten nicht geladen werden.</p><a href="/admin" className="text-blue-600 underline">Zurück</a></div>)
  }
  if (!matrix) return (<div className="p-8 text-center"><p className="text-gray-500">Keine Daten.</p></div>)

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Berechtigungsmatrix</h1>
        <p className="text-gray-500 mt-1">
          Steuern Sie, welche Aktionen der Super User in Tochtergesellschaften
          ausführen darf. Plattform-Pflichtberechtigungen sind gesperrt.
        </p>
      </div>

      <PermissionMatrixClient initialMatrix={matrix} />
    </div>
  )
}
