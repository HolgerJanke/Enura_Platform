export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { hasFinanzplanungPermission } from '@/lib/finanzplanung-guard'
import { formatDate } from '@enura/types'
import { BankApprovalActions } from './bank-approval-actions'

export default async function BankdatenGenehmigungPage() {
  const canReview = await hasFinanzplanungPermission('module:finanzplanung:review_bank_data')
  const canApprove = await hasFinanzplanungPermission('module:finanzplanung:approve_bank_data')

  if (!canReview && !canApprove) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 mb-4">Keine Berechtigung fuer Bankdaten-Genehmigung.</p>
        <Link href="/finanzplanung" className="text-blue-600 underline text-sm">Zurueck</Link>
      </div>
    )
  }

  const session = await getSession()
  const supabase = createSupabaseServerClient()

  // Fetch all pending/reviewed requests with supplier names
  const { data: requestsRaw } = await supabase
    .from('supplier_bank_change_requests')
    .select('id, supplier_id, proposed_iban, proposed_bic, proposed_bank_name, reason, source, status, requested_at, requested_by, reviewed_by, is_urgent, urgent_justification')
    .in('status', ['pending_review', 'reviewed'])
    .order('is_urgent', { ascending: false })
    .order('requested_at', { ascending: true })

  const requests = (requestsRaw ?? []) as Array<{
    id: string; supplier_id: string; proposed_iban: string; proposed_bic: string | null
    proposed_bank_name: string | null; reason: string; source: string; status: string
    requested_at: string; requested_by: string; reviewed_by: string | null
    is_urgent: boolean; urgent_justification: string | null
  }>

  // Fetch supplier names
  const supplierIds = [...new Set(requests.map((r) => r.supplier_id))]
  let supplierMap: Record<string, { name: string; iban: string | null }> = {}
  if (supplierIds.length > 0) {
    const { data: suppliersRaw } = await supabase
      .from('suppliers')
      .select('id, name, iban')
      .in('id', supplierIds)

    for (const s of (suppliersRaw ?? []) as Array<{ id: string; name: string; iban: string | null }>) {
      supplierMap[s.id] = { name: s.name, iban: s.iban }
    }
  }

  // Fetch profile names for display
  const profileIds = [...new Set(requests.flatMap((r) => [r.requested_by, r.reviewed_by].filter(Boolean) as string[]))]
  let profileMap: Record<string, string> = {}
  if (profileIds.length > 0) {
    const { data: profilesRaw } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', profileIds)

    for (const p of (profilesRaw ?? []) as Array<{ id: string; full_name: string | null }>) {
      profileMap[p.id] = p.full_name ?? 'Unbekannt'
    }
  }

  const pendingReview = requests.filter((r) => r.status === 'pending_review')
  const pendingApproval = requests.filter((r) => r.status === 'reviewed')

  function maskIban(iban: string): string {
    if (iban.length <= 8) return iban
    return `${iban.slice(0, 4)} **** ${iban.slice(-4)}`
  }

  const sourceLabel: Record<string, string> = {
    internal: 'Intern',
    supplier_request: 'Lieferantenanfrage',
    invoice_mismatch: 'Rechnungsabweichung',
  }

  return (
    <div className="p-6">
      <Link href="/finanzplanung" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        &larr; Zurueck zur Finanzplanung
      </Link>

      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Bankdaten-Genehmigung</h1>
      <p className="text-sm text-gray-500 mb-6">
        4-Augen-Prinzip: Jede Bankdatenaenderung muss von einer Person geprueft und von einer anderen genehmigt werden.
      </p>

      {/* Pending review section */}
      {canReview && (
        <div className="mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-3">
            Zu pruefen ({pendingReview.length})
          </h2>
          {pendingReview.length === 0 ? (
            <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4 border border-gray-200">
              Keine offenen Pruefungsantraege.
            </p>
          ) : (
            <div className="space-y-3">
              {pendingReview.map((req) => {
                const supplier = supplierMap[req.supplier_id]
                const isOwnRequest = req.requested_by === session?.profile.id
                return (
                  <div key={req.id} className={`rounded-lg border p-4 bg-white ${req.is_urgent ? 'border-red-300' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Link href={`/finanzplanung/lieferanten/${req.supplier_id}`} className="text-sm font-medium text-blue-600 hover:underline">
                          {supplier?.name ?? 'Unbekannt'}
                        </Link>
                        {req.is_urgent && (
                          <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Dringend</span>
                        )}
                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                          {sourceLabel[req.source] ?? req.source}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">{formatDate(req.requested_at)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm mb-2">
                      <div>
                        <span className="text-gray-500">Aktuelle IBAN: </span>
                        <span className="font-mono">{supplier?.iban ? maskIban(supplier.iban) : '—'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Neue IBAN: </span>
                        <span className="font-mono font-medium">{maskIban(req.proposed_iban)}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">
                      Grund: {req.reason}
                      {' · '}Antragsteller: {profileMap[req.requested_by] ?? 'Unbekannt'}
                    </p>
                    {isOwnRequest ? (
                      <p className="text-xs text-yellow-700 bg-yellow-50 rounded px-2 py-1">
                        4-Augen-Prinzip: Sie koennen Ihren eigenen Antrag nicht pruefen.
                      </p>
                    ) : (
                      <BankApprovalActions requestId={req.id} mode="review" />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Pending approval section */}
      {canApprove && (
        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-3">
            Zu genehmigen ({pendingApproval.length})
          </h2>
          {pendingApproval.length === 0 ? (
            <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4 border border-gray-200">
              Keine offenen Genehmigungsantraege.
            </p>
          ) : (
            <div className="space-y-3">
              {pendingApproval.map((req) => {
                const supplier = supplierMap[req.supplier_id]
                const isOwnRequest = req.requested_by === session?.profile.id
                const isOwnReview = req.reviewed_by === session?.profile.id
                const blocked = isOwnRequest || isOwnReview
                return (
                  <div key={req.id} className={`rounded-lg border p-4 bg-white ${req.is_urgent ? 'border-red-300' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Link href={`/finanzplanung/lieferanten/${req.supplier_id}`} className="text-sm font-medium text-blue-600 hover:underline">
                          {supplier?.name ?? 'Unbekannt'}
                        </Link>
                        {req.is_urgent && (
                          <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Dringend</span>
                        )}
                        <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">Geprueft</span>
                      </div>
                      <span className="text-xs text-gray-500">{formatDate(req.requested_at)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm mb-2">
                      <div>
                        <span className="text-gray-500">Aktuelle IBAN: </span>
                        <span className="font-mono">{supplier?.iban ? maskIban(supplier.iban) : '—'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Neue IBAN: </span>
                        <span className="font-mono font-medium">{maskIban(req.proposed_iban)}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">
                      Grund: {req.reason}
                      {' · '}Antragsteller: {profileMap[req.requested_by] ?? 'Unbekannt'}
                      {' · '}Geprueft von: {req.reviewed_by ? (profileMap[req.reviewed_by] ?? 'Unbekannt') : '—'}
                    </p>
                    {blocked ? (
                      <p className="text-xs text-yellow-700 bg-yellow-50 rounded px-2 py-1">
                        4-Augen-Prinzip: {isOwnRequest ? 'Sie koennen Ihren eigenen Antrag nicht genehmigen.' : 'Pruefer und Genehmiger muessen unterschiedliche Personen sein.'}
                      </p>
                    ) : (
                      <BankApprovalActions requestId={req.id} mode="approve" />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
