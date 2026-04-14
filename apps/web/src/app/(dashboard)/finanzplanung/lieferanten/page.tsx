export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { hasFinanzplanungPermission } from '@/lib/finanzplanung-guard'

interface SupplierRow {
  id: string
  name: string
  city: string | null
  country: string
  vat_number: string | null
  iban: string | null
  contact_name: string | null
  contact_email: string | null
  preferred_payment_days: number
  is_active: boolean
  bank_data_verified: boolean
}

export default async function LieferantenPage() {
  const canManage = await hasFinanzplanungPermission('module:finanzplanung:manage_suppliers')
  if (!canManage) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 mb-4">Kein Zugriff auf Lieferanten-Verwaltung.</p>
        <Link href="/finanzplanung" className="text-blue-600 underline text-sm">Zurueck zur Finanzplanung</Link>
      </div>
    )
  }

  const session = await getSession()
  const supabase = createSupabaseServerClient()

  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, name, city, country, vat_number, iban, contact_name, contact_email, preferred_payment_days, is_active, bank_data_verified')
    .eq('company_id', session!.companyId ?? '')
    .eq('is_active', true)
    .order('name')

  const rows = (suppliers ?? []) as SupplierRow[]

  // Count pending bank data change requests
  const { count: pendingCount } = await supabase
    .from('supplier_bank_change_requests')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', session!.companyId ?? '')
    .in('status', ['pending_review', 'reviewed'])

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold text-gray-900">Lieferanten</h1>
        <div className="flex items-center gap-3">
          {(pendingCount ?? 0) > 0 && (
            <Link
              href="/finanzplanung/bankdaten-genehmigung"
              className="inline-flex items-center gap-1.5 rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-1.5 text-xs font-medium text-yellow-800 hover:bg-yellow-100 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              {pendingCount} offene Bankdaten-Antraege
            </Link>
          )}
          <Link href="/finanzplanung" className="text-sm text-gray-500 hover:text-gray-700">
            &larr; Zurueck
          </Link>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Lieferanten-Stammdaten fuer die Rechnungsverarbeitung und Zahlungsdatei-Erstellung.
      </p>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-12 text-center">
          <svg className="mx-auto mb-4 h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <p className="text-sm text-gray-500 mb-2">Noch keine Lieferanten erfasst.</p>
          <p className="text-xs text-gray-400">
            Lieferanten werden automatisch aus eingehenden Rechnungen angelegt
            oder koennen manuell hinzugefuegt werden.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Ort</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">USt-Nr.</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">IBAN</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">Bankdaten</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Kontakt</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Zahlungsziel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium">
                    <Link href={`/finanzplanung/lieferanten/${s.id}`} className="text-blue-600 hover:underline">
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {[s.city, s.country].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-500">{s.vat_number ?? '—'}</td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-500">
                    {s.iban ? `${s.iban.slice(0, 4)} ****` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {s.bank_data_verified ? (
                      <span className="inline-flex items-center gap-1 text-green-600" title="Bankdaten verifiziert">
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-yellow-500" title="Bankdaten nicht verifiziert">
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {s.contact_name ?? s.contact_email ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 text-right">
                    {s.preferred_payment_days} Tage
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
