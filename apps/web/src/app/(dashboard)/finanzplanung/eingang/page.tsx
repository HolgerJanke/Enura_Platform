import Link from 'next/link'
import { getSession } from '@/lib/session'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { requireFinanzplanung, hasFinanzplanungPermission } from '@/lib/finanzplanung-guard'
import { InvoiceKanban } from './invoice-kanban'

export const dynamic = 'force-dynamic'

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
  const supabase = createSupabaseServiceClient()

  // Anyone with access to this page can drag (requireFinanzplanung already gates access)
  const canDrag = true

  // Fetch all invoices ordered by planned payment date (fallback to due_date)
  const { data: invoices } = await supabase
    .from('invoices_incoming')
    .select('id, invoice_number, sender_name, gross_amount, currency, due_date, planned_payment_date, status')
    .eq('company_id', session!.companyId ?? '')
    .order('due_date', { ascending: true, nullsFirst: false })

  const rows = (invoices ?? []) as Array<{
    id: string
    invoice_number: string | null
    sender_name: string | null
    gross_amount: number | null
    currency: string
    due_date: string | null
    planned_payment_date: string | null
    status: string
  }>

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
            ← Zurück
          </Link>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Rechnungen nach Fälligkeitswoche — per Drag-and-Drop verschieben, um das Zahlungsdatum zu ändern.
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
        <InvoiceKanban invoices={rows} canDrag={canDrag} />
      )}
    </div>
  )
}
