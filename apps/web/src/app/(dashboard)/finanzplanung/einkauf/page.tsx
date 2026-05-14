export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { requireFinanzplanung } from '@/lib/finanzplanung-guard'
import { getSession } from '@/lib/session'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

export default async function EinkaufPage() {
  const hasAccess = await requireFinanzplanung()
  if (!hasAccess) return null

  const session = await getSession()
  if (!session?.companyId) return null

  const db = createSupabaseServiceClient()
  const cid = session.companyId

  // Fetch all procurement items
  const { data: items } = await db
    .from('procurement_items')
    .select('id, project_id, supplier_id, position, category, description, article_number, quantity, unit, unit_price, total_price, currency, planned_order_date, planned_delivery_date, actual_delivery_date, delivery_status, payment_status, planned_payment_amount, planned_payment_date, notes, created_at')
    .eq('company_id', cid)
    .order('created_at', { ascending: false })

  const rows = (items ?? []) as Array<Record<string, unknown>>

  // Fetch project names
  const projectIds = [...new Set(rows.map(r => r['project_id'] as string))]
  let projectMap: Record<string, string> = {}
  if (projectIds.length > 0) {
    const { data: projects } = await db
      .from('projects')
      .select('id, title, customer_name')
      .in('id', projectIds)
    for (const p of (projects ?? []) as Array<Record<string, unknown>>) {
      projectMap[p['id'] as string] = (p['title'] as string) || (p['customer_name'] as string) || ''
    }
  }

  // Fetch supplier names
  const supplierIds = [...new Set(rows.map(r => r['supplier_id'] as string).filter(Boolean))]
  let supplierMap: Record<string, string> = {}
  if (supplierIds.length > 0) {
    const { data: suppliers } = await db
      .from('suppliers')
      .select('id, name')
      .in('id', supplierIds)
    for (const s of (suppliers ?? []) as Array<Record<string, unknown>>) {
      supplierMap[s['id'] as string] = s['name'] as string
    }
  }

  const fmt = (n: number) => Math.round(n).toLocaleString('de-CH')

  // Aggregate KPIs
  const totalPlanned = rows.reduce((s, r) => s + Number(r['total_price'] ?? 0), 0)
  const deliveredCount = rows.filter(r => r['delivery_status'] === 'delivered').length
  const orderedCount = rows.filter(r => ['ordered', 'confirmed', 'shipped'].includes(r['delivery_status'] as string)).length
  const payableCount = rows.filter(r => r['payment_status'] === 'payable').length
  const payableAmount = rows
    .filter(r => r['payment_status'] === 'payable')
    .reduce((s, r) => s + Number(r['total_price'] ?? 0), 0)

  const catLabels: Record<string, string> = {
    material: 'Material',
    subcontractor: 'Subunternehmer',
    equipment: 'Werkzeug',
    logistics: 'Logistik',
    other: 'Sonstiges',
  }

  const delLabels: Record<string, { label: string; color: string }> = {
    not_ordered: { label: 'Offen', color: 'bg-gray-100 text-gray-600' },
    ordered: { label: 'Bestellt', color: 'bg-blue-100 text-blue-700' },
    confirmed: { label: 'Bestätigt', color: 'bg-indigo-100 text-indigo-700' },
    shipped: { label: 'Versendet', color: 'bg-purple-100 text-purple-700' },
    delivered: { label: 'Geliefert', color: 'bg-green-100 text-green-700' },
    partial: { label: 'Teil-Lfg.', color: 'bg-yellow-100 text-yellow-700' },
    cancelled: { label: 'Storniert', color: 'bg-red-100 text-red-700' },
  }

  const payLabels: Record<string, { label: string; color: string }> = {
    pending: { label: 'Ausstehend', color: 'bg-gray-100 text-gray-600' },
    payable: { label: 'Zahlungsfähig', color: 'bg-orange-100 text-orange-700' },
    invoiced: { label: 'Rechnung', color: 'bg-blue-100 text-blue-700' },
    paid: { label: 'Bezahlt', color: 'bg-green-100 text-green-700' },
    cancelled: { label: 'Storniert', color: 'bg-red-100 text-red-700' },
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
        <span className="text-brand-text-primary font-medium">Einkauf &amp; Lieferplan</span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-brand-text-primary">Einkauf &amp; Lieferplan</h1>
          <p className="text-sm text-brand-text-secondary mt-1">
            Bestellungen, Liefertermine und Zahlungsbereitschaft aller Projekte
          </p>
        </div>
        <span className="text-sm text-gray-500">{rows.length} Positionen</span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Gesamt (geplant)</p>
          <p className="text-lg font-bold text-gray-900 mt-1">CHF {fmt(totalPlanned)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Bestellt / In Lieferung</p>
          <p className="text-lg font-bold text-blue-700 mt-1">{orderedCount}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Geliefert</p>
          <p className="text-lg font-bold text-green-700 mt-1">{deliveredCount}</p>
        </div>
        <div className={`rounded-lg border p-4 ${payableCount > 0 ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-white'}`}>
          <p className={`text-xs ${payableCount > 0 ? 'text-orange-600' : 'text-gray-500'}`}>Zahlungsf&auml;hig</p>
          <p className={`text-lg font-bold mt-1 ${payableCount > 0 ? 'text-orange-700' : 'text-gray-400'}`}>{payableCount}</p>
          {payableCount > 0 && (
            <p className="text-[11px] text-orange-600">CHF {fmt(payableAmount)}</p>
          )}
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Noch nicht bestellt</p>
          <p className="text-lg font-bold text-gray-500 mt-1">
            {rows.filter(r => r['delivery_status'] === 'not_ordered').length}
          </p>
        </div>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500 mb-2">Keine Einkaufspositionen vorhanden.</p>
          <p className="text-xs text-gray-400">
            Positionen werden pro Projekt im Vertragsdetail erfasst.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Beschreibung</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Projekt</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Lieferant</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Kategorie</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Betrag</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Lieferdatum</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Lieferung</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Zahlung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => {
                  const projId = row['project_id'] as string
                  const suppId = row['supplier_id'] as string | null
                  const dl = delLabels[row['delivery_status'] as string] ?? { label: row['delivery_status'] as string, color: 'bg-gray-100 text-gray-600' }
                  const pl = payLabels[row['payment_status'] as string] ?? { label: row['payment_status'] as string, color: 'bg-gray-100 text-gray-600' }

                  return (
                    <tr key={row['id'] as string} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-900 font-medium max-w-[200px] truncate">
                        {row['description'] as string}
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[150px] truncate">
                        <Link
                          href={`/finanzplanung/vertraege/${projId}`}
                          className="text-blue-600 hover:underline"
                        >
                          {projectMap[projId] ?? projId.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-500 max-w-[120px] truncate">
                        {suppId ? (supplierMap[suppId] ?? '—') : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {catLabels[row['category'] as string] ?? (row['category'] as string)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-900">
                        CHF {fmt(Number(row['total_price'] ?? 0))}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {row['planned_delivery_date']
                          ? new Date(row['planned_delivery_date'] as string).toLocaleDateString('de-CH')
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${dl.color}`}>
                          {dl.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${pl.color}`}>
                          {pl.label}
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
