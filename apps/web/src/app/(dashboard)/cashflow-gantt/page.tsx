export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getSession } from '@/lib/session'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { GanttClient } from './gantt-client'

export default async function CashflowGanttPage() {
  const session = await getSession()
  if (!session?.companyId) {
    return <div className="p-8 text-center"><p className="text-gray-500">Nicht angemeldet.</p></div>
  }

  const db = createSupabaseServiceClient()

  // Fetch active projects with their liquidity events
  const [projectsRes, eventsRes, currencyRes] = await Promise.all([
    db.from('projects')
      .select('id, title, customer_name, address_city, project_value, status')
      .eq('company_id', session.companyId)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
    db.from('liquidity_event_instances')
      .select('id, project_id, step_name, direction, budget_amount, budget_date, scheduled_amount, scheduled_date, actual_amount, actual_date, marker_type, invoice_id')
      .eq('company_id', session.companyId)
      .order('budget_date'),
    db.from('company_currency_settings')
      .select('base_currency')
      .eq('company_id', session.companyId)
      .single(),
  ])

  const projects = (projectsRes.data ?? []) as Array<{
    id: string; title: string; customer_name: string; address_city: string | null
    project_value: number | null; status: string
  }>

  const events = (eventsRes.data ?? []) as Array<{
    id: string; project_id: string; step_name: string; direction: string
    budget_amount: number | null; budget_date: string | null
    scheduled_amount: number | null; scheduled_date: string | null
    actual_amount: number | null; actual_date: string | null
    marker_type: string; invoice_id: string | null
  }>

  const currency = (currencyRes.data as Record<string, unknown> | null)?.['base_currency'] as string ?? 'CHF'

  // Filter projects that have events
  const projectIdsWithEvents = new Set(events.map(e => e.project_id))
  const activeProjects = projects.filter(p => projectIdsWithEvents.has(p.id))

  return (
    <div className="p-6">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        ← Zurück zum Prozesshaus
      </Link>
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Projekt Cashflow</h1>
      <p className="text-sm text-gray-500 mb-6">
        Cashflow-Timeline aller aktiven Projekte — {activeProjects.length} Projekte, {events.length} Zahlungsereignisse.
      </p>

      <GanttClient projects={activeProjects} events={events} currency={currency} />
    </div>
  )
}
