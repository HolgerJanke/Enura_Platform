export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { requireFinanzplanung } from '@/lib/finanzplanung-guard'
import { getSession } from '@/lib/session'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

export default async function KalkulationPage() {
  const hasAccess = await requireFinanzplanung()
  if (!hasAccess) return null

  const session = await getSession()
  if (!session?.companyId) return null

  const db = createSupabaseServiceClient()
  const cid = session.companyId

  // Fetch all active Kalkulationen
  const { data: kalks } = await db
    .from('kalkulationen')
    .select('id, project_id, version, version_name, is_active, auftragswert, material_cost, labor_cost, subcontractor_cost, equipment_cost, logistics_cost, overhead_cost, other_cost, total_cost, rohertrag, marge_prozent, status, approved_by, approved_at, notes, created_at')
    .eq('company_id', cid)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  const rows = (kalks ?? []) as Array<Record<string, unknown>>

  // Fetch project names
  const projectIds = [...new Set(rows.map(r => r['project_id'] as string))]
  let projectMap: Record<string, { title: string; customer: string }> = {}
  if (projectIds.length > 0) {
    const { data: projects } = await db
      .from('projects')
      .select('id, title, customer_name')
      .in('id', projectIds)
    for (const p of (projects ?? []) as Array<Record<string, unknown>>) {
      projectMap[p['id'] as string] = {
        title: p['title'] as string,
        customer: p['customer_name'] as string,
      }
    }
  }

  const fmt = (n: number) => Math.round(n).toLocaleString('de-CH')

  // Aggregates
  const totalAuftragswert = rows.reduce((s, r) => s + Number(r['auftragswert'] ?? 0), 0)
  const totalCost = rows.reduce((s, r) => s + Number(r['total_cost'] ?? 0), 0)
  const totalRohertrag = rows.reduce((s, r) => s + Number(r['rohertrag'] ?? 0), 0)
  const avgMarge = totalAuftragswert > 0 ? (totalRohertrag / totalAuftragswert * 100) : 0
  const lowMargeCount = rows.filter(r => Number(r['marge_prozent'] ?? 0) < 10).length

  const statusLabels: Record<string, { label: string; color: string }> = {
    draft: { label: 'Entwurf', color: 'bg-gray-100 text-gray-700' },
    reviewed: { label: 'Geprüft', color: 'bg-blue-100 text-blue-700' },
    approved: { label: 'Freigegeben', color: 'bg-green-100 text-green-700' },
    locked: { label: 'Gesperrt', color: 'bg-purple-100 text-purple-700' },
  }

  return (
    <div className="p-6 lg:p-8">
      <nav className="flex items-center gap-2 text-sm text-brand-text-secondary mb-6">
        <Link href="/finanzplanung" className="hover:text-brand-text-primary transition-colors">
          Finanzplanung
        </Link>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
        <span className="text-brand-text-primary font-medium">Kalkulationen</span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-brand-text-primary">Kalkulationen</h1>
          <p className="text-sm text-brand-text-secondary mt-1">
            Kostenaufstellung und Rohertrag pro Projekt
          </p>
        </div>
        <span className="text-sm text-gray-500">{rows.length} aktive Kalkulationen</span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Ges. Auftragswert</p>
          <p className="text-lg font-bold text-gray-900 mt-1">CHF {fmt(totalAuftragswert)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Ges. Kosten</p>
          <p className="text-lg font-bold text-gray-900 mt-1">CHF {fmt(totalCost)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Ges. Rohertrag</p>
          <p className={`text-lg font-bold mt-1 ${totalRohertrag >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            CHF {fmt(totalRohertrag)}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">&empty; Marge</p>
          <p className={`text-lg font-bold mt-1 ${avgMarge >= 10 ? 'text-green-700' : 'text-yellow-700'}`}>
            {avgMarge.toFixed(1)}%
          </p>
        </div>
        {lowMargeCount > 0 && (
          <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4">
            <p className="text-xs text-yellow-700">Marge &lt; 10%</p>
            <p className="text-lg font-bold text-yellow-700 mt-1">{lowMargeCount}</p>
            <p className="text-[11px] text-yellow-600">Projekte pr&uuml;fen</p>
          </div>
        )}
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500 mb-2">Keine Kalkulationen vorhanden.</p>
          <p className="text-xs text-gray-400">
            Kalkulationen werden pro Projekt erstellt und beinhalten die komplette Kostenaufstellung.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Projekt</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Kunde</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Auftragswert</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Gesamtkosten</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Rohertrag</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Marge</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => {
                  const projId = row['project_id'] as string
                  const proj = projectMap[projId]
                  const rohertrag = Number(row['rohertrag'] ?? 0)
                  const marge = Number(row['marge_prozent'] ?? 0)
                  const st = statusLabels[row['status'] as string] ?? { label: row['status'] as string, color: 'bg-gray-100 text-gray-700' }

                  return (
                    <tr key={row['id'] as string} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/finanzplanung/vertraege/${projId}`}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          {proj?.title ?? projId.slice(0, 8)}
                        </Link>
                        {(row['version_name'] as string | null) && (
                          <span className="text-xs text-gray-400 ml-2">{row['version_name'] as string}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 max-w-[150px] truncate">
                        {proj?.customer ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-900">
                        CHF {fmt(Number(row['auftragswert'] ?? 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-900">
                        CHF {fmt(Number(row['total_cost'] ?? 0))}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono font-medium ${rohertrag >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        CHF {fmt(rohertrag)}
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${
                        marge >= 15 ? 'text-green-700' :
                        marge >= 10 ? 'text-green-600' :
                        marge >= 5 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {marge.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                          {st.label}
                        </span>
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
