export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getSession } from '@/lib/session'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { ProcessHouseEditorClient } from './house-editor-client'

interface ProcessRow {
  id: string
  name: string
  menu_label: string
  process_type: string | null
  house_sort_order: number
  status: string
}

export default async function ProcessHouseEditorPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>
}) {
  const session = await getSession()
  if (!session?.isHoldingAdmin && !session?.isEnuraAdmin) {
    return <div className="p-8 text-center"><p className="text-gray-500">Kein Zugriff.</p></div>
  }

  const supabase = createSupabaseServiceClient()
  const params = await searchParams

  // Fetch companies
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name')
    .eq('holding_id', session.holdingId ?? '')
    .eq('status', 'active')
    .order('name')

  const companyList = (companies ?? []) as Array<{ id: string; name: string }>
  const selectedCompanyId = params.company ?? companyList[0]?.id ?? null

  // Fetch all processes for selected company
  let processes: ProcessRow[] = []
  if (selectedCompanyId) {
    const { data, error: queryError } = await supabase
      .from('process_definitions')
      .select('id, name, menu_label, process_type, house_sort_order, status')
      .eq('company_id', selectedCompanyId)
      .order('house_sort_order')

    if (queryError) {
      console.error('[process-house] Query error:', queryError.message)
    }
    console.log('[process-house] Company:', selectedCompanyId, 'Results:', (data ?? []).length)
    processes = (data ?? []) as ProcessRow[]
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold text-gray-900">Prozesshaus-Editor</h1>
        <Link href="/admin/processes" className="text-sm text-gray-500 hover:text-gray-700">← Zurück zu Prozesse</Link>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Prozesse dem Prozesshaus zuordnen und per Drag-and-Drop sortieren.
      </p>

      {/* Company selector */}
      {companyList.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {companyList.map((c) => (
            <Link
              key={c.id}
              href={`/admin/processes/house?company=${c.id}`}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                c.id === selectedCompanyId ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}

      {selectedCompanyId ? (
        <ProcessHouseEditorClient companyId={selectedCompanyId} processes={processes} />
      ) : (
        <p className="text-sm text-gray-500">Kein Unternehmen ausgewählt.</p>
      )}
    </div>
  )
}
