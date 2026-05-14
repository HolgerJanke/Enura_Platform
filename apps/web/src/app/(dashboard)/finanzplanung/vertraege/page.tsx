export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { requireFinanzplanung } from '@/lib/finanzplanung-guard'
import { getSession } from '@/lib/session'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

export default async function VertraegePage() {
  const hasAccess = await requireFinanzplanung()
  if (!hasAccess) return null

  const session = await getSession()
  if (!session?.companyId) return null

  const db = createSupabaseServiceClient()
  const cid = session.companyId

  // Fetch contracts with project info
  const { data: contracts } = await db
    .from('customer_contracts')
    .select('id, project_id, contract_number, contract_date, auftragswert, currency, status, schedule_amount_valid, schedule_deviation, signed_at, created_at')
    .eq('company_id', cid)
    .order('created_at', { ascending: false })

  // Fetch project names for display
  const projectIds = [...new Set((contracts ?? []).map((c: Record<string, unknown>) => c['project_id'] as string))]
  let projectMap: Record<string, string> = {}
  if (projectIds.length > 0) {
    const { data: projects } = await db
      .from('projects')
      .select('id, title, customer_name')
      .in('id', projectIds)
    for (const p of (projects ?? []) as Array<Record<string, unknown>>) {
      projectMap[p['id'] as string] = `${p['title'] ?? ''} — ${p['customer_name'] ?? ''}`.trim()
    }
  }

  // Fetch schedule totals per contract
  const contractIds = (contracts ?? []).map((c: Record<string, unknown>) => c['id'] as string)
  let scheduleTotals: Record<string, { count: number; sum: number }> = {}
  if (contractIds.length > 0) {
    const { data: schedules } = await db
      .from('payment_schedule_sales')
      .select('contract_id, planned_amount, status')
      .in('contract_id', contractIds)
    for (const s of (schedules ?? []) as Array<Record<string, unknown>>) {
      const cid = s['contract_id'] as string
      if (!scheduleTotals[cid]) scheduleTotals[cid] = { count: 0, sum: 0 }
      if (s['status'] !== 'cancelled') {
        scheduleTotals[cid]!.count++
        scheduleTotals[cid]!.sum += Number(s['planned_amount'] ?? 0)
      }
    }
  }

  const rows = (contracts ?? []) as Array<Record<string, unknown>>

  const statusLabels: Record<string, { label: string; color: string }> = {
    draft: { label: 'Entwurf', color: 'bg-gray-100 text-gray-700' },
    sent: { label: 'Gesendet', color: 'bg-blue-100 text-blue-700' },
    signed: { label: 'Unterschrieben', color: 'bg-indigo-100 text-indigo-700' },
    active: { label: 'Aktiv', color: 'bg-green-100 text-green-700' },
    completed: { label: 'Abgeschlossen', color: 'bg-emerald-100 text-emerald-700' },
    cancelled: { label: 'Storniert', color: 'bg-red-100 text-red-700' },
  }

  const fmt = (n: number) => Math.round(n).toLocaleString('de-CH')

  return (
    <div className="p-6 lg:p-8">
      <nav className="flex items-center gap-2 text-sm text-brand-text-secondary mb-6">
        <Link href="/finanzplanung" className="hover:text-brand-text-primary transition-colors">
          Finanzplanung
        </Link>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
        <span className="text-brand-text-primary font-medium">Kundenvertr&auml;ge</span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-brand-text-primary">Kundenvertr&auml;ge</h1>
          <p className="text-sm text-brand-text-secondary mt-1">
            Auftr&auml;ge, Vertragswerte und Zahlungspl&auml;ne (Verkaufsseite)
          </p>
        </div>
        <span className="text-sm text-gray-500">{rows.length} Vertr&auml;ge</span>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Gesamt Auftragswert</p>
          <p className="text-lg font-bold text-gray-900 mt-1">
            CHF {fmt(rows.reduce((s, r) => s + Number(r['auftragswert'] ?? 0), 0))}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Aktive Vertr&auml;ge</p>
          <p className="text-lg font-bold text-green-700 mt-1">
            {rows.filter(r => r['status'] === 'active' || r['status'] === 'signed').length}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Entwurf</p>
          <p className="text-lg font-bold text-gray-500 mt-1">
            {rows.filter(r => r['status'] === 'draft').length}
          </p>
        </div>
        {rows.some(r => !r['schedule_amount_valid'] && r['status'] !== 'draft') && (
          <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4">
            <p className="text-xs text-yellow-700">Zahlungsplan-Warnung</p>
            <p className="text-lg font-bold text-yellow-700 mt-1">
              {rows.filter(r => !r['schedule_amount_valid'] && r['status'] !== 'draft').length}
            </p>
            <p className="text-[11px] text-yellow-600">Summe &ne; Auftragswert</p>
          </div>
        )}
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500 mb-2">Noch keine Kundenvertr&auml;ge erfasst.</p>
          <p className="text-xs text-gray-400">
            Vertr&auml;ge werden automatisch angelegt, wenn ein Projekt einen Auftrag erh&auml;lt,
            oder k&ouml;nnen manuell in der Projektansicht erstellt werden.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Vertrag</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Projekt / Kunde</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Auftragswert</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Zahlungsplan</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Datum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => {
                  const id = row['id'] as string
                  const projectId = row['project_id'] as string
                  const status = row['status'] as string
                  const st = statusLabels[status] ?? { label: status, color: 'bg-gray-100 text-gray-700' }
                  const sched = scheduleTotals[id]
                  const schedValid = row['schedule_amount_valid'] as boolean
                  const deviation = Number(row['schedule_deviation'] ?? 0)

                  return (
                    <tr key={id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/finanzplanung/vertraege/${projectId}`}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          {(row['contract_number'] as string) || `V-${id.slice(0, 8)}`}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[300px] truncate">
                        {projectMap[projectId] ?? projectId.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-gray-900">
                        CHF {fmt(Number(row['auftragswert'] ?? 0))}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {sched ? (
                          <span className={`inline-flex items-center gap-1 text-xs ${
                            schedValid ? 'text-green-600' : 'text-yellow-600'
                          }`}>
                            {sched.count} Raten
                            {!schedValid && (
                              <span title={`Abweichung: CHF ${fmt(deviation)}`}>
                                <svg className="h-3.5 w-3.5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
                                </svg>
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {row['contract_date']
                          ? new Date(row['contract_date'] as string).toLocaleDateString('de-CH')
                          : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
