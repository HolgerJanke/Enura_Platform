export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { requireFinanzplanung } from '@/lib/finanzplanung-guard'
import { getSession } from '@/lib/session'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

export default async function ContractDetailPage({
  params,
}: {
  params: { projectId: string }
}) {
  const hasAccess = await requireFinanzplanung()
  if (!hasAccess) return null

  const session = await getSession()
  if (!session?.companyId) return null

  const db = createSupabaseServiceClient()
  const cid = session.companyId
  const { projectId } = params

  // Fetch project
  const { data: project } = await db
    .from('projects')
    .select('id, title, customer_name, project_value, status')
    .eq('id', projectId)
    .eq('company_id', cid)
    .single()

  if (!project) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Projekt nicht gefunden.</p>
        <Link href="/finanzplanung/vertraege" className="text-blue-600 underline text-sm">Zur&uuml;ck</Link>
      </div>
    )
  }

  const proj = project as Record<string, unknown>

  // Fetch contract for this project
  const { data: contract } = await db
    .from('customer_contracts')
    .select('*')
    .eq('project_id', projectId)
    .eq('company_id', cid)
    .maybeSingle()

  const ct = contract as Record<string, unknown> | null

  // Fetch payment schedule
  const scheduleRes = ct
    ? await db
        .from('payment_schedule_sales')
        .select('*')
        .eq('contract_id', ct['id'] as string)
        .order('position')
    : { data: [] }
  const schedules = (scheduleRes.data ?? []) as Array<Record<string, unknown>>

  // Fetch Kalkulation
  const { data: kalkulation } = await db
    .from('kalkulationen')
    .select('*')
    .eq('project_id', projectId)
    .eq('company_id', cid)
    .eq('is_active', true)
    .maybeSingle()

  const kalk = kalkulation as Record<string, unknown> | null

  // Fetch procurement items
  const { data: procurementData } = await db
    .from('procurement_items')
    .select('id, description, category, total_price, delivery_status, payment_status, supplier_id')
    .eq('project_id', projectId)
    .eq('company_id', cid)
    .order('position')

  const procurement = (procurementData ?? []) as Array<Record<string, unknown>>

  const fmt = (n: number) => Math.round(n).toLocaleString('de-CH')
  const auftragswert = Number(ct?.['auftragswert'] ?? proj['project_value'] ?? 0)
  const scheduleSum = schedules
    .filter(s => s['status'] !== 'cancelled')
    .reduce((sum, s) => sum + Number(s['planned_amount'] ?? 0), 0)
  const scheduleDiff = scheduleSum - auftragswert
  const procurementTotal = procurement.reduce((s, p) => s + Number(p['total_price'] ?? 0), 0)

  const statusLabels: Record<string, { label: string; color: string }> = {
    draft: { label: 'Entwurf', color: 'bg-gray-100 text-gray-700' },
    sent: { label: 'Gesendet', color: 'bg-blue-100 text-blue-700' },
    signed: { label: 'Unterschrieben', color: 'bg-indigo-100 text-indigo-700' },
    active: { label: 'Aktiv', color: 'bg-green-100 text-green-700' },
    completed: { label: 'Abgeschlossen', color: 'bg-emerald-100 text-emerald-700' },
    cancelled: { label: 'Storniert', color: 'bg-red-100 text-red-700' },
  }

  const schedStatusLabels: Record<string, { label: string; color: string }> = {
    planned: { label: 'Geplant', color: 'bg-gray-100 text-gray-700' },
    invoiced: { label: 'Fakturiert', color: 'bg-blue-100 text-blue-700' },
    partially_paid: { label: 'Teilbezahlt', color: 'bg-yellow-100 text-yellow-700' },
    paid: { label: 'Bezahlt', color: 'bg-green-100 text-green-700' },
    overdue: { label: 'Überfällig', color: 'bg-red-100 text-red-700' },
    cancelled: { label: 'Storniert', color: 'bg-red-100 text-red-600' },
  }

  const ctStatus = ct ? statusLabels[ct['status'] as string] ?? { label: ct['status'] as string, color: 'bg-gray-100 text-gray-700' } : null

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-brand-text-secondary mb-6">
        <Link href="/finanzplanung" className="hover:text-brand-text-primary transition-colors">
          Finanzplanung
        </Link>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
        <Link href="/finanzplanung/vertraege" className="hover:text-brand-text-primary transition-colors">
          Vertr&auml;ge
        </Link>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
        <span className="text-brand-text-primary font-medium">{proj['title'] as string}</span>
      </nav>

      {/* Project header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-brand-text-primary">
          {proj['title'] as string}
        </h1>
        <p className="text-sm text-brand-text-secondary mt-1">
          Kunde: {proj['customer_name'] as string}
        </p>
      </div>

      {/* Financial overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Auftragswert</p>
          <p className="text-lg font-bold text-gray-900 mt-1">CHF {fmt(auftragswert)}</p>
          {ct && ctStatus && (
            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium mt-1 ${ctStatus.color}`}>
              {ctStatus.label}
            </span>
          )}
        </div>
        <div className={`rounded-lg border p-4 ${
          Math.abs(scheduleDiff) > 0.01 && schedules.length > 0
            ? 'border-yellow-300 bg-yellow-50'
            : 'border-gray-200 bg-white'
        }`}>
          <p className="text-xs text-gray-500">Zahlungsplan</p>
          <p className="text-lg font-bold text-gray-900 mt-1">CHF {fmt(scheduleSum)}</p>
          {schedules.length > 0 && Math.abs(scheduleDiff) > 0.01 && (
            <p className="text-[11px] text-yellow-600 mt-1">
              Abweichung: CHF {fmt(scheduleDiff)}
            </p>
          )}
          <p className="text-[11px] text-gray-400">{schedules.filter(s => s['status'] !== 'cancelled').length} Raten</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Einkauf (geplant)</p>
          <p className="text-lg font-bold text-gray-900 mt-1">CHF {fmt(procurementTotal)}</p>
          <p className="text-[11px] text-gray-400">{procurement.length} Positionen</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Rohertrag (Kalk.)</p>
          <p className={`text-lg font-bold mt-1 ${
            kalk ? (Number(kalk['rohertrag'] ?? 0) >= 0 ? 'text-green-700' : 'text-red-700') : 'text-gray-400'
          }`}>
            {kalk ? `CHF ${fmt(Number(kalk['rohertrag'] ?? 0))}` : '—'}
          </p>
          {kalk && (
            <p className="text-[11px] text-gray-400">
              Marge: {Number(kalk['marge_prozent'] ?? 0).toFixed(1)}%
            </p>
          )}
        </div>
      </div>

      {/* Payment Schedule (Verkauf) */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden mb-8">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Zahlungsplan (Verkauf)</h2>
          {schedules.length > 0 && Math.abs(scheduleDiff) > 0.01 && (
            <span className="inline-flex items-center gap-1 text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
              </svg>
              Summe &ne; Auftragswert
            </span>
          )}
        </div>
        {schedules.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            Noch kein Zahlungsplan erstellt.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">#</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Meilenstein</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-500">Betrag</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-500">%</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">F&auml;llig am</th>
                  <th className="text-center px-4 py-2.5 font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {schedules.map((s) => {
                  const st = schedStatusLabels[s['status'] as string] ?? { label: s['status'] as string, color: 'bg-gray-100 text-gray-700' }
                  return (
                    <tr key={s['id'] as string} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-400">{Number(s['position'])}</td>
                      <td className="px-4 py-2.5 text-gray-900 font-medium">{s['milestone_name'] as string}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-gray-900">
                        CHF {fmt(Number(s['planned_amount'] ?? 0))}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-500">
                        {s['planned_percentage'] ? `${Number(s['planned_percentage']).toFixed(0)}%` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500">
                        {s['planned_date']
                          ? new Date(s['planned_date'] as string).toLocaleDateString('de-CH')
                          : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {/* Sum row */}
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-4 py-2.5" colSpan={2}>Summe</td>
                  <td className="px-4 py-2.5 text-right font-mono">CHF {fmt(scheduleSum)}</td>
                  <td className="px-4 py-2.5 text-right">
                    {auftragswert > 0 ? `${(scheduleSum / auftragswert * 100).toFixed(0)}%` : '—'}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Procurement Items */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden mb-8">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Einkauf / Lieferplan</h2>
          <Link
            href="/finanzplanung/einkauf"
            className="text-xs text-blue-600 hover:underline"
          >
            Alle anzeigen &rarr;
          </Link>
        </div>
        {procurement.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            Keine Einkaufspositionen erfasst.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Beschreibung</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Kategorie</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-500">Betrag</th>
                  <th className="text-center px-4 py-2.5 font-medium text-gray-500">Lieferung</th>
                  <th className="text-center px-4 py-2.5 font-medium text-gray-500">Zahlung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {procurement.map((p) => {
                  const catLabels: Record<string, string> = {
                    material: 'Material',
                    subcontractor: 'Subunternehmer',
                    equipment: 'Werkzeug',
                    logistics: 'Logistik',
                    other: 'Sonstiges',
                  }
                  const delLabels: Record<string, { label: string; color: string }> = {
                    not_ordered: { label: 'Offen', color: 'text-gray-400' },
                    ordered: { label: 'Bestellt', color: 'text-blue-600' },
                    confirmed: { label: 'Bestätigt', color: 'text-indigo-600' },
                    shipped: { label: 'Versendet', color: 'text-purple-600' },
                    delivered: { label: 'Geliefert', color: 'text-green-600' },
                    partial: { label: 'Teil-Lfg.', color: 'text-yellow-600' },
                    cancelled: { label: 'Storniert', color: 'text-red-500' },
                  }
                  const payLabels: Record<string, { label: string; color: string }> = {
                    pending: { label: 'Ausstehend', color: 'text-gray-400' },
                    payable: { label: 'Zahlungsf.', color: 'text-orange-600' },
                    invoiced: { label: 'Rechnung', color: 'text-blue-600' },
                    paid: { label: 'Bezahlt', color: 'text-green-600' },
                    cancelled: { label: 'Storniert', color: 'text-red-500' },
                  }
                  const dl = delLabels[p['delivery_status'] as string] ?? { label: p['delivery_status'] as string, color: 'text-gray-500' }
                  const pl = payLabels[p['payment_status'] as string] ?? { label: p['payment_status'] as string, color: 'text-gray-500' }

                  return (
                    <tr key={p['id'] as string} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-900">{p['description'] as string}</td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">
                        {catLabels[p['category'] as string] ?? (p['category'] as string)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-gray-900">
                        CHF {fmt(Number(p['total_price'] ?? 0))}
                      </td>
                      <td className={`px-4 py-2.5 text-center text-xs font-medium ${dl.color}`}>
                        {dl.label}
                      </td>
                      <td className={`px-4 py-2.5 text-center text-xs font-medium ${pl.color}`}>
                        {pl.label}
                      </td>
                    </tr>
                  )
                })}
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-4 py-2.5" colSpan={2}>Summe Einkauf</td>
                  <td className="px-4 py-2.5 text-right font-mono">CHF {fmt(procurementTotal)}</td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Kalkulation summary */}
      {kalk && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">
              Kalkulation {kalk['version_name'] ? `— ${kalk['version_name']}` : `v${kalk['version']}`}
            </h2>
            <Link
              href="/finanzplanung/kalkulation"
              className="text-xs text-blue-600 hover:underline"
            >
              Details &rarr;
            </Link>
          </div>
          <div className="p-5 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Material', value: kalk['material_cost'] },
              { label: 'Arbeit', value: kalk['labor_cost'] },
              { label: 'Subunternehmer', value: kalk['subcontractor_cost'] },
              { label: 'Ausstattung', value: kalk['equipment_cost'] },
              { label: 'Logistik', value: kalk['logistics_cost'] },
              { label: 'Gemeinkosten', value: kalk['overhead_cost'] },
              { label: 'Sonstiges', value: kalk['other_cost'] },
            ].filter(item => Number(item.value ?? 0) > 0).map((item, i) => (
              <div key={i}>
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className="text-sm font-medium text-gray-900">CHF {fmt(Number(item.value ?? 0))}</p>
              </div>
            ))}
            <div className="col-span-2 lg:col-span-4 border-t border-gray-100 pt-3 mt-2 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Gesamtkosten</p>
                <p className="text-lg font-bold text-gray-900">CHF {fmt(Number(kalk['total_cost'] ?? 0))}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Rohertrag</p>
                <p className={`text-lg font-bold ${Number(kalk['rohertrag'] ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  CHF {fmt(Number(kalk['rohertrag'] ?? 0))}
                </p>
                <p className="text-xs text-gray-500">
                  Marge: {Number(kalk['marge_prozent'] ?? 0).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
