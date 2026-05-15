export const dynamic = 'force-dynamic'

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
  const [leadRes, offerRes, phaseHistoryRes, processInstancesRes, liqEventsRes, incomingInvoicesRes, outgoingInvoicesRes, documentsRes, callsRes, calendarRes, beraterRes, setterRes] = await Promise.all([
    p['lead_id'] ? db.from('leads').select('*').eq('id', p['lead_id'] as string).single() : Promise.resolve({ data: null }),
    p['offer_id'] ? db.from('offers').select('*').eq('id', p['offer_id'] as string).single() : Promise.resolve({ data: null }),
    db.from('project_phase_history').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    db.from('project_process_instances').select('id, process_id, process_version, started_at, completed_at, status').eq('project_id', id),
    db.from('liquidity_event_instances').select('id, step_name, process_step_id, direction, budget_amount, budget_date, scheduled_amount, scheduled_date, actual_amount, actual_date, amount_deviation, marker_type, invoice_id').eq('project_id', id).eq('marker_type', 'event').order('budget_date'),
    db.from('invoices_incoming').select('id, invoice_number, sender_name, gross_amount, currency, status, due_date, created_at, raw_storage_path, raw_filename').eq('project_id', id).order('created_at', { ascending: false }),
    db.from('invoices').select('id, invoice_number, amount_chf, status, issued_at, paid_at').eq('project_id', id).order('issued_at', { ascending: false }),
    db.from('project_documents').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    db.from('calls').select('id, started_at, duration_seconds, direction, status, team_member_id, caller_number, callee_number').eq('project_id', id).order('started_at', { ascending: false }).limit(50),
    db.from('calendar_events').select('id, title, description, location, starts_at, ends_at, team_member_id, event_type').eq('project_id', id).order('starts_at', { ascending: false }).limit(50),
    p['berater_id'] ? db.from('team_members').select('id, first_name, last_name, email, phone, role').eq('id', p['berater_id'] as string).single() : Promise.resolve({ data: null }),
    p['setter_id'] ? db.from('team_members').select('id, first_name, last_name, email, phone, role').eq('id', p['setter_id'] as string).single() : Promise.resolve({ data: null }),
  ])

  // Compute financial events — use real liquidity events, or generate from offer/invoice data
  const realLiqEvents = (liqEventsRes.data ?? []) as Array<Record<string, unknown>>
  const offerRaw = offerRes.data as Record<string, unknown> | null
  const outInvoices = (outgoingInvoicesRes.data ?? []) as Array<Record<string, unknown>>
  const inInvoices = (incomingInvoicesRes.data ?? []) as Array<Record<string, unknown>>

  // Generate synthetic financial events from integration data when no real liq events exist
  let liqEvents: Array<Record<string, unknown>>
  if (realLiqEvents.length > 0) {
    liqEvents = realLiqEvents
  } else {
    const syntheticEvents: Array<Record<string, unknown>> = []

    // 1) Offer = budget income (Kundenauftrag)
    if (offerRaw && Number(offerRaw['amount_chf'] ?? 0) > 0) {
      const isWon = offerRaw['status'] === 'won'
      syntheticEvents.push({
        id: `syn-offer-${offerRaw['id']}`,
        step_name: 'Kundenauftrag (Angebot)',
        direction: 'income',
        budget_amount: Number(offerRaw['amount_chf']),
        budget_date: (offerRaw['sent_at'] ?? offerRaw['created_at']) as string,
        actual_amount: isWon ? Number(offerRaw['amount_chf']) : null,
        actual_date: isWon ? (offerRaw['updated_at'] ?? offerRaw['created_at']) as string : null,
        amount_deviation: isWon ? 0 : null,
        marker_type: 'event',
        _synthetic: true,
      })
    }

    // 2) Outgoing invoices (Kundenrechnungen) = actual income
    for (const inv of outInvoices) {
      const amt = Number(inv['amount_chf'] ?? 0)
      if (amt > 0) {
        syntheticEvents.push({
          id: `syn-inv-out-${inv['id']}`,
          step_name: `Kundenrechnung ${inv['invoice_number'] ?? ''}`.trim(),
          direction: 'income',
          budget_amount: amt,
          budget_date: (inv['issued_at'] ?? inv['created_at']) as string,
          actual_amount: inv['paid_at'] ? amt : null,
          actual_date: inv['paid_at'] as string | null,
          amount_deviation: inv['paid_at'] ? 0 : null,
          marker_type: 'event',
          _synthetic: true,
        })
      }
    }

    // 3) Incoming invoices (Lieferantenrechnungen) = expenses
    for (const inv of inInvoices) {
      const amt = Number(inv['gross_amount'] ?? 0)
      if (amt > 0) {
        syntheticEvents.push({
          id: `syn-inv-in-${inv['id']}`,
          step_name: `${inv['sender_name'] ?? 'Lieferant'} (${inv['invoice_number'] ?? 'Rechnung'})`,
          direction: 'expense',
          budget_amount: amt,
          budget_date: (inv['due_date'] ?? inv['created_at']) as string,
          actual_amount: inv['status'] === 'paid' ? amt : null,
          actual_date: inv['status'] === 'paid' ? (inv['created_at'] as string) : null,
          amount_deviation: inv['status'] === 'paid' ? 0 : null,
          marker_type: 'event',
          invoice_id: inv['id'],
          _synthetic: true,
        })
      }
    }

    liqEvents = syntheticEvents
  }

  // Generate timeline events from integration data
  const realPhaseHistory = (phaseHistoryRes.data ?? []) as Array<Record<string, unknown>>
  const syntheticTimeline: Array<Record<string, unknown>> = []
  // Lead created
  const leadData = leadRes.data as Record<string, unknown> | null
  if (leadData?.['created_at']) {
    syntheticTimeline.push({
      _type: 'milestone', _color: 'teal',
      label: 'Lead erstellt',
      detail: `${leadData['first_name'] ?? ''} ${leadData['last_name'] ?? ''}`.trim() + (leadData['source'] ? ` (${leadData['source']})` : ''),
      date: leadData['created_at'] as string,
    })
  }
  // Offer created
  if (offerRaw?.['created_at']) {
    syntheticTimeline.push({
      _type: 'milestone', _color: 'blue',
      label: 'Angebot erstellt',
      detail: `${offerRaw['title'] ?? ''} — CHF ${Number(offerRaw['amount_chf'] ?? 0).toLocaleString('de-CH')}`,
      date: offerRaw['created_at'] as string,
    })
  }
  // Offer sent
  if (offerRaw?.['sent_at']) {
    syntheticTimeline.push({
      _type: 'milestone', _color: 'indigo',
      label: 'Angebot versendet',
      detail: String(offerRaw['title'] ?? ''),
      date: offerRaw['sent_at'] as string,
    })
  }
  // Offer won
  if (offerRaw?.['status'] === 'won') {
    syntheticTimeline.push({
      _type: 'milestone', _color: 'green',
      label: 'Auftrag gewonnen',
      detail: `CHF ${Number(offerRaw['amount_chf'] ?? 0).toLocaleString('de-CH')}`,
      date: (offerRaw['updated_at'] ?? offerRaw['created_at']) as string,
    })
  }
  // Project created
  if (p['created_at']) {
    syntheticTimeline.push({
      _type: 'milestone', _color: 'gray',
      label: 'Projekt angelegt',
      detail: p['title'] as string,
      date: p['created_at'] as string,
    })
  }
  // Sort timeline by date
  syntheticTimeline.sort((a, b) => new Date(a['date'] as string).getTime() - new Date(b['date'] as string).getTime())

  const totalBudgetIncome = liqEvents.filter(e => e['direction'] === 'income').reduce((s, e) => s + Number(e['budget_amount'] ?? 0), 0)
  const totalBudgetExpense = liqEvents.filter(e => e['direction'] === 'expense').reduce((s, e) => s + Number(e['budget_amount'] ?? 0), 0)
  const totalActualIncome = liqEvents.filter(e => e['direction'] === 'income').reduce((s, e) => s + Number(e['actual_amount'] ?? 0), 0)
  const totalActualExpense = liqEvents.filter(e => e['direction'] === 'expense').reduce((s, e) => s + Number(e['actual_amount'] ?? 0), 0)

  // Resolve berater / setter — fallback from offer/lead if project fields are empty
  let berater = beraterRes.data as Record<string, unknown> | null
  let setter = setterRes.data as Record<string, unknown> | null
  const offerForFallback = offerRes.data as Record<string, unknown> | null
  const leadForFallback = leadRes.data as Record<string, unknown> | null

  // Fallback: if project has no berater but offer does, resolve from offer
  if (!berater && offerForFallback?.['berater_id']) {
    const { data: offerBerater } = await db.from('team_members')
      .select('id, first_name, last_name, email, phone, role')
      .eq('id', offerForFallback['berater_id'] as string).single()
    if (offerBerater) {
      berater = offerBerater as Record<string, unknown>
      // Persist to project so future loads are instant
      await db.from('projects').update({ berater_id: offerForFallback['berater_id'] }).eq('id', id)
    }
  }
  // Fallback: if project has no setter but lead does, resolve from lead
  if (!setter && leadForFallback?.['setter_id']) {
    const { data: leadSetter } = await db.from('team_members')
      .select('id, first_name, last_name, email, phone, role')
      .eq('id', leadForFallback['setter_id'] as string).single()
    if (leadSetter) {
      setter = leadSetter as Record<string, unknown>
      await db.from('projects').update({ setter_id: leadForFallback['setter_id'] }).eq('id', id)
    }
  }

  const beraterName = berater ? `${berater['first_name'] ?? ''} ${berater['last_name'] ?? ''}`.trim() : null
  const setterName = setter ? `${setter['first_name'] ?? ''} ${setter['last_name'] ?? ''}`.trim() : null

  // Offer data
  const offerData = offerRes.data as Record<string, unknown> | null
  const offerAmount = offerData ? Number(offerData['amount_chf'] ?? 0) : 0
  const projectValue = Number(p['project_value'] ?? 0) || offerAmount
  const offerStatus = offerData ? (offerData['status'] as string) : null

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Back link — uses ref param if available, then from (Kanban), then default */}
      {typeof sp['ref'] === 'string' ? (
        <Link
          href={sp['ref']}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          ← Zurück
        </Link>
      ) : sp['from'] ? (
        <Link
          href={`/dashboard?openProcess=${sp['from']}${sp['phase'] ? `&phase=${sp['phase']}` : ''}`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          ← Zurück zu {typeof sp['name'] === 'string' ? sp['name'] : 'Prozess'}
        </Link>
      ) : (
        <Link href="/projects" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          ← Zurück zur Projektübersicht
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
          {projectValue > 0 && (
            <span className="text-lg font-bold text-gray-900">
              CHF {projectValue.toLocaleString('de-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
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
        berater={berater}
        setter={setter}
        phaseHistory={realPhaseHistory}
        timelineMilestones={syntheticTimeline}
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
