import Link from 'next/link'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireFinanzplanung } from '@/lib/finanzplanung-guard'

const STATUS_LABELS: Record<string, string> = {
  received: 'Eingegangen',
  extraction_done: 'Extrahiert',
  match_review: 'Match-Pruefung',
  in_validation: 'In Pruefung',
  returned_formal: 'Zurueckgesendet',
  formally_approved: 'Formal genehmigt',
  pending_approval: 'Genehmigung ausstehend',
  returned_internal: 'Interne Korrektur',
  returned_sender: 'An Absender',
  approved: 'Genehmigt',
  scheduled: 'Geplant',
  in_payment_run: 'Im Zahlungslauf',
  paid: 'Bezahlt',
}

const STATUS_COLORS: Record<string, string> = {
  received: 'bg-blue-100 text-blue-700',
  extraction_done: 'bg-blue-100 text-blue-700',
  match_review: 'bg-amber-100 text-amber-700',
  in_validation: 'bg-yellow-100 text-yellow-700',
  returned_formal: 'bg-red-100 text-red-700',
  formally_approved: 'bg-indigo-100 text-indigo-700',
  pending_approval: 'bg-amber-100 text-amber-700',
  returned_internal: 'bg-orange-100 text-orange-700',
  returned_sender: 'bg-red-100 text-red-700',
  approved: 'bg-green-100 text-green-700',
  scheduled: 'bg-teal-100 text-teal-700',
  in_payment_run: 'bg-cyan-100 text-cyan-700',
  paid: 'bg-gray-100 text-gray-500',
}

interface InvoiceRow {
  id: string
  invoice_number: string | null
  sender_name: string | null
  gross_amount: number | null
  currency: string
  due_date: string | null
  status: string
  created_at: string
}

export default async function EingangPage() {
  const hasAccess = await requireFinanzplanung()
  if (!hasAccess) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 mb-4">Kein Zugriff.</p>
        <Link href="/dashboard" className="text-blue-600 underline text-sm">Zum Dashboard</Link>
      </div>
    )
  }

  const session = await getSession()
  const supabase = createSupabaseServerClient()

  const { data: invoices } = await supabase
    .from('invoices_incoming')
    .select('id, invoice_number, sender_name, gross_amount, currency, due_date, status, created_at')
    .eq('company_id', session!.companyId ?? '')
    .order('created_at', { ascending: false })
    .limit(100)

  const rows = (invoices ?? []) as InvoiceRow[]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold text-gray-900">Rechnungseingang</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/finanzplanung/upload"
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Rechnung hochladen
          </Link>
          <Link href="/finanzplanung" className="text-sm text-gray-500 hover:text-gray-700">
            ← Zurueck
          </Link>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Alle eingehenden Rechnungen mit Validierungsstatus.
      </p>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-12 text-center">
          <svg className="mx-auto mb-4 h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p className="text-sm text-gray-500 mb-2">Noch keine Rechnungen eingegangen.</p>
          <Link
            href="/finanzplanung/upload"
            className="text-sm text-blue-600 underline hover:text-blue-800"
          >
            Erste Rechnung hochladen
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Nr.</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Rechnungssteller</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Betrag</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Faelligkeit</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Eingegangen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono text-gray-900">
                    {inv.invoice_number ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {inv.sender_name ?? 'Unbekannt'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right font-mono">
                    {inv.gross_amount != null
                      ? `${inv.currency} ${Number(inv.gross_amount).toLocaleString('de-CH', { minimumFractionDigits: 2 })}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {inv.due_date
                      ? new Date(inv.due_date).toLocaleDateString('de-CH')
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[inv.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {STATUS_LABELS[inv.status] ?? inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(inv.created_at).toLocaleDateString('de-CH')}
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
