import Link from 'next/link'
import { getSession } from '@/lib/session'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { ProjectDetailTabs } from './project-detail-tabs'

export default async function ProjectDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params
  const sp = await searchParams
  const session = await getSession()
  if (!session?.companyId) {
    return <div className="p-8 text-center"><p className="text-gray-500">Nicht angemeldet.</p></div>
  }

  const db = createSupabaseServiceClient()

  // Fetch project
  const { data: project } = await db
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  if (!project) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 mb-4">Projekt nicht gefunden.</p>
        <Link href="/dashboard" className="text-blue-600 underline text-sm">← Zurück zum Dashboard</Link>
      </div>
    )
  }

  const p = project as Record<string, unknown>

  // Fetch related data in parallel
  const [leadRes, offerRes, phaseHistoryRes, processInstancesRes, liqEventsRes, incomingInvoicesRes, outgoingInvoicesRes, documentsRes, callsRes, calendarRes] = await Promise.all([
    p['lead_id'] ? db.from('leads').select('*').eq('id', p['lead_id'] as string).single() : Promise.resolve({ data: null }),
    p['offer_id'] ? db.from('offers').select('*').eq('id', p['offer_id'] as string).single() : Promise.resolve({ data: null }),
    db.from('project_phase_history').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    db.from('project_process_instances').select('id, process_id, process_version, started_at, completed_at, status').eq('project_id', id),
    db.from('liquidity_event_instances').select('id, step_name, process_step_id, direction, budget_amount, budget_date, actual_amount, actual_date, amount_deviation, marker_type, invoice_id').eq('project_id', id).order('budget_date'),
    db.from('invoices_incoming').select('id, invoice_number, sender_name, gross_amount, currency, status, due_date, created_at, raw_storage_path, raw_filename').eq('project_id', id).order('created_at', { ascending: false }),
    db.from('invoices').select('id, invoice_number, amount_chf, status, issued_at, paid_at').eq('project_id', id).order('issued_at', { ascending: false }),
    db.from('project_documents').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    db.from('calls').select('id, started_at, duration_seconds, direction, status, team_member_id, caller_number, callee_number').eq('project_id', id).order('started_at', { ascending: false }).limit(50),
    db.from('calendar_events').select('id, title, description, location, starts_at, ends_at, team_member_id, event_type').eq('project_id', id).order('starts_at', { ascending: false }).limit(50),
  ])

  // Compute financial summary
  const liqEvents = (liqEventsRes.data ?? []) as Array<Record<string, unknown>>
  const totalBudgetIncome = liqEvents.filter(e => e['direction'] === 'income').reduce((s, e) => s + Number(e['budget_amount'] ?? 0), 0)
  const totalBudgetExpense = liqEvents.filter(e => e['direction'] === 'expense').reduce((s, e) => s + Number(e['budget_amount'] ?? 0), 0)
  const totalActualIncome = liqEvents.filter(e => e['direction'] === 'income').reduce((s, e) => s + Number(e['actual_amount'] ?? 0), 0)
  const totalActualExpense = liqEvents.filter(e => e['direction'] === 'expense').reduce((s, e) => s + Number(e['actual_amount'] ?? 0), 0)

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Back link */}
      {sp['from'] ? (
        <Link
          href={`/dashboard?openProcess=${sp['from']}${sp['phase'] ? `&phase=${sp['phase']}` : ''}`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          ← Zurück zu {typeof sp['name'] === 'string' ? sp['name'] : 'Prozess'}
        </Link>
      ) : (
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          ← Zurück zum Prozesshaus
        </Link>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{p['title'] as string}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {p['customer_name'] as string}
            {p['address_city'] ? ` · ${p['address_city'] as string}` : ''}
            {p['address_street'] ? `, ${p['address_street'] as string}` : ''}
            {p['address_zip'] ? ` ${p['address_zip'] as string}` : ''}
          </p>
          {p['current_step_name'] ? (
            <p className="mt-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-0.5 text-xs font-semibold text-blue-700">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                {String(p['current_step_name'])}
              </span>
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
            p['status'] === 'active' ? 'bg-green-100 text-green-700' :
            p['status'] === 'completed' ? 'bg-gray-100 text-gray-600' :
            p['status'] === 'on_hold' ? 'bg-amber-100 text-amber-700' :
            'bg-red-100 text-red-700'
          }`}>
            {p['status'] as string}
          </span>
          {(p['project_value'] as number | null) && (
            <span className="text-lg font-bold text-gray-900">
              CHF {Number(p['project_value']).toLocaleString('de-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Budget Einnahmen</p>
          <p className="text-lg font-bold text-green-700">CHF {totalBudgetIncome.toLocaleString('de-CH', { minimumFractionDigits: 0 })}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Budget Ausgaben</p>
          <p className="text-lg font-bold text-red-600">CHF {totalBudgetExpense.toLocaleString('de-CH', { minimumFractionDigits: 0 })}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Ist Einnahmen</p>
          <p className="text-lg font-bold text-green-700">CHF {totalActualIncome.toLocaleString('de-CH', { minimumFractionDigits: 0 })}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Ist Ausgaben</p>
          <p className="text-lg font-bold text-red-600">CHF {totalActualExpense.toLocaleString('de-CH', { minimumFractionDigits: 0 })}</p>
        </div>
      </div>

      {/* Tabs */}
      <ProjectDetailTabs
        project={project as Record<string, unknown>}
        lead={leadRes.data as Record<string, unknown> | null}
        offer={offerRes.data as Record<string, unknown> | null}
        phaseHistory={(phaseHistoryRes.data ?? []) as Array<Record<string, unknown>>}
        processInstances={(processInstancesRes.data ?? []) as Array<Record<string, unknown>>}
        liqEvents={liqEvents}
        incomingInvoices={(incomingInvoicesRes.data ?? []) as Array<Record<string, unknown>>}
        outgoingInvoices={(outgoingInvoicesRes.data ?? []) as Array<Record<string, unknown>>}
        documents={(documentsRes.data ?? []) as Array<Record<string, unknown>>}
        calls={(callsRes.data ?? []) as Array<Record<string, unknown>>}
        calendarEvents={(calendarRes.data ?? []) as Array<Record<string, unknown>>}
      />
    </div>
  )
}
