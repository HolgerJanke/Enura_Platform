export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { hasFinanzplanungPermission } from '@/lib/finanzplanung-guard'
import { BankDataChangeForm } from './bank-data-change-form'

interface PageProps {
  params: { id: string }
}

export default async function BankdatenAendernPage({ params }: PageProps) {
  const canManage = await hasFinanzplanungPermission('module:finanzplanung:manage_suppliers')
  if (!canManage) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 mb-4">Keine Berechtigung.</p>
        <Link href="/finanzplanung" className="text-blue-600 underline text-sm">Zurueck</Link>
      </div>
    )
  }

  const supabase = createSupabaseServerClient()
  const { id } = params

  // Fetch supplier name
  const { data: supplierRaw } = await supabase
    .from('suppliers')
    .select('id, name, iban, bic, bank_name')
    .eq('id', id)
    .single()

  if (!supplierRaw) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 mb-4">Lieferant nicht gefunden.</p>
        <Link href="/finanzplanung/lieferanten" className="text-blue-600 underline text-sm">Zurueck</Link>
      </div>
    )
  }

  const supplier = supplierRaw as { id: string; name: string; iban: string | null; bic: string | null; bank_name: string | null }

  // Check for existing pending request
  const { data: pendingRaw } = await supabase
    .from('supplier_bank_change_requests')
    .select('id')
    .eq('supplier_id', id)
    .in('status', ['pending_review', 'reviewed'])
    .limit(1)

  if (pendingRaw && pendingRaw.length > 0) {
    return (
      <div className="p-6">
        <Link href={`/finanzplanung/lieferanten/${id}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          &larr; Zurueck
        </Link>
        <div className="rounded-lg border-2 border-yellow-300 bg-yellow-50 p-8 text-center">
          <p className="text-yellow-800 font-medium mb-2">Offene Aenderungsanfrage vorhanden</p>
          <p className="text-sm text-yellow-700">
            Es liegt bereits eine offene Bankdaten-Aenderungsanfrage fuer diesen Lieferanten vor.
            Bitte warten Sie auf deren Bearbeitung.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <Link href={`/finanzplanung/lieferanten/${id}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        &larr; Zurueck zu {supplier.name}
      </Link>

      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Bankdaten aendern</h1>
      <p className="text-sm text-gray-500 mb-6">
        {supplier.name}
        {supplier.iban ? ` · Aktuelle IBAN: ${supplier.iban.slice(0, 4)} ****` : ' · Keine Bankdaten hinterlegt'}
      </p>

      <BankDataChangeForm supplierId={id} />
    </div>
  )
}
