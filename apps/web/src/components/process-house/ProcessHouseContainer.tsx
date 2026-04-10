import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ProcessHouseClientWrapper } from './ProcessHouseClientWrapper'

interface ProcessRow {
  id: string
  name: string
  menu_label: string
  process_type: string | null
  house_sort_order: number
  status: string
  visible_roles: string[]
}

export async function ProcessHouseContainer() {
  const session = await getSession()
  if (!session?.companyId) return null

  const supabase = createSupabaseServerClient()

  const { data } = await supabase
    .from('process_definitions')
    .select('id, name, menu_label, process_type, house_sort_order, status, visible_roles')
    .eq('company_id', session.companyId)
    .eq('status', 'deployed')
    .not('process_type', 'is', null)
    .order('house_sort_order')

  const processes = (data ?? []) as ProcessRow[]

  // Filter by visible_roles
  const userRoleKeys = session.roles.map((r) => r.key)
  const visible = processes.filter((p) => {
    if (session.isHoldingAdmin || session.isEnuraAdmin) return true
    if (p.visible_roles.length === 0) return true
    return p.visible_roles.some((r) => userRoleKeys.includes(r))
  })

  const toItem = (p: ProcessRow) => ({
    id: p.id,
    name: p.name,
    menuLabel: p.menu_label,
    houseSortOrder: p.house_sort_order,
    status: p.status,
  })

  const management = visible.filter((p) => p.process_type === 'M').map(toItem)
  const primary = visible.filter((p) => p.process_type === 'P').map(toItem)
  const support = visible.filter((p) => p.process_type === 'S').map(toItem)

  if (management.length === 0 && primary.length === 0 && support.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <p className="text-sm text-gray-500 mb-1">Noch kein Prozesshaus konfiguriert.</p>
        <p className="text-xs text-gray-400">Weisen Sie Prozessen einen Typ (M/P/S) zu, um das Prozesshaus zu erstellen.</p>
      </div>
    )
  }

  return (
    <ProcessHouseClientWrapper
      management={management}
      primary={primary}
      support={support}
    />
  )
}
