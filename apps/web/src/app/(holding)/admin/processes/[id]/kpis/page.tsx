import Link from 'next/link'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { KpiEditorClient } from './kpi-editor-client'

interface KpiRow {
  id: string
  name: string
  description: string | null
  unit: string
  target_value: number | null
  warning_threshold: number | null
  critical_threshold: number | null
  visible_roles: string[]
  is_active: boolean
}

export default async function ProcessKpisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: processId } = await params
  const session = await getSession()
  if (!session?.isHoldingAdmin && !session?.isEnuraAdmin) {
    return <div className="p-8 text-center"><p className="text-gray-500">Kein Zugriff.</p></div>
  }

  const supabase = createSupabaseServerClient()

  const { data: process } = await supabase
    .from('process_definitions')
    .select('id, name, menu_label')
    .eq('id', processId)
    .single()

  if (!process) {
    return <div className="p-8 text-center"><p className="text-gray-500">Prozess nicht gefunden.</p></div>
  }

  const { data: kpis } = await supabase
    .from('process_kpi_definitions')
    .select('id, name, description, unit, target_value, warning_threshold, critical_threshold, visible_roles, is_active')
    .eq('process_id', processId)
    .eq('is_active', true)
    .order('sort_order')

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <Link href={`/admin/processes/${processId}`} className="text-sm text-gray-500 hover:text-gray-700">← Zurück zum Prozess</Link>
          <h1 className="text-2xl font-semibold text-gray-900">KPIs — {(process as Record<string, unknown>)['menu_label'] as string}</h1>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Definieren Sie messbare Kennzahlen für diesen Prozess. Legen Sie Schwellenwerte und Sichtbarkeit pro Rolle fest.
      </p>

      <KpiEditorClient
        processId={processId}
        initialKpis={(kpis ?? []) as KpiRow[]}
      />
    </div>
  )
}
