export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { hasFinanzplanungPermission } from '@/lib/finanzplanung-guard'
import { formatDate } from '@enura/types'

interface PageProps {
  params: { id: string }
}

export default async function SupplierDetailPage({ params }: PageProps) {
  const canManage = await hasFinanzplanungPermission('module:finanzplanung:manage_suppliers')
  if (!canManage) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 mb-4">Kein Zugriff auf Lieferanten-Verwaltung.</p>
        <Link href="/finanzplanung" className="text-blue-600 underline text-sm">Zurueck</Link>
      </div>
    )
  }

  const session = await getSession()
  const supabase = createSupabaseServerClient()
  const { id } = params

  // Fetch supplier
  const { data: supplierRaw } = await supabase
    .from('suppliers')
    .select('*')
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

  const supplier = supplierRaw as Record<string, string | number | boolean | null>

  // Fetch bank data versions
  const { data: bankDataRaw } = await supabase
    .from('supplier_bank_data')
    .select('id, version, iban, bic, bank_name, is_active, activated_at, deactivated_at, created_at')
    .eq('supplier_id', id)
    .order('version', { ascending: false })

  const bankDataVersions = (bankDataRaw ?? []) as Array<{
    id: string; version: number; iban: string; bic: string | null; bank_name: string | null
    is_active: boolean; activated_at: string | null; deactivated_at: string | null; created_at: string
  }>

  // Fetch change requests
  const { data: requestsRaw } = await supabase
    .from('supplier_bank_change_requests')
    .select('id, proposed_iban, proposed_bic, proposed_bank_name, reason, source, status, requested_at, is_urgent, requested_by, reviewed_by, approved_by, rejected_by, rejection_reason, review_comment, approval_comment')
    .eq('supplier_id', id)
    .order('requested_at', { ascending: false })

  const changeRequests = (requestsRaw ?? []) as Array<{
    id: string; proposed_iban: string; proposed_bic: string | null; proposed_bank_name: string | null
    reason: string; source: string; status: string; requested_at: string; is_urgent: boolean
    requested_by: string; reviewed_by: string | null; approved_by: string | null
    rejected_by: string | null; rejection_reason: string | null
    review_comment: string | null; approval_comment: string | null
  }>

  // Check permissions for review/approve actions
  const canReview = session?.isHoldingAdmin || session?.permissions.includes('module:finanzplanung:review_bank_data')
  const canApprove = session?.isHoldingAdmin || session?.permissions.includes('module:finanzplanung:approve_bank_data')

  // Mask IBAN for display (show first 4 + last 4)
  function maskIban(iban: string): string {
    if (iban.length <= 8) return iban
    return `${iban.slice(0, 4)} ${'*'.repeat(iban.length - 8)} ${iban.slice(-4)}`
  }

  const activeBankData = bankDataVersions.find((bd) => bd.is_active) ?? null
  const pendingRequest = changeRequests.find((r) => ['pending_review', 'reviewed'].includes(r.status)) ?? null

  return (
    <div className="p-6">
      <Link href="/finanzplanung/lieferanten" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        &larr; Zurueck zur Lieferantenliste
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {supplier['name'] as string}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {[supplier['city'], supplier['country']].filter(Boolean).join(', ')}
            {supplier['vat_number'] ? ` · USt-Nr: ${supplier['vat_number']}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {supplier['bank_data_verified'] ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              Bankdaten verifiziert
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              Bankdaten nicht verifiziert
            </span>
          )}
        </div>
      </div>

      {/* Stammdaten */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Stammdaten</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Name</dt>
              <dd className="font-medium text-gray-900">{supplier['name'] as string}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Adresse</dt>
              <dd className="text-right text-gray-900">
                {String(supplier['address_line_1'] ?? '—')}
                {supplier['address_line_2'] ? <><br />{String(supplier['address_line_2'])}</> : null}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">PLZ / Ort</dt>
              <dd className="text-gray-900">{[supplier['postal_code'], supplier['city']].filter(Boolean).join(' ') || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Land</dt>
              <dd className="text-gray-900">{supplier['country'] as string}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">USt-Nr.</dt>
              <dd className="font-mono text-gray-900">{(supplier['vat_number'] as string) ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Kontakt</dt>
              <dd className="text-gray-900">{(supplier['contact_name'] as string) ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">E-Mail</dt>
              <dd className="text-gray-900">{(supplier['contact_email'] as string) ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Zahlungsziel</dt>
              <dd className="text-gray-900">{supplier['preferred_payment_days'] as number} Tage</dd>
            </div>
          </dl>
        </div>

        {/* Bankdaten */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Bankdaten</h2>
            {!pendingRequest && (
              <Link
                href={`/finanzplanung/lieferanten/${id}/bankdaten-aendern`}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
              >
                Bankdaten aendern
              </Link>
            )}
          </div>

          {activeBankData ? (
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">IBAN</dt>
                <dd className="font-mono font-medium text-gray-900">
                  {canReview || canApprove ? activeBankData.iban : maskIban(activeBankData.iban)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">BIC</dt>
                <dd className="font-mono text-gray-900">{activeBankData.bic ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Bank</dt>
                <dd className="text-gray-900">{activeBankData.bank_name ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Version</dt>
                <dd className="text-gray-900">v{activeBankData.version}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Aktiv seit</dt>
                <dd className="text-gray-900">{activeBankData.activated_at ? formatDate(activeBankData.activated_at) : '—'}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-gray-500">Keine Bankdaten hinterlegt.</p>
          )}

          {pendingRequest && (
            <div className="mt-4 rounded-lg border-2 border-yellow-300 bg-yellow-50 p-3">
              <p className="text-xs font-medium text-yellow-800 mb-1">
                Offene Aenderungsanfrage
                {pendingRequest.is_urgent && <span className="ml-1 text-red-600">(Dringend)</span>}
              </p>
              <p className="text-xs text-yellow-700">
                Neue IBAN: <span className="font-mono">{maskIban(pendingRequest.proposed_iban)}</span>
                {' · '}Status: {pendingRequest.status === 'pending_review' ? 'Zu pruefen' : 'Geprueft — wartet auf Genehmigung'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Versionshistorie */}
      {bankDataVersions.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Bankdaten-Versionshistorie</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Version</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">IBAN</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">BIC</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Bank</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Aktiviert</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {bankDataVersions.map((bd) => (
                  <tr key={bd.id} className={bd.is_active ? 'bg-green-50' : ''}>
                    <td className="px-4 py-2 font-mono">v{bd.version}</td>
                    <td className="px-4 py-2 font-mono">{canReview || canApprove ? bd.iban : maskIban(bd.iban)}</td>
                    <td className="px-4 py-2 font-mono">{bd.bic ?? '—'}</td>
                    <td className="px-4 py-2">{bd.bank_name ?? '—'}</td>
                    <td className="px-4 py-2">
                      {bd.is_active ? (
                        <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Aktiv</span>
                      ) : (
                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">Inaktiv</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-500">{bd.activated_at ? formatDate(bd.activated_at) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Aenderungsantraege */}
      {changeRequests.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Aenderungsantraege</h2>
          <div className="space-y-3">
            {changeRequests.map((cr) => (
              <div key={cr.id} className={`rounded-lg border p-4 ${
                cr.status === 'approved' ? 'border-green-200 bg-green-50' :
                cr.status === 'rejected' ? 'border-red-200 bg-red-50' :
                cr.status === 'cancelled' ? 'border-gray-200 bg-gray-50' :
                'border-yellow-200 bg-yellow-50'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      cr.status === 'pending_review' ? 'bg-yellow-100 text-yellow-800' :
                      cr.status === 'reviewed' ? 'bg-blue-100 text-blue-800' :
                      cr.status === 'approved' ? 'bg-green-100 text-green-800' :
                      cr.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {cr.status === 'pending_review' ? 'Zu pruefen' :
                       cr.status === 'reviewed' ? 'Zu genehmigen' :
                       cr.status === 'approved' ? 'Genehmigt' :
                       cr.status === 'rejected' ? 'Abgelehnt' : 'Storniert'}
                    </span>
                    {cr.is_urgent && (
                      <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Dringend</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">{formatDate(cr.requested_at)}</span>
                </div>
                <p className="text-sm text-gray-700">
                  <span className="font-mono">{maskIban(cr.proposed_iban)}</span>
                  {cr.proposed_bank_name && ` · ${cr.proposed_bank_name}`}
                </p>
                <p className="text-xs text-gray-500 mt-1">Grund: {cr.reason}</p>
                {cr.rejection_reason && (
                  <p className="text-xs text-red-600 mt-1">Ablehnungsgrund: {cr.rejection_reason}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
