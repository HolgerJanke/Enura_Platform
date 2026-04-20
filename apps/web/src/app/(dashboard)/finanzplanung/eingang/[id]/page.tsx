export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireFinanzplanung } from '@/lib/finanzplanung-guard'
import { InvoiceValidationClient } from './invoice-validation-client'

interface InvoiceDetail {
  id: string
  invoice_number: string | null
  invoice_date: string | null
  sender_name: string | null
  sender_address: string | null
  sender_vat_number: string | null
  sender_email: string | null
  sender_contact_name: string | null
  sender_contact_phone: string | null
  recipient_name: string | null
  net_amount: number | null
  vat_rate: number | null
  vat_amount: number | null
  gross_amount: number | null
  currency: string
  due_date: string | null
  payment_terms_text: string | null
  status: string
  match_confidence: number | null
  match_method: string | null
  project_ref_raw: string | null
  raw_filename: string | null
  extraction_status: string
  created_at: string
}

interface ValidationLog {
  id: string
  validation_step: number
  action: string
  actor_id: string
  comment: string | null
  planned_date_override: string | null
  created_at: string
}

interface LineItem {
  id: string
  position: number
  description: string
  quantity: number | null
  unit: string | null
  unit_price: number | null
  line_total: number | null
}

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const hasAccess = await requireFinanzplanung()
  if (!hasAccess) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Kein Zugriff.</p>
      </div>
    )
  }

  const session = await getSession()
  const supabase = createSupabaseServerClient()

  const { data: invoice } = await supabase
    .from('invoices_incoming')
    .select('*')
    .eq('id', id)
    .eq('company_id', session!.companyId ?? '')
    .single()

  if (!invoice) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 mb-4">Rechnung nicht gefunden.</p>
        <Link href="/finanzplanung/eingang" className="text-blue-600 underline text-sm">Zurück zum Eingang</Link>
      </div>
    )
  }

  const inv = invoice as unknown as InvoiceDetail

  // Fetch validation history
  const { data: validations } = await supabase
    .from('invoice_validations')
    .select('id, validation_step, action, actor_id, comment, planned_date_override, created_at')
    .eq('invoice_id', id)
    .order('created_at', { ascending: true })

  const logs = (validations ?? []) as ValidationLog[]

  // Fetch line items
  const { data: lineItems } = await supabase
    .from('invoice_line_items')
    .select('id, position, description, quantity, unit, unit_price, line_total')
    .eq('invoice_id', id)
    .order('position')

  const items = (lineItems ?? []) as LineItem[]

  // Determine current validation step
  const hasStep1 = logs.some(l => l.validation_step === 1 && l.action === 'formal_pass')
  const hasStep2 = logs.some(l => l.validation_step === 2 && (l.action === 'content_pass' || l.action === 'due_date_override'))
  const hasStep3 = logs.some(l => l.validation_step === 3 && l.action === 'approve')

  let currentStep = 1
  if (hasStep1) currentStep = 2
  if (hasStep2) currentStep = 3
  if (hasStep3) currentStep = 4

  const canValidate = session!.isHoldingAdmin || session!.permissions.includes('module:finanzplanung:validate')
  const canApprove = session!.isHoldingAdmin || session!.permissions.includes('module:finanzplanung:approve_invoice')

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/finanzplanung/eingang" className="text-sm text-gray-500 hover:text-gray-700 mb-1 inline-block">
            ← Zurück zum Eingang
          </Link>
          <h1 className="text-2xl font-semibold text-gray-900">
            Rechnung {inv.invoice_number ?? inv.id.slice(0, 8)}
          </h1>
        </div>
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
          inv.status === 'approved' ? 'bg-green-100 text-green-700' :
          inv.status === 'paid' ? 'bg-gray-100 text-gray-500' :
          inv.status.includes('returned') ? 'bg-red-100 text-red-700' :
          'bg-blue-100 text-blue-700'
        }`}>
          {inv.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Invoice details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header info */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Rechnungsdetails</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Rechnungssteller</span>
                <p className="font-medium text-gray-900">{inv.sender_name ?? '—'}</p>
                {inv.sender_address && <p className="text-gray-500 text-xs">{inv.sender_address}</p>}
              </div>
              <div>
                <span className="text-gray-500">Empfänger</span>
                <p className="font-medium text-gray-900">{inv.recipient_name ?? '—'}</p>
              </div>
              <div>
                <span className="text-gray-500">Rechnungsnummer</span>
                <p className="font-medium text-gray-900">{inv.invoice_number ?? '—'}</p>
              </div>
              <div>
                <span className="text-gray-500">Rechnungsdatum</span>
                <p className="font-medium text-gray-900">
                  {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('de-CH') : '—'}
                </p>
              </div>
              <div>
                <span className="text-gray-500">USt-Nr.</span>
                <p className="font-medium text-gray-900 font-mono">{inv.sender_vat_number ?? '—'}</p>
              </div>
              <div>
                <span className="text-gray-500">Fälligkeitsdatum</span>
                <p className="font-medium text-gray-900">
                  {inv.due_date ? new Date(inv.due_date).toLocaleDateString('de-CH') : '—'}
                </p>
              </div>
            </div>

            {/* Contact info */}
            {(inv.sender_email || inv.sender_contact_name || inv.sender_contact_phone) && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Kontakt</p>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  {inv.sender_contact_name && <div><span className="text-gray-500">Name:</span> {inv.sender_contact_name}</div>}
                  {inv.sender_email && <div><span className="text-gray-500">E-Mail:</span> {inv.sender_email}</div>}
                  {inv.sender_contact_phone && <div><span className="text-gray-500">Tel.:</span> {inv.sender_contact_phone}</div>}
                </div>
              </div>
            )}
          </div>

          {/* Financial summary */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Betraege</h2>
            <div className="grid grid-cols-4 gap-4">
              <div className="rounded-lg bg-gray-50 p-4 text-center">
                <p className="text-xs text-gray-500">Netto</p>
                <p className="text-lg font-bold text-gray-900">
                  {inv.net_amount != null ? `${inv.currency} ${Number(inv.net_amount).toLocaleString('de-CH', { minimumFractionDigits: 2 })}` : '—'}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4 text-center">
                <p className="text-xs text-gray-500">USt ({inv.vat_rate ?? 0}%)</p>
                <p className="text-lg font-bold text-gray-900">
                  {inv.vat_amount != null ? `${inv.currency} ${Number(inv.vat_amount).toLocaleString('de-CH', { minimumFractionDigits: 2 })}` : '—'}
                </p>
              </div>
              <div className="rounded-lg bg-blue-50 p-4 text-center col-span-2">
                <p className="text-xs text-blue-600">Brutto</p>
                <p className="text-2xl font-bold text-blue-700">
                  {inv.gross_amount != null ? `${inv.currency} ${Number(inv.gross_amount).toLocaleString('de-CH', { minimumFractionDigits: 2 })}` : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Line items */}
          {items.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Positionen</h2>
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead>
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 pb-2">Pos.</th>
                    <th className="text-left text-xs font-medium text-gray-500 pb-2">Beschreibung</th>
                    <th className="text-right text-xs font-medium text-gray-500 pb-2">Menge</th>
                    <th className="text-right text-xs font-medium text-gray-500 pb-2">Einzelpreis</th>
                    <th className="text-right text-xs font-medium text-gray-500 pb-2">Gesamt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2 text-gray-500">{item.position}</td>
                      <td className="py-2 text-gray-900">{item.description}</td>
                      <td className="py-2 text-gray-500 text-right">{item.quantity ?? '—'} {item.unit ?? ''}</td>
                      <td className="py-2 text-gray-500 text-right font-mono">
                        {item.unit_price != null ? Number(item.unit_price).toLocaleString('de-CH', { minimumFractionDigits: 2 }) : '—'}
                      </td>
                      <td className="py-2 text-gray-900 text-right font-mono font-medium">
                        {item.line_total != null ? Number(item.line_total).toLocaleString('de-CH', { minimumFractionDigits: 2 }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right column: Validation workflow + history */}
        <div className="space-y-6">
          {/* Validation workflow steps */}
          <InvoiceValidationClient
            invoiceId={inv.id}
            currentStep={currentStep}
            status={inv.status}
            canValidate={canValidate}
            canApprove={canApprove}
            dueDate={inv.due_date}
          />

          {/* Validation history */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Validierungsprotokoll</h2>
            {logs.length === 0 ? (
              <p className="text-sm text-gray-500">Noch keine Validierungsschritte durchgeführt.</p>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div key={log.id} className="border-l-2 border-gray-200 pl-3 py-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-600">Schritt {log.validation_step}</span>
                      <span className="text-xs rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">{log.action}</span>
                    </div>
                    {log.comment && <p className="text-xs text-gray-500 mt-0.5">{log.comment}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(log.created_at).toLocaleString('de-CH')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
