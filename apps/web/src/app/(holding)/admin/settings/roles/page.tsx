import Link from 'next/link'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getRolesWithPermissions } from './actions'
import { RolesMatrixClient } from './roles-matrix-client'

export default async function RolesPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>
}) {
  const session = await getSession()
  if (!session?.isHoldingAdmin && !session?.isEnuraAdmin) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Kein Zugriff.</p>
        <Link href="/dashboard" className="text-blue-600 underline text-sm mt-2 inline-block">Zum Dashboard</Link>
      </div>
    )
  }

  const supabase = createSupabaseServerClient()

  // Fetch companies for selector
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, slug')
    .eq('holding_id', session.holdingId ?? '')
    .eq('status', 'active')
    .order('name')

  const companyList = (companies ?? []) as Array<{ id: string; name: string; slug: string }>

  // Determine selected company
  const params = await searchParams
  const selectedCompanyId = params.company ?? companyList[0]?.id ?? null
  const selectedCompany = companyList.find((c) => c.id === selectedCompanyId)

  // Fetch roles + permissions for selected company
  let roles: Awaited<ReturnType<typeof getRolesWithPermissions>> | null = null
  if (selectedCompanyId) {
    roles = await getRolesWithPermissions(selectedCompanyId)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold text-gray-900">Rollen-Verwaltung</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Rollen erstellen und Berechtigungen pro Rolle zuweisen.
      </p>

      {/* Company selector */}
      {companyList.length > 1 && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Unternehmen</label>
          <div className="flex flex-wrap gap-2">
            {companyList.map((c) => (
              <Link
                key={c.id}
                href={`/admin/settings/roles?company=${c.id}`}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  c.id === selectedCompanyId
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Matrix */}
      {roles && selectedCompany ? (
        <RolesMatrixClient
          companyId={selectedCompanyId!}
          companyName={selectedCompany.name}
          initialRoles={roles.roles}
          permissions={roles.permissions}
        />
      ) : (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-500">Kein Unternehmen ausgewählt.</p>
        </div>
      )}
    </div>
  )
}
